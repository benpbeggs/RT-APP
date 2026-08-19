import { useMemo, useState } from "react";
import { CATEGORY_LABELS, SCENARIOS, type PhraseCategory } from "../data/phraseology";
import { renderScenario } from "../lib/scenario";
import { speak, speechSupported } from "../lib/speech";

const ALL: PhraseCategory | "all" = "all";

export function ReferenceMode() {
  const [category, setCategory] = useState<PhraseCategory | "all">(ALL);
  const [query, setQuery] = useState("");

  const rendered = useMemo(() => SCENARIOS.map(renderScenario), []);

  const filtered = rendered.filter((r) => {
    const matchesCategory = category === "all" || r.template.category === category;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      q === "" ||
      r.template.title.toLowerCase().includes(q) ||
      r.modelCall.toLowerCase().includes(q) ||
      r.situation.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="mode-panel">
      <div className="filters">
        <select value={category} onChange={(e) => setCategory(e.target.value as PhraseCategory | "all")}>
          <option value="all">All categories</option>
          {(Object.keys(CATEGORY_LABELS) as PhraseCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search phrases…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="card-list">
        {filtered.map((r) => (
          <article className="phrase-card" key={r.template.id}>
            <header>
              <span className={`chip chip-${r.template.category}`}>{CATEGORY_LABELS[r.template.category]}</span>
              <h3>{r.template.title}</h3>
            </header>
            <p className="situation">{r.situation}</p>
            <div className="model-call">
              <span className="label">Model call</span>
              <p>“{r.modelCall}”</p>
              {speechSupported() && (
                <button className="ghost-btn" onClick={() => speak(r.modelCall)}>
                  ▶ Listen
                </button>
              )}
            </div>
            {r.template.notes && <p className="notes">{r.template.notes}</p>}
            <footer>Source: {r.template.sourceRef}</footer>
          </article>
        ))}
        {filtered.length === 0 && <p className="empty">No phrases match your search.</p>}
      </div>
    </div>
  );
}
