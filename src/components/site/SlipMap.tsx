import slipSeed from "../../../scripts/seed-data/slips.json";

type Point = { x: number; y: number };
type SeedSlip = {
  slip_number: string;
  tier: "Premium" | "Standard" | "Restricted";
  slip_type: "open" | "covered" | "end-tie" | "side-tie";
  position_polygon: Point[];
};

const SLIPS: SeedSlip[] = (slipSeed as { slips: SeedSlip[] }).slips;

/* Compute bounds from seed so the viewBox always frames every slip. */
const ALL_POINTS = SLIPS.flatMap((s) => s.position_polygon);
const MIN_X = Math.min(...ALL_POINTS.map((p) => p.x));
const MIN_Y = Math.min(...ALL_POINTS.map((p) => p.y));
const MAX_X = Math.max(...ALL_POINTS.map((p) => p.x));
const MAX_Y = Math.max(...ALL_POINTS.map((p) => p.y));

const PAD = 28;
const VIEW_X = MIN_X - PAD;
const VIEW_Y = MIN_Y - PAD;
const VIEW_W = MAX_X - MIN_X + PAD * 2;
const VIEW_H = MAX_Y - MIN_Y + PAD * 2;

function centroid(poly: Point[]): Point {
  const x = poly.reduce((acc, p) => acc + p.x, 0) / poly.length;
  const y = poly.reduce((acc, p) => acc + p.y, 0) / poly.length;
  return { x, y };
}

function dockLabelPosition(dock: string): Point {
  const docked = SLIPS.filter((s) => s.slip_number.startsWith(dock));
  const xs = docked.flatMap((s) => s.position_polygon.map((p) => p.x));
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: MIN_Y - 10,
  };
}

/**
 * Read-only marina slip map. Renders every slip polygon plus a small
 * slip-number label. Public-safe: no assignment data, no occupancy,
 * no holder info. Hover/focus brings the slip number forward via CSS.
 *
 * Mobile pinch-zoom works natively on the wrapping `<svg>` since we
 * size it with `width="100%" height="auto"` and a viewBox.
 */
export function SlipMap() {
  const docks = ["A", "B", "C"] as const;
  return (
    <figure className="rounded-xl border border-slate-100 bg-paper p-4 sm:p-6">
      <div className="overflow-auto">
        <svg
          role="img"
          aria-label="Wharfside Marina slip layout: three docks (A, B, C) with 86 slips total."
          viewBox={`${VIEW_X} ${VIEW_Y} ${VIEW_W} ${VIEW_H}`}
          xmlns="http://www.w3.org/2000/svg"
          className="block h-auto w-full min-w-[640px]"
        >
          {/* Background water tint */}
          <rect
            x={VIEW_X}
            y={VIEW_Y}
            width={VIEW_W}
            height={VIEW_H}
            fill="#f0f4f8"
          />

          {/* Dock spines */}
          {docks.map((dock) => {
            const docked = SLIPS.filter((s) => s.slip_number.startsWith(dock));
            const xs = docked.flatMap((s) => s.position_polygon.map((p) => p.x));
            const ys = docked.flatMap((s) => s.position_polygon.map((p) => p.y));
            const x = (Math.min(...xs) + Math.max(...xs)) / 2;
            return (
              <line
                key={`${dock}-spine`}
                x1={x}
                x2={x}
                y1={Math.min(...ys) - 4}
                y2={Math.max(...ys) + 4}
                stroke="#bcccdc"
                strokeWidth={1.5}
                strokeDasharray="3 4"
              />
            );
          })}

          {/* Slips */}
          {SLIPS.map((s) => {
            const c = centroid(s.position_polygon);
            const points = s.position_polygon
              .map((p) => `${p.x},${p.y}`)
              .join(" ");
            const fill =
              s.tier === "Premium"
                ? "#e8dcc4"
                : s.tier === "Restricted"
                  ? "#f1f5f9"
                  : "#ffffff";
            return (
              <g key={s.slip_number} className="slip">
                <title>
                  {s.slip_number} — {s.tier} {s.slip_type}
                </title>
                <polygon
                  points={points}
                  fill={fill}
                  stroke="#1a3a5c"
                  strokeWidth={0.8}
                />
                <text
                  x={c.x}
                  y={c.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={6}
                  fontFamily="ui-monospace, monospace"
                  fill="#1a3a5c"
                  pointerEvents="none"
                >
                  {s.slip_number}
                </text>
              </g>
            );
          })}

          {/* Dock labels */}
          {docks.map((dock) => {
            const pos = dockLabelPosition(dock);
            return (
              <text
                key={`${dock}-label`}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                fontSize={11}
                fontFamily="ui-sans-serif, sans-serif"
                fontWeight={700}
                fill="#1a3a5c"
              >
                Dock {dock}
              </text>
            );
          })}

          {/* North arrow */}
          <g transform={`translate(${VIEW_X + 16}, ${VIEW_Y + 18})`}>
            <line x1={0} y1={14} x2={0} y2={-2} stroke="#1a3a5c" strokeWidth={1} />
            <polygon points="-3,0 3,0 0,-6" fill="#1a3a5c" />
            <text
              x={0}
              y={20}
              textAnchor="middle"
              fontSize={6}
              fontFamily="ui-sans-serif, sans-serif"
              fill="#1a3a5c"
            >
              N
            </text>
          </g>
        </svg>
      </div>

      <figcaption className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
        <Legend swatch="#e8dcc4" label="Premium" />
        <Legend swatch="#ffffff" label="Standard" />
        <Legend swatch="#f1f5f9" label="Restricted" />
        <span>86 slips · 3 docks · Shrewsbury River, Monmouth Beach NJ</span>
      </figcaption>
    </figure>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-3 w-3 rounded-sm border border-navy"
        style={{ background: swatch }}
      />
      {label}
    </span>
  );
}
