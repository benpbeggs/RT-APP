// The flights a call can be about.
//
// Every call is recorded whole — one continuous utterance per scenario per
// flight — which is what makes it sound spoken rather than assembled. That is
// only possible with a fixed set of flights to record: the trade is unlimited
// randomness for audio that holds together, and for practising call structure
// twelve distinct flights is plenty of drilling.
//
// One flight per aerodrome, so switching flights changes the field, the
// aircraft, the runway and the rest together, the way a different sortie would.

import type { AerodromeType } from "./phraseology";

export interface Flight {
  id: string;
  aerodromeType: AerodromeType;
  callsign: string;
  aircraftType: string;
  aerodrome: string;
  /** Who you're calling: "Traffic" on a CTAF, "Tower" at a controlled field. */
  station: string;
  runway: string;
  wind: string;
  qnh: string;
  compass: string;
  distanceNm: string;
  altitude: string;
  circuitLeg: string;
  etaMin: string;
  pob: string;
}

export const FLIGHTS: Flight[] = [
  // ------------------------------------------------------- non-towered (CTAF)
  {
    id: "ctaf-cessnock",
    aerodromeType: "ctaf",
    callsign: "Cessna VH-ABC",
    aircraftType: "Cessna 172",
    aerodrome: "Cessnock",
    station: "Traffic",
    runway: "17",
    wind: "170 at 9",
    qnh: "1013",
    compass: "north",
    distanceNm: "8",
    altitude: "2500",
    circuitLeg: "downwind",
    etaMin: "10",
    pob: "2",
  },
  {
    id: "ctaf-goulburn",
    aerodromeType: "ctaf",
    callsign: "Piper VH-DKM",
    aircraftType: "Piper Warrior",
    aerodrome: "Goulburn",
    station: "Traffic",
    runway: "04",
    wind: "050 at 12",
    qnh: "1019",
    compass: "south-west",
    distanceNm: "12",
    altitude: "3500",
    circuitLeg: "crosswind",
    etaMin: "8",
    pob: "1",
  },
  {
    id: "ctaf-temora",
    aerodromeType: "ctaf",
    callsign: "Jabiru VH-FQZ",
    aircraftType: "Jabiru",
    aerodrome: "Temora",
    station: "Traffic",
    runway: "36",
    wind: "360 at 6",
    qnh: "1008",
    compass: "east",
    distanceNm: "5",
    altitude: "1500",
    circuitLeg: "base",
    etaMin: "5",
    pob: "1",
  },
  {
    id: "ctaf-mangalore",
    aerodromeType: "ctaf",
    callsign: "Diamond VH-JTR",
    aircraftType: "Diamond DA40",
    aerodrome: "Mangalore",
    station: "Traffic",
    runway: "23",
    wind: "230 at 14",
    qnh: "1021",
    compass: "north-west",
    distanceNm: "10",
    altitude: "4500",
    circuitLeg: "downwind",
    etaMin: "12",
    pob: "3",
  },
  {
    id: "ctaf-warwick",
    aerodromeType: "ctaf",
    callsign: "Cessna VH-PWL",
    aircraftType: "Cessna 172",
    aerodrome: "Warwick",
    station: "Traffic",
    runway: "07",
    wind: "070 at 8",
    qnh: "1016",
    compass: "south",
    distanceNm: "3",
    altitude: "2500",
    circuitLeg: "crosswind",
    etaMin: "3",
    pob: "2",
  },
  {
    id: "ctaf-latrobe",
    aerodromeType: "ctaf",
    callsign: "Piper VH-SYV",
    aircraftType: "Piper Warrior",
    aerodrome: "Latrobe Valley",
    station: "Traffic",
    runway: "27",
    wind: "270 at 11",
    qnh: "1011",
    compass: "north-east",
    distanceNm: "14",
    altitude: "3500",
    circuitLeg: "base",
    etaMin: "15",
    pob: "2",
  },

  // ------------------------------------------------------- towered/controlled
  {
    id: "twr-bankstown",
    aerodromeType: "controlled",
    callsign: "Cessna VH-DKM",
    aircraftType: "Cessna 172",
    aerodrome: "Bankstown",
    station: "Tower",
    runway: "29",
    wind: "290 at 10",
    qnh: "1016",
    compass: "south-west",
    distanceNm: "10",
    altitude: "1500",
    circuitLeg: "downwind",
    etaMin: "8",
    pob: "2",
  },
  {
    id: "twr-moorabbin",
    aerodromeType: "controlled",
    callsign: "Diamond VH-ABC",
    aircraftType: "Diamond DA40",
    aerodrome: "Moorabbin",
    station: "Tower",
    runway: "17",
    wind: "170 at 13",
    qnh: "1021",
    compass: "east",
    distanceNm: "8",
    altitude: "2500",
    circuitLeg: "crosswind",
    etaMin: "10",
    pob: "1",
  },
  {
    id: "twr-archerfield",
    aerodromeType: "controlled",
    callsign: "Piper VH-FQZ",
    aircraftType: "Piper Warrior",
    aerodrome: "Archerfield",
    station: "Tower",
    runway: "10",
    wind: "100 at 7",
    qnh: "1008",
    compass: "north",
    distanceNm: "5",
    altitude: "1500",
    circuitLeg: "base",
    etaMin: "5",
    pob: "3",
  },
  {
    id: "twr-jandakot",
    aerodromeType: "controlled",
    callsign: "Jabiru VH-JTR",
    aircraftType: "Jabiru",
    aerodrome: "Jandakot",
    station: "Tower",
    runway: "06",
    wind: "060 at 15",
    qnh: "1011",
    compass: "south-east",
    distanceNm: "12",
    altitude: "3500",
    circuitLeg: "downwind",
    etaMin: "12",
    pob: "1",
  },
  {
    id: "twr-parafield",
    aerodromeType: "controlled",
    callsign: "Cessna VH-SYV",
    aircraftType: "Cessna 172",
    aerodrome: "Parafield",
    station: "Tower",
    runway: "21",
    wind: "210 at 9",
    qnh: "1019",
    compass: "west",
    distanceNm: "3",
    altitude: "2500",
    circuitLeg: "crosswind",
    etaMin: "3",
    pob: "2",
  },
  {
    id: "twr-camden",
    aerodromeType: "controlled",
    callsign: "Diamond VH-PWL",
    aircraftType: "Diamond DA40",
    aerodrome: "Camden",
    station: "Tower",
    runway: "24",
    wind: "240 at 6",
    qnh: "1013",
    compass: "north-west",
    distanceNm: "14",
    altitude: "4500",
    circuitLeg: "base",
    etaMin: "15",
    pob: "3",
  },
];

export const FLIGHTS_BY_TYPE: Record<AerodromeType, Flight[]> = {
  ctaf: FLIGHTS.filter((f) => f.aerodromeType === "ctaf"),
  controlled: FLIGHTS.filter((f) => f.aerodromeType === "controlled"),
};

/** Identifies one recorded call: this scenario, spoken for this flight. */
export const callId = (scenarioId: string, flightId: string) => `${scenarioId}|${flightId}`;

/**
 * The callsign as it appears in a radio call: "Piper VH-DKM" -> "Piper DKM".
 *
 * VH- is the Australian nationality prefix. It belongs to the registration —
 * which is why the scenario briefing still names the aircraft in full — but it
 * is not part of the callsign on the air, so a written call should not carry
 * it either.
 */
export const radioCallsign = (callsign: string) => callsign.replace(" VH-", " ");
