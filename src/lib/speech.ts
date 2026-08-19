// Browser speech: text-to-speech for model calls, and speech recognition so a
// trainee can answer by talking on a headset-style push-to-talk button rather
// than typing. Both are progressive enhancements — the app works without them.

// ---------------------------------------------------------------- text to speech

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-AU";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

// ------------------------------------------------------------ speech recognition

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface RecognitionHandlers {
  /** Fired as speech is decoded — final text plus any in-progress guess. */
  onTranscript: (final: string, interim: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings and try again.",
  "service-not-allowed": "Microphone access was blocked. Allow it in your browser's site settings and try again.",
  "no-speech": "Didn't catch anything — check your microphone and try again.",
  "audio-capture": "No microphone found. Plug one in or select one in your system settings.",
  network: "Speech recognition needs a network connection and couldn't reach the service.",
  aborted: "",
};

/** Starts listening; returns a handle to stop. Returns null if unsupported. */
export function startRecognition(handlers: RecognitionHandlers): SpeechRecognitionLike | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = "en-AU";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = "";

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;
      if (result.isFinal) finalText += text + " ";
      else interim += text;
    }
    handlers.onTranscript(finalText.trim(), interim.trim());
  };

  recognition.onerror = (event) => {
    const message = ERROR_MESSAGES[event.error] ?? `Speech recognition error: ${event.error}`;
    if (message) handlers.onError(message);
  };

  recognition.onend = handlers.onEnd;

  recognition.start();
  return recognition;
}
