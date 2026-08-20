// Playing a call over a simulated VHF radio.
//
// The voice itself is a recording — every call rendered whole ahead of time and
// put through the comms chain offline, because the Web Speech API exposes no
// audio node for synthesised speech and so a live voice cannot be filtered.
// What is generated here is the radio around it: the click of the transmit
// button, a burst of squelch as the carrier opens, a faint hiss underneath, and
// a squelch tail when the carrier drops.
//
// The browser synthesiser remains as a fallback for when the recordings cannot
// be played at all. It sounds markedly worse, so the UI says when it is in use
// — a silent downgrade is indistinguishable from the recordings being bad, and
// that is exactly how a blocked asset load once went unnoticed.

import bankAudioUrl from "../assets/call-bank.bin?url";
import bankIndexUrl from "../assets/call-bank.json?url";

const STORAGE_KEY = "rt-app.radio-effects";

let effectsEnabled = readStoredPreference();

function readStoredPreference(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) !== "off";
}

export function radioEffectsEnabled(): boolean {
  return effectsEnabled;
}

export function setRadioEffects(enabled: boolean): void {
  effectsEnabled = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Private-mode storage failures are not worth surfacing.
  }
}

// ------------------------------------------------------------------- Web Audio

let audioContext: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  audioContext ??= new Ctor();
  // Browsers start the context suspended until a user gesture; every call into
  // here originates from a button press, so this is the moment to resume it.
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

/**
 * The comms passband: everything outside roughly 300-2900 Hz is thrown away and
 * the presence region is pushed up, which is what makes radio audio sound thin
 * and forward rather than full.
 */
function commsChain(ctx: AudioContext, destination: AudioNode): AudioNode {
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 340;
  highpass.Q.value = 0.7;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 2900;
  lowpass.Q.value = 0.7;

  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 1800;
  presence.Q.value = 1.1;
  presence.gain.value = 6;

  highpass.connect(lowpass);
  lowpass.connect(presence);
  presence.connect(destination);
  return highpass;
}

interface BurstOptions {
  at: number;
  duration: number;
  level: number;
  /** Squelch is bandpassed; the PTT click keeps more top end so it snaps. */
  filtered?: boolean;
  attack?: number;
}

function noiseBurst(ctx: AudioContext, opts: BurstOptions): void {
  const { at, duration, level, filtered = true, attack = 0.006 } = opts;

  const source = ctx.createBufferSource();
  source.buffer = getNoise(ctx);
  source.loop = true;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(level, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  source.connect(gain);
  if (filtered) {
    gain.connect(commsChain(ctx, ctx.destination));
  } else {
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 900;
    highpass.connect(ctx.destination);
    gain.connect(highpass);
  }

  source.start(at);
  source.stop(at + duration + 0.05);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
}

/** The mechanical snap of a transmit button. */
function pttClick(ctx: AudioContext, at: number, level = 0.055): void {
  noiseBurst(ctx, { at, duration: 0.022, level, filtered: false, attack: 0.001 });
}

/** Carrier noise — short and bright opening, longer and softer closing. */
function squelch(ctx: AudioContext, at: number, duration: number, level: number): void {
  noiseBurst(ctx, { at, duration, level });
}

/** Faint hiss under the voice for as long as the carrier is open. */
function openCarrier(ctx: AudioContext, level = 0.011): () => void {
  const source = ctx.createBufferSource();
  source.buffer = getNoise(ctx);
  source.loop = true;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(level, now + 0.05);

  source.connect(gain);
  gain.connect(commsChain(ctx, ctx.destination));
  source.start(now);

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const end = ctx.currentTime;
    gain.gain.cancelScheduledValues(end);
    gain.gain.setValueAtTime(gain.gain.value, end);
    gain.gain.linearRampToValueAtTime(0.0001, end + 0.04);
    source.stop(end + 0.08);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  };
}

// ----------------------------------------------------------------------- voice

export function transmitSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Prefer an Australian voice, then any English one. getVoices() is empty until
 * the list loads, so this is resolved at call time rather than cached.
 */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  return (
    voices.find((v) => v.lang === "en-AU") ??
    voices.find((v) => v.lang === "en-GB") ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null
  );
}

let closeCarrier: (() => void) | null = null;
// Bumped per transmission so a late callback from a superseded one — a pending
// failsafe timer, a stray onend — cannot close the carrier of the current one.
let generation = 0;
let playingClips: AudioBufferSourceNode[] = [];

