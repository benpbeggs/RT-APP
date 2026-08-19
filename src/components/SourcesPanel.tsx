import { ACCURACY_DISCLAIMER, SOURCES } from "../data/sources";

export function SourcesPanel() {
  return (
    <div className="mode-panel sources-panel">
      <div className="disclaimer">
        <strong>Accuracy notice</strong>
        <p>{ACCURACY_DISCLAIMER}</p>
      </div>
      <h3>Content is structured from</h3>
      <ul className="source-list">
        {SOURCES.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong>
            <p>{s.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
