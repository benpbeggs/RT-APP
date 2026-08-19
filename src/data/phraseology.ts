// Australian radiotelephony (RT) phraseology content.
//
// Structured to follow the phraseology conventions set out in:
//   - CASA Visual Flight Rules Guide (VFRG), Chapter 5 "Radio Procedures"
//   - Airservices Australia AIP, ENR 1.1 (Communication Services / Position Reporting)
//   - ICAO Doc 4444 (PANS-ATM) standard phraseology, which the Australian
//     conventions are built on and deviate from in a few well-known ways
//     (e.g. CTAF broadcast procedures, "traffic" advisory calls).
//
// This file is the single place to update wording if it drifts from the
// current official publications — see SOURCES in src/data/sources.ts.

export type PhraseCategory =
  | "general-phrases"
  | "radio-check"
  | "taxi"
  | "departure"
  | "inbound-joining"
  | "circuit"
  | "landing"
  | "position-report"
  | "emergency";

export const CATEGORY_LABELS: Record<PhraseCategory, string> = {
  "general-phrases": "General Phrases & Readbacks",
  "radio-check": "Radio Check",
  taxi: "Taxi",
  departure: "Departure",
  "inbound-joining": "Inbound & Joining",
  circuit: "Circuit",
  landing: "Landing",
  "position-report": "Position Reports",
  emergency: "Emergency Phraseology",
};

export interface ScenarioTemplate {
  id: string;
  category: PhraseCategory;
  title: string;
  /** Situation briefing shown to the trainee, may contain {placeholders}. */
  situation: string;
  /** The model/expected call, may contain {placeholders}. */
  modelCall: string;
  /** Lower-cased keywords/phrases the trainee's answer should contain, in any order. */
  requiredElements: string[];
  /** Optional teaching note. */
  notes?: string;
  sourceRef: string;
}

