// Australian radiotelephony (RT) phraseology content, ordered by phase of flight.
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

/** Where the aircraft physically is when the call is made — drives the diagram. */
export type PositionKind =
  | "apron"
  | "taxiway"
  | "holding-point"
  | "runway"
  | "upwind"
  | "crosswind"
  | "downwind"
  | "base"
  | "final"
  | "clear-of-runway"
  | "overhead"
  | "circuit-leg" // resolves to whichever leg the scenario generated
  | "bearing"; // out on a radial, uses compass + distance

export type PhaseId =
  | "startup"
  | "taxi"
  | "departure"
  | "enroute"
  | "inbound"
  | "circuit"
  | "landing"
  | "general"
  | "emergency";

export interface Phase {
  id: PhaseId;
  /** Position in the flight sequence, or null for non-sequential groups. */
  step: number | null;
  label: string;
  blurb: string;
}

/** The order of operations for a typical local VFR flight. */
export const PHASES: Phase[] = [
  {
    id: "startup",
    step: 1,
    label: "Startup",
    blurb: "Before you move — confirm the radio works and you're on the right frequency.",
  },
  {
    id: "taxi",
    step: 2,
    label: "Taxi",
    blurb: "Leaving the apron for the runway.",
  },
  {
    id: "departure",
    step: 3,
    label: "Departure",
    blurb: "Holding point, takeoff, and getting airborne.",
  },
  {
    id: "enroute",
    step: 4,
    label: "En Route",
    blurb: "Clear of the circuit, tracking to the training area.",
  },
  {
    id: "inbound",
    step: 5,
    label: "Inbound",
    blurb: "Returning to the field and joining the circuit.",
  },
  {
    id: "circuit",
    step: 6,
    label: "Circuit",
    blurb: "Flying the pattern — crosswind, downwind, base, final.",
  },
  {
    id: "landing",
    step: 7,
    label: "Landing",
    blurb: "Touchdown and vacating the runway.",
  },
  {
    id: "general",
    step: null,
    label: "General Phrases",
    blurb: "Non-sequential — usable at any point in the flight.",
  },
  {
    id: "emergency",
    step: null,
    label: "Emergency",
    blurb: "Non-sequential — urgency and distress calls.",
  },
];

export const PHASE_BY_ID: Record<PhaseId, Phase> = Object.fromEntries(
  PHASES.map((p) => [p.id, p]),
) as Record<PhaseId, Phase>;

export interface ScenarioTemplate {
  id: string;
  phase: PhaseId;
  title: string;
  /** Where the aircraft is when making this call. */
  position: PositionKind;
  /** Situation briefing shown to the trainee, may contain {placeholders}. */
  situation: string;
  /** The model/expected call, may contain {placeholders}. */
  modelCall: string;
  /** Key elements the trainee's answer should contain, in any order. */
  requiredElements: string[];
  /** Optional teaching note. */
  notes?: string;
  sourceRef: string;
}