/** Stop any transmission currently in progress. */
export function stopTransmission(): void {
  generation += 1;
  if (transmitSupported()) window.speechSynthesis.cancel();
  for (const node of playingClips) {
    try {
      node.stop();
    } catch {
      // Already finished; nothing to stop.
    }
  }
  playingClips = [];
  closeCarrier?.();
  closeCarrier = null;
}

// ------------------------------------------------------------------ call bank
//
// Every call is recorded as one continuous utterance, already put through the
// comms chain offline. Recordings live end to end in a single binary; the index
// says where each one starts. They are decoded lazily and cached, so opening
// the app costs one fetch and nothing is decoded until something is played.

interface CallBank {
  data: ArrayBuffer;
  calls: Record<string, [byteOffset: number, byteLength: number]>;
}

let bankPromise: Promise<CallBank | null> | null = null;
const decoded = new Map<string, AudioBuffer>();

/**
 * Read a bundled asset.
 *
 * When the app is inlined into a single page the build rewrites asset URLs to
 * `data:` URIs, and a strict Content-Security-Policy refuses `fetch()` on
 * those — `connect-src` governs data: URIs too, so the request is blocked and
 * the audio silently never loads. Decoding the URI directly avoids the request
 * altogether; `fetch` is only for genuinely served files.
 */
