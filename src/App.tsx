import { useEffect, useState } from "react";
import "./App.css";
import { ReferenceMode } from "./components/ReferenceMode";
import { TrainerMode } from "./components/TrainerMode";
import { SourcesPanel } from "./components/SourcesPanel";
import {
  radioEffectsEnabled,
  setRadioEffects,
  stopTransmission,
  subscribeAudioSource,
  type AudioSource,
} from "./lib/radio";

type Tab = "trainer" | "reference" | "sources";

function App() {
  const [tab, setTab] = useState<Tab>("trainer");
  const [radioFx, setRadioFx] = useState(radioEffectsEnabled);
  const [audioSource, setAudioSource] = useState<AudioSource>("recorded");

  useEffect(() => subscribeAudioSource(setAudioSource), []);

  function toggleRadioFx() {
    const next = !radioFx;
    stopTransmission();
    setRadioEffects(next);
    setRadioFx(next);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>RT Trainer</h1>
          <p className="tagline">Australian radiotelephony practice for VFR pilots</p>
        </div>
        <div className="header-controls">
          {audioSource === "synthesised" && (
            <span className="audio-warning" role="status">
              Recorded audio unavailable — using this browser's voice
            </span>
          )}
          <button
            type="button"
            className={`fx-toggle ${radioFx ? "on" : ""}`}
            onClick={toggleRadioFx}
            aria-pressed={radioFx}
            title={
              radioFx
                ? "Playback sounds like a VHF transmission. Switch off for clearer audio."
                : "Playback is clear speech. Switch on for radio noise and squelch."
            }
          >
            <span className="fx-dot" aria-hidden="true" />
            Radio FX {radioFx ? "on" : "off"}
          </button>
        </div>
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
