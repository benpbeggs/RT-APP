// Radio-comms colouring for spoken calls.
//
// A VHF aeronautical transmission has a very recognisable signature: the click
// of the transmit button, a burst of squelch noise as the carrier opens, a
// voice squeezed into a narrow ~300-3000 Hz passband, a faint hiss underneath,
// and a squelch tail when the carrier drops. We synthesise all of that with
// Web Audio and lay it around the spoken call.
//
// One real limitation: the Web Speech API gives no audio node or media element
// for synthesised speech, so the voice itself cannot be routed through a
// biquad filter — only audio we generate ourselves can be. The voice is
// instead shaped the way a controller actually speaks (clipped, level, a
// little fast and low), and the filtered radio artefacts are layered around
// it. That carries most of the effect.

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

/** Stop any transmission currently in progress. */
export function stopTransmission(): void {
  generation += 1;
  if (transmitSupported()) window.speechSynthesis.cancel();
  closeCarrier?.();
  closeCarrier = null;
}

/**
 * Speak a call the way it would sound over the air. With effects switched off
 * this is a plain, clearly-spoken utterance — useful when you are learning the
 * wording and want maximum intelligibility.
 */
export function transmit(text: string): void {
  if (!transmitSupported()) return;
  stopTransmission();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-AU";
  const voice = pickVoice();
  if (voice) utterance.voice = voice;

  if (!effectsEnabled) {
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    return;
  }

  // Controllers speak briskly, level and slightly low — not conversationally.
  utterance.rate = 1.08;
  utterance.pitch = 0.85;

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
