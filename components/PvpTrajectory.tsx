import type { PvpRecord } from "@/lib/schemas";
import { formatUsdAbbrev } from "@/lib/format";

const MARGIN = { top: 24, right: 32, bottom: 48, left: 64 };
const WIDTH = 720;
const HEIGHT = 360;
const INNER_W = WIDTH - MARGIN.left - MARGIN.right;
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;

/** Compact axis tick formatter — drops trailing .00 (e.g. "$320M" not "$320.00M"). */
function formatAxisTick(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = abs / 100;
  let body: string;
  if (dollars >= 1_000_000_000) body = `$${(dollars / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  else if (dollars >= 1_000_000) body = `$${Math.round(dollars / 1_000_000)}M`;
  else if (dollars >= 1_000) body = `$${Math.round(dollars / 1_000)}K`;
  else if (dollars === 0) body = `$0`;
  else body = `$${Math.round(dollars)}`;
  return negative ? `−${body}` : body;
}

/**
 * Place a year label near each dot with simple collision avoidance.
 * Tries right-of-dot first; if that overlaps a previously placed label,
 * tries above, then below, then left. With 5 dots this stays cheap.
 */
function placeLabels(
  points: { x: number; y: number }[],
): Array<{ dx: number; dy: number; anchor: "start" | "end" }> {
  const candidates: Array<{ dx: number; dy: number; anchor: "start" | "end" }> = [
    { dx: 10, dy: 0, anchor: "start" },
    { dx: 10, dy: -16, anchor: "start" },
    { dx: 10, dy: 16, anchor: "start" },
    { dx: -10, dy: 0, anchor: "end" },
    { dx: -10, dy: -16, anchor: "end" },
    { dx: -10, dy: 16, anchor: "end" },
  ];
  const placed: Array<{ x: number; y: number }> = [];
  const out: Array<{ dx: number; dy: number; anchor: "start" | "end" }> = [];
  const labelW = 48;
  const labelH = 14;
  for (const p of points) {
    let chosen = candidates[0]!;
    for (const c of candidates) {
      const lx = p.x + c.dx;
      const ly = p.y + c.dy;
      const collides = placed.some(
        (l) => Math.abs(l.x - lx) < labelW && Math.abs(l.y - ly) < labelH,
      );
      if (!collides) {
        chosen = c;
        break;
      }
    }
    placed.push({ x: p.x + chosen.dx, y: p.y + chosen.dy });
    out.push(chosen);
  }
  return out;
}

type Point = {
  fiscalYear: number;
  capCents: number;
  tsrSingleYear: number;
};

/**
 * Single-year TSR derived from the proxy's indexed cumulative TSR series.
 * For year N: tsrIndexed[N] / tsrIndexed[N-1] - 1.
 * For the earliest year in the disclosure window, the prior anchor is exactly
 * 100 by SEC convention (the "value of $100 invested at start").
 */
function buildPoints(records: PvpRecord[]): Point[] {
  const sorted = [...records].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const out: Point[] = [];
  let prior = 100;
  for (const r of sorted) {
    out.push({
      fiscalYear: r.fiscalYear,
      capCents: r.peoCapCents,
      tsrSingleYear: r.tsrIndexed / prior - 1,
    });
    prior = r.tsrIndexed;
  }
  return out;
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (min === max) return [min];
  const range = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(range / count)));
  const refined = Math.ceil(range / count / step) * step;
  const start = Math.floor(min / refined) * refined;
  const end = Math.ceil(max / refined) * refined;
  const ticks: number[] = [];
  for (let v = start; v <= end + 1e-9; v += refined) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

export function PvpTrajectory({
  records,
  color = "#2563eb",
}: {
  records: PvpRecord[];
  color?: string;
}) {
  const points = buildPoints(records);
  if (points.length === 0) return null;

  const tsrMin = Math.min(...points.map((p) => p.tsrSingleYear), 0);
  const tsrMax = Math.max(...points.map((p) => p.tsrSingleYear), 0);
  const capMin = Math.min(...points.map((p) => p.capCents), 0);
  const capMax = Math.max(...points.map((p) => p.capCents), 0);
  const xPad = (tsrMax - tsrMin) * 0.1 || 0.1;
  const yPad = (capMax - capMin) * 0.1 || 1e8;
  const xMin = tsrMin - xPad;
  const xMax = tsrMax + xPad;
  const yMin = capMin - yPad;
  const yMax = capMax + yPad;

  const xScale = (v: number) => ((v - xMin) / (xMax - xMin)) * INNER_W;
  const yScale = (v: number) => INNER_H - ((v - yMin) / (yMax - yMin)) * INNER_H;
  const xTicks = niceTicks(xMin, xMax, 5);
  const yTicks = niceTicks(yMin, yMax, 5);

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full text-zinc-500 dark:text-zinc-400"
        role="img"
        aria-label="Pay versus performance trajectory"
      >
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {yTicks.map((v) => (
            <g key={`y-${v}`}>
              <line
                x1={0}
                x2={INNER_W}
                y1={yScale(v)}
                y2={yScale(v)}
                className="stroke-zinc-200 dark:stroke-zinc-800"
                strokeWidth={1}
              />
              <text
                x={-8}
                y={yScale(v)}
                dy="0.32em"
                textAnchor="end"
                className="fill-current font-mono text-[10px] tabular-nums"
              >
                {formatAxisTick(v)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <g key={`x-${v}`}>
              <line
                x1={xScale(v)}
                x2={xScale(v)}
                y1={0}
                y2={INNER_H}
                className="stroke-zinc-200 dark:stroke-zinc-800"
                strokeWidth={1}
              />
              <text
                x={xScale(v)}
                y={INNER_H + 16}
                textAnchor="middle"
                className="fill-current font-mono text-[10px] tabular-nums"
              >
                {(v * 100).toFixed(0)}%
              </text>
            </g>
          ))}
          {xMin <= 0 && xMax >= 0 ? (
            <line
              x1={xScale(0)}
              x2={xScale(0)}
              y1={0}
              y2={INNER_H}
              className="stroke-zinc-400 dark:stroke-zinc-600"
              strokeWidth={1.5}
            />
          ) : null}
          {yMin <= 0 && yMax >= 0 ? (
            <line
              x1={0}
              x2={INNER_W}
              y1={yScale(0)}
              y2={yScale(0)}
              className="stroke-zinc-400 dark:stroke-zinc-600"
              strokeWidth={1.5}
            />
          ) : null}
          {(() => {
            const positions = points.map((p) => ({
              x: xScale(p.tsrSingleYear),
              y: yScale(p.capCents),
            }));
            const labelOffsets = placeLabels(positions);
            return points.map((p, i) => {
              const cx = positions[i]!.x;
              const cy = positions[i]!.y;
              const off = labelOffsets[i]!;
              return (
                <g key={p.fiscalYear}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={7}
                    fill={color}
                    fillOpacity={0.8}
                    stroke="white"
                    strokeWidth={1.5}
                  >
                    <title>
                      FY{p.fiscalYear} · CAP {formatUsdAbbrev(p.capCents)} · TSR{" "}
                      {(p.tsrSingleYear * 100).toFixed(1)}%
                    </title>
                  </circle>
                  <text
                    x={cx + off.dx}
                    y={cy + off.dy}
                    dy="0.32em"
                    textAnchor={off.anchor}
                    className="fill-zinc-500 font-mono text-[10px] tabular-nums dark:fill-zinc-400"
                  >
                    FY{p.fiscalYear.toString().slice(-2)}
                  </text>
                </g>
              );
            });
          })()}
          <text
            x={INNER_W / 2}
            y={INNER_H + 38}
            textAnchor="middle"
            className="fill-current text-xs font-medium"
          >
            Single-year shareholder return →
          </text>
        </g>
      </svg>
    </figure>
  );
}
