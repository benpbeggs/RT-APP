import type { PositionKind } from "../data/phraseology";
import type { GeneratedValues } from "../lib/scenario";

/** Plan-form aircraft silhouette, nose up, centred on the origin. */
const PLANE_PATH =
  "M 0 -11 L 2.3 -3.5 L 12 2 L 12 4.8 L 2.3 1.8 L 2.1 7.5 L 5.2 10.2 L 5.2 11.8 L 0 10.2 L -5.2 11.8 L -5.2 10.2 L -2.1 7.5 L -2.3 1.8 L -12 4.8 L -12 2 L -2.3 -3.5 Z";

const COMPASS_DEG: Record<string, number> = {
  north: 0,
  "north-east": 45,
  east: 90,
  "south-east": 135,
  south: 180,
  "south-west": 225,
  west: 270,
  "north-west": 315,
};

interface Spot {
  x: number;
  y: number;
  /** Heading in degrees, 0 = up/north. */
  rot: number;
}

function Aircraft({ spot, onGround }: { spot: Spot; onGround: boolean }) {
  return (
    <g transform={`translate(${spot.x} ${spot.y}) rotate(${spot.rot})`}>
      <circle className="dg-pulse" r="20" />
      <path className={`dg-plane ${onGround ? "on-ground" : "airborne"}`} d={PLANE_PATH} />
    </g>
  );
}

// ---------------------------------------------------------------- circuit view
//
// Close-in plan view for calls made on the ground or in the circuit. The runway
// runs vertically with the landing threshold at the bottom, so "up" is the
// takeoff and upwind direction and the left-hand circuit sits to the west.

type CircuitPosition = Exclude<PositionKind, "bearing" | "circuit-leg">;

const CIRCUIT_SPOTS: Record<CircuitPosition, Spot & { label: string }> = {
  apron: { x: 150, y: 248, rot: 35, label: "On the apron" },
  taxiway: { x: 181, y: 253, rot: 72, label: "Taxiing" },
  "holding-point": { x: 194, y: 257, rot: 86, label: "Holding point" },
  runway: { x: 210, y: 232, rot: 0, label: "On the runway" },
  upwind: { x: 210, y: 62, rot: 0, label: "Upwind" },
  crosswind: { x: 160, y: 58, rot: 270, label: "Crosswind" },
  downwind: { x: 120, y: 162, rot: 180, label: "Downwind" },
  base: { x: 166, y: 295, rot: 90, label: "Base" },
  final: { x: 210, y: 302, rot: 0, label: "Final" },
  "clear-of-runway": { x: 187, y: 243, rot: 248, label: "Clear of the runway" },
  overhead: { x: 210, y: 170, rot: 0, label: "In flight" },
};

const ON_GROUND: CircuitPosition[] = [
  "apron",
  "taxiway",
  "holding-point",
  "runway",
  "clear-of-runway",
];

function CircuitView({ position }: { position: CircuitPosition }) {
  const spot = CIRCUIT_SPOTS[position];
  return (
    <svg viewBox="58 18 304 312" role="img" aria-label={`Aircraft position: ${spot.label}`}>
      {/* Circuit pattern — the right edge is the runway centreline extended */}
      <polyline
        className="dg-circuit"
        points="210,295 210,45 120,45 120,295 210,295"
        strokeLinejoin="round"
      />

      <rect className="dg-runway" x="202" y="75" width="16" height="190" rx="1" />
      <line className="dg-centreline" x1="210" y1="88" x2="210" y2="252" />

      <rect className="dg-apron" x="124" y="232" width="54" height="32" rx="3" />
      <line className="dg-taxiway" x1="178" y1="252" x2="202" y2="255" />

      <text className="dg-leg" x="165" y="34" textAnchor="middle">CROSSWIND</text>
      <text className="dg-leg" x="165" y="320" textAnchor="middle">BASE</text>
      <text className="dg-leg" x="101" y="170" textAnchor="middle" transform="rotate(-90 101 170)">
        DOWNWIND
      </text>
      <text className="dg-leg" x="228" y="70" textAnchor="start">UPWIND</text>
      <text className="dg-leg" x="228" y="300" textAnchor="start">FINAL</text>
      <text className="dg-field" x="151" y="227" textAnchor="middle">APRON</text>

      <Aircraft spot={spot} onGround={ON_GROUND.includes(position)} />
    </svg>
  );
}

