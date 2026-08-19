import { useState } from "react";
import { CATEGORY_LABELS, SCENARIOS, type PhraseCategory } from "../data/phraseology";
import { renderScenario, scoreAnswer, type RenderedScenario, type ScoreResult } from "../lib/scenario";
import { speak, speechSupported } from "../lib/speech";

function pickScenario(category: PhraseCategory | "all"): RenderedScenario {
  const pool = category === "all" ? SCENARIOS : SCENARIOS.filter((s) => s.category === category);
  const template = pool[Math.floor(Math.random() * pool.length)];
  return renderScenario(template);
}

export function TrainerMode() {
  const [category, setCategory] = useState<PhraseCategory | "all">("all");
  const [current, setCurrent] = useState<RenderedScenario>(() => pickScenario("all"));
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [streak, setStreak] = useState(0);

  function next(cat: PhraseCategory | "all" = category) {
    setCurrent(pickScenario(cat));
    setAnswer("");
    setResult(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    const r = scoreAnswer(answer, current.requiredElements);
    setResult(r);
    setStreak(r.score >= 0.8 ? streak + 1 : 0);
  }

  return (
    <div className="mode-panel">
      <div className="filters">
        <select
          value={category}
          onChange={(e) => {
            const c = e.target.value as PhraseCategory | "all";
            setCategory(c);
            next(c);
          }}
        >
          <option value="all">All categories</option>
          {(Object.keys(CATEGORY_LABELS) as PhraseCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <span className="streak">Streak: {streak}</span>
      </div>

      <article className="phrase-card scenario-card">
        <header>
          <span className={`chip chip-${current.template.category}`}>
            {CATEGORY_LABELS[current.template.category]}
          </span>
          <h3>{current.template.title}</h3>
        </header>
        <p className="situation">{current.situation}</p>

        <form onSubmit={submit}>
          <label htmlFor="answer">Your radio call</label>
          <textarea
            id="answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type exactly what you would transmit…"
            rows={3}
          />
          <div className="actions">
            <button type="submit">Check my call</button>
            <button type="button" className="ghost-btn" onClick={() => next()}>
              Skip / New scenario
            </button>
          </div>
        </form>

        {result && (
          <div className={`result ${result.score >= 0.8 ? "good" : result.score >= 0.4 ? "ok" : "bad"}`}>
            <p className="score">
              {Math.round(result.score * 100)}% of key elements included
              {result.score >= 0.8 ? " — nice call." : ""}
            </p>
            {result.missing.length > 0 && (
              <p className="missing">Missing: {result.missing.join(", ")}</p>
            )}
            <div className="model-call">
              <span className="label">Model call</span>
              <p>“{current.modelCall}”</p>
              {speechSupported() && (
                <button className="ghost-btn" type="button" onClick={() => speak(current.modelCall)}>
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