/** Ordered by phase of flight, then by order within the phase. */
export const SCENARIOS: ScenarioTemplate[] = [
  // ------------------------------------------------------------------ 1. STARTUP
  {
    id: "startup-radio-check-ctaf",
    phase: "startup",
    title: "Radio check on the CTAF",
    position: "apron",
    situation:
      "You are {callsign}, a {aircraftType}, on the apron at {aerodrome} (non-towered, CTAF). You have just started up. Check your radio is working.",
    modelCall: "{aerodrome} Traffic, {callsign}, radio check",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "radio check"],
    notes:
      "On a CTAF there is no ground station to answer — you are relying on another aircraft to confirm readability.",
    sourceRef: "VFRG Ch5 – Radio checks",
  },
  {
    id: "startup-radio-check-tower",
    phase: "startup",
    title: "Radio check with a ground station",
    position: "apron",
    situation:
      "You are {callsign} on the apron at {aerodrome} (controlled). Request a radio check from Ground.",
    modelCall: "{aerodrome} Ground, {callsign}, radio check",
    requiredElements: ["{aerodrome}", "ground", "{callsign}", "radio check"],
    notes: "Readability is reported on a scale of 1 (unreadable) to 5 (perfectly readable).",
    sourceRef: "VFRG Ch5 – Radio checks",
  },

  // --------------------------------------------------------------------- 2. TAXI
  {
    id: "taxi-ctaf",
    phase: "taxi",
    title: "CTAF taxi broadcast",
    position: "taxiway",
    situation:
      "You are {callsign}, a {aircraftType}, at {aerodrome} (CTAF). You are about to taxi from the apron for a local flight to the training area, using runway {runway}. Make your taxi broadcast.",
    modelCall: "{aerodrome} Traffic, {callsign}, {aircraftType}, taxiing runway {runway}, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "taxiing", "runway {runway}"],
    notes:
      "CTAF broadcasts start and end with the location — it tells anyone on a shared frequency which field you're at.",
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },
  {
    id: "taxi-tower-request",
    phase: "taxi",
    title: "Requesting taxi at a towered aerodrome",
    position: "apron",
    situation:
      "You are {callsign} at {aerodrome} (controlled), ready to taxi for a flight to the training area. You have listened to ATIS information Alpha. Call Ground.",
    modelCall:
      "{aerodrome} Ground, {callsign}, {aircraftType}, information Alpha, request taxi, training area",
    requiredElements: ["{aerodrome}", "ground", "{callsign}", "information alpha", "request taxi"],
    notes: "Quoting the ATIS code tells the controller you already have the current field information.",
    sourceRef: "VFRG Ch5 – Radio procedures at controlled aerodromes",
  },
  {
    id: "taxi-readback",
    phase: "taxi",
    title: "Reading back a taxi clearance",
    position: "taxiway",
    situation:
      'Ground replies: "{callsign}, taxi to holding point runway {runway} via taxiway alpha." Read the clearance back.',
    modelCall: "Taxi holding point runway {runway} via alpha, {callsign}",
    requiredElements: ["taxi", "holding point", "runway {runway}", "alpha", "{callsign}"],
    notes:
      "Read back all clearance elements in the order given. On a readback the callsign normally goes last.",
    sourceRef: "VFRG Ch5 – Read-back requirements",
  },

  // ---------------------------------------------------------------- 3. DEPARTURE
  {
    id: "departure-ready",
    phase: "departure",
    title: "Ready at the holding point",
    position: "holding-point",
    situation:
      "You are {callsign}, holding short of runway {runway} at {aerodrome} (controlled), run-ups complete and ready for departure. Call Tower.",
    modelCall: "{aerodrome} Tower, {callsign}, ready, runway {runway}",
    requiredElements: ["{aerodrome}", "tower", "{callsign}", "ready", "runway {runway}"],
    sourceRef: "VFRG Ch5 – Radio procedures at controlled aerodromes",
  },
  {
    id: "departure-entering-runway",
    phase: "departure",
    title: "Entering the runway (CTAF)",
    position: "holding-point",
    situation:
      "You are {callsign} at the holding point for runway {runway} at {aerodrome} (CTAF), about to line up and depart. Make your broadcast.",
    modelCall: "{aerodrome} Traffic, {callsign}, entering runway {runway}, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "entering runway {runway}"],
    notes: "At a non-towered field nobody clears you — you broadcast your intentions and stay alert.",
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },
  {
    id: "departure-takeoff-readback",
    phase: "departure",
    title: "Reading back a takeoff clearance",
    position: "runway",
    situation: 'Tower says: "{callsign}, wind {wind}, runway {runway}, cleared for takeoff." Read it back.',
    modelCall: "Runway {runway}, cleared for takeoff, {callsign}",
    requiredElements: ["runway {runway}", "cleared for takeoff", "{callsign}"],
    notes:
      "Takeoff and landing clearances must always be read back in full — they are the highest-risk instructions on the frequency.",
    sourceRef: "VFRG Ch5 – Read-back requirements",
  },
  {
    id: "departure-airborne",
    phase: "departure",
    title: "CTAF airborne broadcast",
    position: "upwind",
    situation:
      "You are {callsign}, just airborne off runway {runway} at {aerodrome} (CTAF), tracking to the training area. Make your airborne broadcast.",
    modelCall:
      "{aerodrome} Traffic, {callsign}, airborne runway {runway}, tracking training area, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "airborne", "runway {runway}", "tracking"],
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },
  {
    id: "departure-leaving-circuit",
    phase: "departure",
    title: "Departing the circuit",
    position: "crosswind",
    situation:
      "You are {callsign}, climbing through {altitude} feet after departing {aerodrome} (CTAF), now leaving the circuit to the {compass}. Make your broadcast.",
    modelCall:
      "{aerodrome} Traffic, {callsign}, departing the circuit to the {compass}, climbing {altitude}, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "departing", "{compass}", "{altitude}"],
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },

  // ----------------------------------------------------------------- 4. EN ROUTE
  {
    id: "enroute-position-report",
    phase: "enroute",
    title: "En-route position report",
    position: "bearing",
    situation:
      "You are {callsign}, {distanceNm} NM {compass} of {aerodrome} at {altitude} feet, tracking to the training area, estimating your next reporting point in {etaMin} minutes. Give a position report.",
    modelCall:
      "{callsign}, {distanceNm} miles {compass} of {aerodrome}, {altitude}, tracking training area, estimating next position {etaMin} minutes",
    requiredElements: ["{callsign}", "{distanceNm} mile", "{compass}", "{altitude}", "tracking", "estimating"],
    notes: "Position reports follow a fixed order: who you are, where you are, what level, where next and when.",
    sourceRef: "AIP ENR 1.1 – Position reporting",
  },
  {
    id: "enroute-traffic-request",
    phase: "enroute",
    title: "Requesting traffic information",
    position: "bearing",
    situation: "You are {callsign} and want ATC to advise you of other traffic in your vicinity. Make the request.",
    modelCall: "{callsign}, request traffic information",
    requiredElements: ["{callsign}", "request traffic"],
    sourceRef: "VFRG Ch5 – Standard words and phrases",
  },

  // ------------------------------------------------------------------ 5. INBOUND
  {
    id: "inbound-ctaf",
    phase: "inbound",
    title: "CTAF inbound call",
    position: "bearing",
    situation:
      "You are {callsign}, a {aircraftType}, {distanceNm} NM to the {compass} of {aerodrome} (CTAF), at {altitude} feet, inbound for landing. Make your inbound broadcast.",
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
    notes: "Make the inbound call in time for other traffic to react — typically around 10 NM out.",
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },
  {
    id: "inbound-tower-request",
    phase: "inbound",
    title: "Inbound call at a towered aerodrome",
    position: "bearing",
    situation:
      "You are {callsign}, {distanceNm} NM {compass} of {aerodrome} (controlled), at {altitude} feet, with ATIS information Bravo, inbound for landing. Call Tower.",
    modelCall:
      "{aerodrome} Tower, {callsign}, {distanceNm} miles {compass}, {altitude}, information Bravo, inbound for landing",
    requiredElements: [
      "{aerodrome}",
      "tower",
      "{callsign}",
      "{distanceNm} mile",
      "{compass}",
      "information bravo",
      "inbound",
    ],
    sourceRef: "VFRG Ch5 – Radio procedures at controlled aerodromes",
  },
  {
    id: "inbound-joining",
    phase: "inbound",
    title: "Joining the circuit",
    position: "circuit-leg",
    situation:
      "You are {callsign}, approaching {aerodrome} (CTAF) and about to join {circuitLeg} for runway {runway}. Make your joining broadcast.",
    modelCall: "{aerodrome} Traffic, {callsign}, joining {circuitLeg} runway {runway}, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "joining", "{circuitLeg}", "runway {runway}"],
    sourceRef: "VFRG Ch5 – CTAF procedures / joining instructions",
  },

  // ------------------------------------------------------------------ 6. CIRCUIT
  {
    id: "circuit-crosswind",
    phase: "circuit",
    title: "Crosswind broadcast",
    position: "crosswind",
    situation: "You are {callsign}, turning crosswind for runway {runway} at {aerodrome} (CTAF). Make your broadcast.",
    modelCall: "{aerodrome} Traffic, {callsign}, crosswind, runway {runway}, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "crosswind", "runway {runway}"],
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },
  {
    id: "circuit-downwind",
    phase: "circuit",
    title: "Downwind broadcast",
    position: "downwind",
    situation:
      "You are {callsign}, downwind for runway {runway} at {aerodrome} (CTAF), planning a touch-and-go. Make your broadcast.",
    modelCall: "{aerodrome} Traffic, {callsign}, downwind, runway {runway}, touch and go, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "downwind", "runway {runway}", "touch and go"],
    notes: "State your intention (touch and go / full stop) so other circuit traffic can plan around you.",
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },
  {
    id: "circuit-base",
    phase: "circuit",
    title: "Base broadcast",
    position: "base",
    situation: "You are {callsign}, turning base for runway {runway} at {aerodrome} (CTAF). Make your broadcast.",
    modelCall: "{aerodrome} Traffic, {callsign}, base, runway {runway}, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "base", "runway {runway}"],
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },
  {
    id: "circuit-final",
    phase: "circuit",
    title: "Final broadcast",
    position: "final",
    situation:
      "You are {callsign}, turning final for runway {runway} at {aerodrome} (CTAF), landing to a full stop. Make your broadcast.",
    modelCall: "{aerodrome} Traffic, {callsign}, final, runway {runway}, full stop, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "final", "runway {runway}", "full stop"],
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },

  // ------------------------------------------------------------------ 7. LANDING
  {
    id: "landing-readback",
    phase: "landing",
    title: "Reading back a landing clearance",
    position: "final",
    situation: 'Tower says: "{callsign}, wind {wind}, runway {runway}, cleared to land." Read it back.',
    modelCall: "Runway {runway}, cleared to land, {callsign}",
    requiredElements: ["runway {runway}", "cleared to land", "{callsign}"],
    sourceRef: "VFRG Ch5 – Read-back requirements",
  },
  {
    id: "landing-clear-of-runway",
    phase: "landing",
    title: "Clear of the runway",
    position: "clear-of-runway",
    situation:
      "You are {callsign}, having landed at {aerodrome} (CTAF) and now fully clear of runway {runway}. Make your broadcast.",
    modelCall: "{aerodrome} Traffic, {callsign}, clear of runway {runway}, {aerodrome}",
    requiredElements: ["{aerodrome}", "traffic", "{callsign}", "clear of runway {runway}"],
    notes: "This call tells following traffic the runway is available again — don't forget it.",
    sourceRef: "VFRG Ch5 – CTAF procedures",
  },

  // ------------------------------------------------------------- GENERAL PHRASES
  {
    id: "general-say-again",
    phase: "general",
    title: "Requesting a repeat",
    position: "overhead",
    situation: "You did not catch part of a transmission from {aerodrome} Tower. Ask them to repeat it.",
    modelCall: "{aerodrome} Tower, {callsign}, say again",
    requiredElements: ["say again", "{callsign}"],
    sourceRef: "VFRG Ch5 – Standard words and phrases",
  },
  {
    id: "general-standby",
    phase: "general",
    title: "Acknowledging with STANDBY",
    position: "overhead",
    situation: "ATC calls you but you are mid-checklist and not ready to copy a message. Tell them to standby.",
    modelCall: "{callsign}, standby",
    requiredElements: ["standby", "{callsign}"],
    notes: "STANDBY means wait and I will call you — it is not an acknowledgement of the message.",
    sourceRef: "VFRG Ch5 – Standard words and phrases",
  },

  // ---------------------------------------------------------------- EMERGENCY
  {
    id: "emergency-pan",
    phase: "emergency",
    title: "PAN PAN call (urgency)",
    position: "bearing",
    situation:
      "You are {callsign}, a {aircraftType} with {pob} persons on board. Your engine is running rough but still producing partial power — urgent, but not yet a distress. You are at {altitude} feet, {distanceNm} NM {compass} of {aerodrome}, diverting to land. Make your urgency call.",
    modelCall:
      "Pan pan, pan pan, pan pan, {aerodrome} Traffic, {callsign}, {aircraftType}, rough running engine, {distanceNm} miles {compass}, {altitude}, {pob} persons on board, diverting to {aerodrome}",
    requiredElements: [
      "pan pan",
      "{callsign}",
      "{aircraftType}",
      "{altitude}",
      "{pob} persons on board",
      "diverting",
    ],
    notes:
      "PAN PAN is said three times at the start of the first transmission of an urgency situation — a difficulty that does not yet involve grave or imminent danger.",
    sourceRef: "VFRG Ch5 – Emergency phraseology / ICAO Doc 4444",
  },
  {
    id: "emergency-mayday",
    phase: "emergency",
    title: "MAYDAY call (distress)",
    position: "bearing",
    situation:
      "You are {callsign}, a {aircraftType} with {pob} persons on board. Your engine has failed completely and you are forced-landing from {altitude} feet, {distanceNm} NM {compass} of {aerodrome}. Make your distress call.",
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
      "MAYDAY is said three times at the start of the first transmission of a distress situation — grave and imminent danger requiring immediate assistance.",
    sourceRef: "VFRG Ch5 – Emergency phraseology / ICAO Doc 4444",
  },
];

/** Scenarios for a phase, in sequence order. */
export function scenariosForPhase(phase: PhaseId): ScenarioTemplate[] {
  return SCENARIOS.filter((s) => s.phase === phase);
}