// ------------------------------------------------------------------ area view
//
// Wide view for calls made away from the field, where what matters is the
// bearing and distance rather than which circuit leg you're on.

const AREA_CENTRE = { cx: 150, cy: 150 };
const AREA_RADIUS = 100;

function AreaView({ values }: { values: GeneratedValues }) {
  const deg = COMPASS_DEG[values.compass] ?? 0;
  const rad = (deg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  const x = AREA_CENTRE.cx + AREA_RADIUS * sin;
  const y = AREA_CENTRE.cy - AREA_RADIUS * cos;

  // Distance label sits along the radial, nudged perpendicular to clear the line.
  const labelX = AREA_CENTRE.cx + AREA_RADIUS * 0.52 * sin + 16 * cos;
  const labelY = AREA_CENTRE.cy - AREA_RADIUS * 0.52 * cos + 16 * sin;

  return (
    <svg
      viewBox="0 0 300 300"
      role="img"
      aria-label={`Aircraft position: ${values.distanceNm} nautical miles ${values.compass} of ${values.aerodrome}`}
    >
      <circle className="dg-ring" cx={AREA_CENTRE.cx} cy={AREA_CENTRE.cy} r="55" />
      <circle className="dg-ring" cx={AREA_CENTRE.cx} cy={AREA_CENTRE.cy} r={AREA_RADIUS} />

      <text className="dg-compass" x="150" y="22" textAnchor="middle">N</text>
      <text className="dg-compass" x="150" y="288" textAnchor="middle">S</text>
      <text className="dg-compass" x="284" y="155" textAnchor="middle">E</text>
      <text className="dg-compass" x="16" y="155" textAnchor="middle">W</text>

      {/* The aerodrome, reduced to a runway symbol at this scale */}
      <g transform={`translate(${AREA_CENTRE.cx} ${AREA_CENTRE.cy}) rotate(35)`}>
        <rect className="dg-runway" x="-4" y="-17" width="8" height="34" rx="1" />
      </g>
      <text className="dg-field" x="150" y="182" textAnchor="middle">
        {values.aerodrome.toUpperCase()}
      </text>

      <line className="dg-radial" x1={AREA_CENTRE.cx} y1={AREA_CENTRE.cy} x2={x} y2={y} />
      <text className="dg-distance" x={labelX} y={labelY} textAnchor="middle">
        {values.distanceNm} NM
      </text>

      {/* Nose pointed back at the field */}
      <Aircraft spot={{ x, y, rot: (deg + 180) % 360 }} onGround={false} />
    </svg>
  );
}

// ----------------------------------------------------------------------------

interface Props {
  position: PositionKind;
  values: GeneratedValues;
}

export function AircraftDiagram({ position, values }: Props) {
  const isArea = position === "bearing";
  const circuitPosition: CircuitPosition =
    position === "circuit-leg" ? "downwind" : (position as CircuitPosition);

  const caption = isArea
    ? `${values.distanceNm} NM ${values.compass}`
    : CIRCUIT_SPOTS[circuitPosition].label;

  return (
    <figure className="diagram">
      {isArea ? <AreaView values={values} /> : <CircuitView position={circuitPosition} />}
      <figcaption>
        <span className="dg-caption-pos">{caption}</span>
        <span className="dg-caption-field">
          {isArea
            ? `${values.aerodrome} · area view`
            : `${values.aerodrome} · RWY ${values.runway} · left-hand circuit`}
        </span>
      </figcaption>
    </figure>
  );
}