export const SCENARIOS: ScenarioTemplate[] = [
  // ---- General phrases ----
  {
    id: "gen-readback",
    category: "general-phrases",
    title: "Reading back an instruction",
    situation:
      "{callsign}, tower has just said: \"{callsign}, cleared to taxi to holding point runway {runway} via taxiway alpha.\" Read the clearance back.",
    modelCall:
      "Taxi holding point runway {runway} via alpha, {callsign}",
    requiredElements: ["taxi", "holding point", "runway {runway}", "alpha", "{callsign}"],
    notes:
      "Read back all clearance/instruction elements in the order given; the callsign is normally said last on a readback.",
    sourceRef: "VFRG Ch5 – Read-back requirements",
  },
  {
    id: "gen-say-again",
    category: "general-phrases",
    title: "Requesting a repeat",
    situation: "You did not catch part of a transmission from {aerodrome} Tower. Ask them to repeat it.",
    modelCall: "{aerodrome} Tower, {callsign}, say again",
    requiredElements: ["say again", "{callsign}"],
    sourceRef: "VFRG Ch5 – Standard words and phrases",
  },
  {
    id: "gen-standby",
    category: "general-phrases",
    title: "Acknowledging with STANDBY",
    situation:
      "ATC calls you but you are mid-checklist and not ready to copy a message. Tell them to standby.",
    modelCall: "{callsign}, standby",
    requiredElements: ["standby", "{callsign}"],
    sourceRef: "VFRG Ch5 – Standard words and phrases",
  },

  // ---- Radio check ----
  {
    id: "radio-check",
    category: "radio-check",
    title: "Radio check before taxi",
    situation:
      "You are {callsign}, a {aircraftType}, at {aerodrome}, about to start up. Request a radio check on the CTAF.",
    modelCall: "{aerodrome} Traffic, {callsign}, radio check",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "radio check"],
    notes: "On a CTAF there is no ground station to reply — listen for another aircraft to confirm readability.",
    sourceRef: "VFRG Ch5 – Radio checks",
  },

  // ---- Taxi ----
  {
    id: "taxi-ctaf",
    category: "taxi",
    title: "CTAF taxi broadcast",
    situation:
      "You are {callsign}, a {aircraftType}, at {aerodrome} (non-towered, CTAF). You are about to taxi from the apron for a local flight to the training area. Make your taxi broadcast.",
    modelCall:
      "{aerodrome} Traffic, {callsign}, {aircraftType}, taxiing runway {runway}, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "taxiing", "runway {runway}"],
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },
  {
    id: "taxi-tower-request",
    category: "taxi",
    title: "Requesting taxi at a towered aerodrome",
    situation:
      "You are {callsign} at {aerodrome} (controlled). You are ready to taxi for a flight to the training area, with ATIS information Alpha. Call Ground/Tower to request taxi.",
    modelCall:
      "{aerodrome} Ground, {callsign}, {aircraftType}, information Alpha, request taxi, training area",
    requiredElements: ["{aerodrome}", "{callsign}", "information alpha", "request taxi"],
    sourceRef: "VFRG Ch5 – Radio procedures at controlled aerodromes",
  },

  // ---- Departure ----
  {
    id: "departure-ctaf-airborne",
    category: "departure",
    title: "CTAF airborne call",
    situation:
      "You are {callsign}, just airborne off runway {runway} at {aerodrome} (CTAF), tracking to the training area. Make your airborne broadcast.",
    modelCall:
      "{aerodrome} Traffic, {callsign}, airborne runway {runway}, tracking training area, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "airborne", "runway {runway}", "tracking"],
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },
  {
    id: "departure-tower-readback",
    category: "departure",
    title: "Reading back a takeoff clearance",
    situation:
      "Tower says: \"{callsign}, wind {wind}, runway {runway}, cleared for takeoff.\" Read it back.",
    modelCall: "Runway {runway}, cleared for takeoff, {callsign}",
    requiredElements: ["runway {runway}", "cleared for takeoff", "{callsign}"],
    sourceRef: "VFRG Ch5 – Read-back requirements",
  },

  // ---- Inbound & joining ----
  {
    id: "inbound-ctaf",
    category: "inbound-joining",
    title: "CTAF inbound call",
    situation:
      "You are {callsign}, {distanceNm} NM to the {compass} of {aerodrome} (CTAF), at {altitude} feet, inbound for landing. Make your inbound broadcast.",
    modelCall:
      "{aerodrome} Traffic, {callsign}, {aircraftType}, {distanceNm} miles {compass}, {altitude}, inbound, {aerodrome}",
    requiredElements: [
      "{aerodrome}",
      "traffic",
      "{callsign}",
      "{distanceNm} mile",
      "{compass}",
      "{altitude}",
      "inbound",
    ],
    sourceRef: "VFRG Ch5 – CTAF procedures / joining instructions",
  },
  {
    id: "inbound-joining-circuit",
    category: "inbound-joining",
    title: "Joining the circuit broadcast",
    situation:
      "You are {callsign}, approaching {aerodrome} (CTAF) and about to join on a {circuitLeg} for runway {runway}. Make your joining broadcast.",
    modelCall:
      "{aerodrome} Traffic, {callsign}, joining {circuitLeg} runway {runway}, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "joining", "{circuitLeg}", "runway {runway}"],
    sourceRef: "VFRG Ch5 – CTAF procedures / joining instructions",
  },
  {
    id: "inbound-tower-request",
    category: "inbound-joining",
    title: "Inbound call at a towered aerodrome",
    situation:
      "You are {callsign}, {distanceNm} NM {compass} of {aerodrome} (controlled), at {altitude} feet, with information Bravo, inbound for landing. Call Tower.",
    modelCall:
      "{aerodrome} Tower, {callsign}, {distanceNm} miles {compass}, {altitude}, information Bravo, inbound for landing",
    requiredElements: ["{aerodrome}", "tower", "{callsign}", "{distanceNm} mile", "{compass}", "information bravo", "inbound"],
    sourceRef: "VFRG Ch5 – Radio procedures at controlled aerodromes",
  },

  // ---- Circuit ----
  {
    id: "circuit-downwind",
    category: "circuit",
    title: "Downwind broadcast",
    situation: "You are {callsign}, downwind runway {runway} at {aerodrome} (CTAF), touch-and-go. Make your broadcast.",
    modelCall: "{aerodrome} Traffic, {callsign}, downwind, runway {runway}, touch and go, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "downwind", "runway {runway}"],
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },
  {
    id: "circuit-final",
    category: "circuit",
    title: "Final broadcast",
    situation: "You are {callsign}, turning final runway {runway} at {aerodrome} (CTAF) to full stop. Make your broadcast.",
    modelCall: "{aerodrome} Traffic, {callsign}, final, runway {runway}, full stop, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "final", "runway {runway}", "full stop"],
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },

  // ---- Landing ----
  {
    id: "landing-clear-runway",
    category: "landing",
    title: "Clear of runway broadcast",
    situation: "You are {callsign}, having just landed at {aerodrome} (CTAF) and are now clear of runway {runway}. Make your broadcast.",
    modelCall: "{aerodrome} Traffic, {callsign}, clear of runway {runway}, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "clear of runway {runway}"],
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },
  {
    id: "landing-tower-readback",
    category: "landing",
    title: "Reading back a landing clearance",
    situation: "Tower says: \"{callsign}, wind {wind}, runway {runway}, cleared to land.\" Read it back.",
    modelCall: "Runway {runway}, cleared to land, {callsign}",
    requiredElements: ["runway {runway}", "cleared to land", "{callsign}"],
    sourceRef: "VFRG Ch5 – Read-back requirements",
  },

  // ---- Position reports ----
  {
    id: "position-report",
    category: "position-report",
    title: "En-route position report",
    situation:
      "You are {callsign}, overhead {aerodrome} at {altitude} feet, tracking to the training area, estimating your next reporting point in {etaMin} minutes. Give a position report.",
    modelCall:
      "{callsign}, {aerodrome}, {altitude}, tracking training area, estimating next position {etaMin} minutes",
    requiredElements: ["{callsign}", "{aerodrome}", "{altitude}", "tracking", "estimating"],
    sourceRef: "AIP ENR 1.1 – Position reporting",
  },
  {
    id: "position-traffic-request",
    category: "position-report",
    title: "Requesting traffic information",
    situation: "You are {callsign} and want ATC to advise you of any other traffic in your vicinity. Make the request.",
    modelCall: "{callsign}, request traffic information",
    requiredElements: ["{callsign}", "request traffic"],
    sourceRef: "VFRG Ch5 – Standard words and phrases",
  },

  // ---- Emergency ----
  {
    id: "emergency-pan",
    category: "emergency",
    title: "PAN PAN call (urgency)",
    situation:
      "You are {callsign}, a {aircraftType} with {pob} persons on board. You have a rough-running engine but it is still producing partial power — an urgent situation, not yet a distress. You are at {altitude} feet near {aerodrome}, diverting to land. Make your urgency call.",
    modelCall:
      "Pan pan, pan pan, pan pan, {aerodrome} Traffic, {callsign}, {aircraftType}, rough running engine, {altitude}, {pob} persons on board, diverting to {aerodrome}",
    requiredElements: [
      "pan pan",
      "{callsign}",
      "{aircraftType}",
      "{altitude}",
      "{pob} persons on board",
      "diverting",
    ],
    notes:
      "PAN PAN is said three times at the start of the first transmission of an urgency situation (aircraft/persons in difficulty but no grave/imminent danger).",
    sourceRef: "VFRG Ch5 – Emergency phraseology / ICAO Doc 4444",
  },
  {
    id: "emergency-mayday",
    category: "emergency",
    title: "MAYDAY call (distress)",
    situation:
      "You are {callsign}, a {aircraftType} with {pob} persons on board. Your engine has failed completely and you are forced-landing at {altitude} feet, {distanceNm} miles {compass} of {aerodrome}. Make your distress call.",
    modelCall:
      "Mayday, mayday, mayday, {aerodrome} Traffic, {callsign}, {aircraftType}, engine failure, forced landing, {distanceNm} miles {compass} of {aerodrome}, {altitude}, {pob} persons on board",
    requiredElements: [
      "mayday",
      "{callsign}",
      "{aircraftType}",
      "engine failure",
      "forced landing",
      "{pob} persons on board",
    ],
    notes:
      "MAYDAY is said three times at the start of the first transmission of a distress situation (grave and imminent danger requiring immediate assistance).",
    sourceRef: "VFRG Ch5 – Emergency phraseology / ICAO Doc 4444",
  },
];
