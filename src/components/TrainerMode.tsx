import { useEffect, useMemo, useRef, useState } from "react";
import {
  AERODROME_TYPE_LABELS,
  PHASES,
  PHASE_BY_ID,
  type AerodromeType,
  type PhaseId,
} from "../data/phraseology";
import {
  generateValues,
  renderScenario,
  scenariosInScope,
  scoreAnswer,
  type GeneratedValues,
  type ScoreResult,
} from "../lib/scenario";
import {
  recognitionSupported,
  startRecognition,
  type SpeechRecognitionLike,
} from "../lib/speech";
import { transmit, transmitSupported } from "../lib/radio";
import { AircraftDiagram } from "./AircraftDiagram";

type Scope = PhaseId | "all";

export function TrainerMode() {
  const [aerodromeType, setAerodromeType] = useState<AerodromeType>("ctaf");
  const [scope, setScope] = useState<Scope>("all");
  const [index, setIndex] = useState(0);
  // One aircraft and aerodrome for the whole flight, so the sequence hangs together.
  const [values, setValues] = useState<GeneratedValues>(() => generateValues("ctaf"));

  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Text already in the box when the mic opened, so dictation appends.
  const baseAnswerRef = useRef("");

  const templates = useMemo(
    () => scenariosInScope(scope, aerodromeType),
    [scope, aerodromeType],
  );
  const current = useMemo(
    () =>
      templates.length === 0
        ? null
        : renderScenario(templates[Math.min(index, templates.length - 1)], values),
    [templates, index, values],
  );

  const canDictate = recognitionSupported();

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterim("");
  }

  // Never leave the microphone open behind a navigation or unmount.
  useEffect(() => stopListening, []);

  function reset() {
    stopListening();
    setAnswer("");
    setResult(null);
    setMicError(null);
  }

  function goTo(nextIndex: number) {
    reset();
    setIndex((nextIndex + templates.length) % templates.length);
  }

  function changeScope(next: Scope) {
    reset();
    setScope(next);
    setIndex(0);
  }

  function changeAerodromeType(next: AerodromeType) {
    reset();
    setAerodromeType(next);
    // The aerodrome and who you're calling both change with the field type.
    setValues(generateValues(next));
    setIndex(0);
  }

  function newFlight() {
    reset();
    setValues(generateValues(aerodromeType));
    setIndex(0);
  }

  function toggleListening() {
    if (listening) {
      stopListening();
      return;
    }
    setMicError(null);
    baseAnswerRef.current = answer.trim();

    const recognition = startRecognition({
      onTranscript: (final, live) => {
        const prefix = baseAnswerRef.current ? baseAnswerRef.current + " " : "";
        setAnswer((prefix + final).trim());
        setInterim(live);
      },
      onError: (message) => {
        setMicError(message);
        setListening(false);
      },
      onEnd: () => {
        recognitionRef.current = null;
        setListening(false);
        setInterim("");
      },
    });

    if (!recognition) {
      setMicError("This browser doesn't support speech recognition. Try Chrome, Edge, or Safari.");
      return;
    }
    recognitionRef.current = recognition;
    setListening(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !current) return;
    stopListening();
    setResult(scoreAnswer(answer, current.requiredElements));
  }

  if (!current) {
    return <p className="empty">No calls for this phase at a {AERODROME_TYPE_LABELS[aerodromeType]} aerodrome.</p>;
  }

  const phase = PHASE_BY_ID[current.template.phase];
  const scoreClass = !result ? "" : result.score >= 0.8 ? "good" : result.score >= 0.4 ? "ok" : "bad";

  return (
    <div className="mode-panel">
      <div className="filters">
        <select
          value={aerodromeType}
          aria-label="Aerodrome type"
          onChange={(e) => changeAerodromeType(e.target.value as AerodromeType)}
        >
          {(Object.keys(AERODROME_TYPE_LABELS) as AerodromeType[]).map((t) => (
            <option key={t} value={t}>
              {AERODROME_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={scope}
          aria-label="Phase of flight"
          onChange={(e) => changeScope(e.target.value as Scope)}
        >
          <option value="all">Full flight — every call in order</option>
          {PHASES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.step === null ? p.label : `${p.step}. ${p.label}`}
            </option>
          ))}
        </select>
        <button type="button" className="ghost-btn" onClick={newFlight}>
          New flight
        </button>
        <span className="progress-count">
          Call {index + 1} of {templates.length}
        </span>
      </div>

      <div className="progress-track" aria-hidden="true">
        <div
          className="progress-fill"
          style={{ width: `${((index + 1) / templates.length) * 100}%` }}
        />
      </div>

      <article className="phrase-card scenario-card">
        <header>
          <span className="chip">
            {phase.step === null ? phase.label : `${phase.step} · ${phase.label}`}
          </span>
          <h3>{current.template.title}</h3>
        </header>

        <div className="scenario-body">
          <AircraftDiagram position={current.position} values={current.values} />
          <p className="situation">{current.situation}</p>
        </div>

        <form onSubmit={submit}>
          <label htmlFor="answer">Your radio call</label>
          <textarea
            id="answer"
            value={answer + (interim ? ` ${interim}` : "")}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your call, or press Transmit and say it out loud…"
            rows={3}
          />

          <div className="actions">
            <button type="submit">Check my call</button>
            {canDictate && (
              <button
                type="button"
                className={`mic-btn ${listening ? "listening" : ""}`}
                onClick={toggleListening}
                aria-pressed={listening}
              >
                <span className="mic-dot" aria-hidden="true" />
                {listening ? "Stop transmitting" : "Transmit"}
              </button>
            )}
            <button type="button" className="ghost-btn" onClick={() => goTo(index - 1)}>
              ← Previous
            </button>
            <button type="button" className="ghost-btn" onClick={() => goTo(index + 1)}>
              Next call →
            </button>
          </div>

          {listening && <p className="mic-hint">Listening — speak your call, then press stop.</p>}
          {micError && <p className="mic-error">{micError}</p>}
          {!canDictate && (
            <p className="mic-hint subtle">
              Voice answers need Chrome, Edge, or Safari — type your call instead.
            </p>
          )}
        </form>

        {result && (
          <div className={`result ${scoreClass}`}>
            <p className="score">
              {result.matchedCount} of {result.elements.length} key elements
              {result.score >= 0.8 ? " — nice call." : ""}
            </p>
            <ul className="element-list">
              {result.elements.map((el) => (
                <li key={el.element} className={el.matched ? "hit" : "miss"}>
                  <span aria-hidden="true">{el.matched ? "✓" : "✗"}</span>
                  {el.element}
                </li>
              ))}
            </ul>
            <div className="model-call">
              <span className="label">Model call</span>
              <p>“{current.modelCall}”</p>
              {transmitSupported() && (
                <button className="ghost-btn" type="button" onClick={() => transmit(current.modelCall)}>
                  ▶ Listen
                </button>
              )}
            </div>
            {current.template.notes && <p className="notes">{current.template.notes}</p>}
            <footer>Source: {current.template.sourceRef}</footer>
          </div>
        )}
      </article>
    </div>
  );
}