async function loadAsset(url: string): Promise<ArrayBuffer> {
  if (url.startsWith("data:")) {
    const base64 = url.slice(url.indexOf(",") + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`asset ${url}: ${response.status}`);
  return response.arrayBuffer();
}

function loadBank(): Promise<CallBank | null> {
  bankPromise ??= (async () => {
    try {
      const [data, indexBytes] = await Promise.all([
        loadAsset(bankAudioUrl),
        loadAsset(bankIndexUrl),
      ]);
      const index = JSON.parse(new TextDecoder().decode(indexBytes)) as {
        calls: CallBank["calls"];
      };
      return { data, calls: index.calls };
    } catch {
      // Any failure here just means we speak the call with the synthesiser.
      return null;
    }
  })();
  return bankPromise;
}

/**
 * Drop the silence an MP3 decode leaves at each end — the encoder's own delay
 * and padding, around 150ms in total. Left in, it delays the voice behind the
 * squelch and holds the carrier open after the call has finished.
 */
function trimSilence(ctx: AudioContext, buffer: AudioBuffer): AudioBuffer {
  const samples = buffer.getChannelData(0);
  const floor = 0.004;

  let start = 0;
  while (start < samples.length && Math.abs(samples[start]) < floor) start += 1;
  let end = samples.length - 1;
  while (end > start && Math.abs(samples[end]) < floor) end -= 1;

  if (start === 0 && end === samples.length - 1) return buffer;
  if (end <= start) return buffer;

  const trimmed = ctx.createBuffer(1, end - start + 1, buffer.sampleRate);
  trimmed.getChannelData(0).set(samples.subarray(start, end + 1));
  return trimmed;
}

/** Decode one call's recording, keeping it for next time. */
async function recordingFor(
  ctx: AudioContext,
  bank: CallBank,
  id: string,
): Promise<AudioBuffer | null> {
  const cached = decoded.get(id);
  if (cached) return cached;

  const entry = bank.calls[id];
  if (!entry) return null;

  const [offset, length] = entry;
  try {
    // decodeAudioData detaches the buffer it is given, so hand it a copy.
    const raw = await ctx.decodeAudioData(bank.data.slice(offset, offset + length));
    const buffer = trimSilence(ctx, raw);
    decoded.set(id, buffer);
    return buffer;
  } catch {
    return null;
  }
}

/**
 * A call to speak. `id` names the recording of it; `text` is only used if that
 * recording cannot be played and the synthesiser has to stand in.
 */
export interface SpokenCall {
  text: string;
  id: string;
}

/**
 * Speak a call the way it would sound over the air.
 *
 * This plays the recording of the call — one continuous utterance that has
 * been through the comms chain offline, which is the only way to get a
 * genuinely filtered voice in a browser. Radio effects add the transmit click,
 * squelch and carrier hiss around it; with them off the same recording plays
 * clean. Only if the recording cannot be played at all does the speech
 * synthesiser stand in, so a call is never silently dropped.
 */
export function transmit(call: SpokenCall): void {
  stopTransmission();

  const ctx = getContext();
  if (!ctx) {
    setAudioSource("synthesised");
    speakFallback(call.text);
    return;
  }

  const mine = generation;
  void (async () => {
    const bank = await loadBank();
    if (mine !== generation) return;

    const recording = bank ? await recordingFor(ctx, bank, call.id) : null;
    if (mine !== generation) return;

    if (recording) {
      setAudioSource("recorded");
      playRecorded(ctx, recording);
    } else {
      setAudioSource("synthesised");
      speakFallback(call.text);
    }
  })();
}

/** The recorded path: the call itself, with the radio around it. */
function playRecorded(ctx: AudioContext, recording: AudioBuffer): void {
  const mine = generation;
  const start = ctx.currentTime;

  // Without effects the recording plays on its own — same voice, no radio.
  const voiceAt = effectsEnabled ? start + 0.16 : start;
  if (effectsEnabled) {
    pttClick(ctx, start);
    squelch(ctx, start + 0.015, 0.07, 0.09);
  }

  const source = ctx.createBufferSource();
  source.buffer = recording;
  source.connect(ctx.destination);
  source.start(voiceAt);
  playingClips.push(source);
  source.onended = () => {
    source.disconnect();
    playingClips = playingClips.filter((n) => n !== source);
  };

  if (!effectsEnabled) return;

  closeCarrier = openCarrier(ctx);
  const remaining = Math.max(0, (voiceAt + recording.duration - ctx.currentTime) * 1000);
  window.setTimeout(() => {
    if (mine !== generation || !closeCarrier) return;
    closeCarrier();
    closeCarrier = null;
    const end = ctx.currentTime;
    squelch(ctx, end + 0.02, 0.13, 0.12);
    pttClick(ctx, end + 0.1, 0.04);
  }, remaining + 40);
}

// ------------------------------------------------------------- audio status
//
// The synthesiser fallback is a much worse voice, and when it engages silently
// there is no way to tell it apart from the recordings simply sounding bad —
// which is exactly how a blocked asset load went unnoticed. The UI says so.

export type AudioSource = "recorded" | "synthesised";

let audioSource: AudioSource = "recorded";
const statusListeners = new Set<(source: AudioSource) => void>();

export function subscribeAudioSource(listener: (source: AudioSource) => void): () => void {
  statusListeners.add(listener);
  listener(audioSource);
  return () => statusListeners.delete(listener);
}

function setAudioSource(source: AudioSource): void {
  if (audioSource === source) return;
  audioSource = source;
  for (const listener of statusListeners) listener(source);
}

/** The synthesiser path — unfiltered, but always available. */
function speakFallback(text: string): void {
  if (!transmitSupported()) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-AU";
  const voice = pickVoice();
  if (voice) utterance.voice = voice;

  if (!effectsEnabled) {
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    return;
  }

  // Controllers speak briskly and level, not conversationally. Pitch is left
  // at 1 so the platform voice is not pushed towards either gender — the
  // recorded bank is deliberately neutral and this should match it.
  utterance.rate = 1.08;
  utterance.pitch = 1;

  const ctx = getContext();
  if (!ctx) {
    window.speechSynthesis.speak(utterance);
    return;
  }

  const start = ctx.currentTime;
  pttClick(ctx, start);
  squelch(ctx, start + 0.015, 0.07, 0.09);

  const mine = generation;
  let failsafe = 0;

  const closeDown = (withTail: boolean) => {
    window.clearTimeout(failsafe);
    // A superseded transmission must not close the current one's carrier.
    if (mine !== generation || !closeCarrier) return;
    closeCarrier();
    closeCarrier = null;
    if (!withTail) return;
    const end = ctx.currentTime;
    // Squelch tail, then the button releasing.
    squelch(ctx, end + 0.02, 0.13, 0.12);
    pttClick(ctx, end + 0.1, 0.04);
  };

  utterance.onstart = () => {
    if (mine !== generation) return;
    closeCarrier = openCarrier(ctx);
    // If the voice dies without firing onend — which happens on platforms with
    // no installed voices — the carrier must still close rather than hiss on
    // forever. Roughly generous: real calls run a few seconds.
    failsafe = window.setTimeout(() => closeDown(true), 30_000);
  };

  utterance.onend = () => closeDown(true);
  utterance.onerror = () => closeDown(false);

  // Let the click and opening squelch land before the voice starts, the way a
  // real transmission does.
  window.setTimeout(() => {
    if (mine !== generation) return;
    window.speechSynthesis.speak(utterance);
  }, 150);
}
