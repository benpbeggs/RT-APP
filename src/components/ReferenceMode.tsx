import { useMemo, useState } from "react";
import { PHASES } from "../data/phraseology";
import { generateValues, renderScenario, scenariosInScope } from "../lib/scenario";
import { speak, speechSupported } from "../lib/speech";
import { AircraftDiagram } from "./AircraftDiagram";

export function ReferenceMode() {
  const [query, setQuery] = useState("");
  // One consistent example aircraft across the whole reference, so the calls
  // read as a single flight rather than a jumble of unrelated registrations.
  const values = useMemo(() => generateValues(), []);

  const grouped = useMemo(
    () =>
      PHASES.map((phase) => ({
        phase,
        items: scenariosInScope(phase.id).map((t) => renderScenario(t, values)),
      })),
    [values],
  );

  const q = query.trim().toLowerCase();
  const filtered = grouped
    .map(({ phase, items }) => ({
      phase,
      items: items.filter(
        (r) =>
          q === "" ||
          r.template.title.toLowerCase().includes(q) ||
          r.modelCall.toLowerCase().includes(q) ||
          r.situation.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mode-panel">
      <div className="filters">
        <input
          type="search"
          placeholder="Search calls…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.map(({ phase, items }) => (
        <section className="phase-group" key={phase.id}>
          <div className="phase-heading">
            <span className="phase-step">{phase.step === null ? "—" : phase.step}</span>
            <div>
              <h2>{phase.label}</h2>
              <p>{phase.blurb}</p>
            </div>
          </div>

          <div className="card-list">
            {items.map((r) => (
              <article className="phrase-card" key={r.template.id}>
                <header>
                  <h3>{r.template.title}</h3>
                </header>
                <div className="ref-body">
                  <AircraftDiagram position={r.position} values={r.values} />
                  <div className="ref-text">
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
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && <p className="empty">No calls match your search.</p>}
    </div>
  );
}
