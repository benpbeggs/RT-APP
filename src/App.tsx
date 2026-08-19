import { useState } from "react";
import "./App.css";
import { ReferenceMode } from "./components/ReferenceMode";
import { TrainerMode } from "./components/TrainerMode";
import { SourcesPanel } from "./components/SourcesPanel";

type Tab = "trainer" | "reference" | "sources";

function App() {
  const [tab, setTab] = useState<Tab>("trainer");

  return (
    <div className="app">
      <header className="app-header">
        <h1>RT Trainer</h1>
        <p className="tagline">Australian radiotelephony practice for VFR pilots</p>
      </header>

      <nav className="tabs">
        <button className={tab === "trainer" ? "active" : ""} onClick={() => setTab("trainer")}>
          Trainer
        </button>
        <button className={tab === "reference" ? "active" : ""} onClick={() => setTab("reference")}>
          Reference
        </button>
        <button className={tab === "sources" ? "active" : ""} onClick={() => setTab("sources")}>
          Sources & Accuracy
        </button>
      </nav>

      <main>
        {tab === "trainer" && <TrainerMode />}
        {tab === "reference" && <ReferenceMode />}
        {tab === "sources" && <SourcesPanel />}
      </main>
    </div>
  );
}

export default App;
