import type { ScenarioTemplate } from "../data/phraseology";

const AERODROMES = ["Bankstown", "Moorabbin", "Archerfield", "Jandakot", "Parafield", "Camden"];
const AIRCRAFT_TYPES = ["Cessna 172", "Piper Warrior", "Diamond DA40", "Jabiru"];
const RUNWAYS = ["18", "25", "07", "36", "22", "04"];
const WINDS = ["180 at 10", "250 at 8", "070 at 12", "360 at 6"];
const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const CIRCUIT_LEGS = ["crosswind", "downwind", "base"];

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomRegistration(): string {
  let suffix = "";
  for (let i = 0; i < 3; i++) suffix += pick(LETTERS.split(""));
  return `VH-${suffix}`;
}

export interface GeneratedValues {
  callsign: string;
  aircraftType: string;
  aerodrome: string;
  runway: string;
  wind: string;
  compass: string;
  distanceNm: string;
  altitude: string;
  circuitLeg: string;
  etaMin: string;
  pob: string;
}

export function generateValues(): GeneratedValues {
  const aircraftType = pick(AIRCRAFT_TYPES);
  const reg = randomRegistration();
  return {
    callsign: `${aircraftType.split(" ")[0]} ${reg}`,
    aircraftType,
    aerodrome: pick(AERODROMES),
    runway: pick(RUNWAYS),
    wind: pick(WINDS),
    compass: pick(COMPASS),
    distanceNm: String(2 + Math.floor(Math.random() * 13)),
    altitude: `${1 + Math.floor(Math.random() * 4)}500`,
    circuitLeg: pick(CIRCUIT_LEGS),
    etaMin: String(3 + Math.floor(Math.random() * 12)),
    pob: String(1 + Math.floor(Math.random() * 3)),
  };
}

export function fill(template: string, values: GeneratedValues): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = (values as unknown as Record<string, string>)[key];
    return v ?? `{${key}}`;
  });
}

export interface RenderedScenario {
  template: ScenarioTemplate;
  values: GeneratedValues;
  situation: string;
  modelCall: string;
  requiredElements: string[];
}

export function renderScenario(template: ScenarioTemplate): RenderedScenario {
  const values = generateValues();
  return {
    template,
    values,
    situation: fill(template.situation, values),
    modelCall: fill(template.modelCall, values),
    requiredElements: template.requiredElements.map((e) => fill(e, values).toLowerCase()),
  };
}

export interface ScoreResult {
  matched: string[];
  missing: string[];
  score: number; // 0..1
}

export function scoreAnswer(answer: string, requiredElements: string[]): ScoreResult {
  const normalized = answer.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const el of requiredElements) {
    if (normalized.includes(el)) matched.push(el);
    else missing.push(el);
  }
  return {
    matched,
    missing,
    score: requiredElements.length === 0 ? 1 : matched.length / requiredElements.length,
  };
}
