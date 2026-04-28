import type { Company, PvpRecord } from "@/lib/schemas";
import { formatUsdAbbrev } from "@/lib/format";

// Per-company colors. Tailwind palette anchors. When a new company is added
// with a ticker not in this map, fall back to a neutral zinc.
const COMPANY_COLOR: Record<string, string> = {
  AAPL: "#71717a", // zinc-500 (neutral, fits Apple's understated brand)
  CRWD: "#dc2626", // red-600
  PANW: "#ea580c", // orange-600
  ZS: "#2563eb", // blue-600
  S: "#7c3aed", // violet-600
};
const FALLBACK_COLOR = "#a1a1aa";

const MARGIN = { top: 24, right: 24, bottom: 56, left: 64 };
const WIDTH = 800;
const HEIGHT = 480;
const INNER_W = WIDTH - MARGIN.left - MARGIN.right;
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;

type Dot = {
  ticker: string;
  fiscalYear: number;
  peoSlug: string;
  capCents: number;
  tsrSingleYear: number; // e.g. 0.34 for +34%
  color: string;
};

/**
 * Derive single-year TSR from the indexed cumulative TSR series in a proxy.
 * The proxy's `tsrIndexed` is "value of $100 invested at start of the
 * disclosure window." Year-over-year growth in that index equals single-year
 * TSR. For the earliest year in the window, the prior anchor is exactly 100
 * (proxy convention).
 */
function deriveSingleYearTsr(records: PvpRecord[]): Map<number, number> {
  const sorted = [...records].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const out = new Map<number, number>();
  let prior = 100;
  for (const r of sorted) {
    out.set(r.fiscalYear, r.tsrIndexed / prior - 1);
    prior = r.tsrIndexed;
  }
  return out;
}

function buildDots(companies: Company[]): Dot[] {
  const dots: Dot[] = [];
  for (const c of companies) {
    if (!c.pvpRecords || c.pvpRecords.length === 0) continue;
    const tsrByYear = deriveSingleYearTsr(c.pvpRecords);
    const color = COMPANY_COLOR[c.ticker] ?? FALLBACK_COLOR;
    for (const r of c.pvpRecords) {
      const tsr = tsrByYear.get(r.fiscalYear);
      if (tsr === undefined) continue;
      dots.push({
        ticker: c.ticker,
        fiscalYear: r.fiscalYear,
        peoSlug: r.peoSlug,
        capCents: r.peoCapCents,
        tsrSingleYear: tsr,
        color,
      });
    }
  }
  return dots;
}

function niceTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(range / count)));
  const refined = Math.ceil(range / count / step) * step;
  const start = Math.floor(min / refined) * refined;
  const end = Math.ceil(max / refined) * refined;
  const ticks: number[] = [];
  for (let v = start; v <= end + 1e-9; v += refined) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

export function PvpScatter({ companies }: { companies: Company[] }) {
  const dots = buildDots(companies);

  if (dots.length === 0) {
    return <p className="text-sm text-zinc-500">No PvP data available.</p>;
  }

  const tsrMin = Math.min(...dots.map((d) => d.tsrSingleYear), 0);
  const tsrMax = Math.max(...dots.map((d) => d.tsrSingleYear), 0);
  const capMin = Math.min(...dots.map((d) => d.capCents), 0);
  const capMax = Math.max(...dots.map((d) => d.capCents), 0);

  // Pad domain by 5% so dots aren't on the edge
  const xPad = (tsrMax - tsrMin) * 0.05;
  const yPad = (capMax - capMin) * 0.05;
  const xMin = tsrMin - xPad;
  const xMax = tsrMax + xPad;
  const yMin = capMin - yPad;
  const yMax = capMax + yPad;

  const xScale = (v: number) => ((v - xMin) / (xMax - xMin)) * INNER_W;
  const yScale = (v: number) => INNER_H - ((v - yMin) / (yMax - yMin)) * INNER_H;

  const xTicks = niceTicks(xMin, xMax, 6);
  const yTicks = niceTicks(yMin / 1e8, yMax / 1e8, 6).map((v) => v * 1e8);

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full text-zinc-500 dark:text-zinc-400"
        role="img"
        aria-label="Pay versus performance scatter plot"
      >
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Y gridlines + ticks */}
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
                {formatUsdAbbrev(v)}
              </text>
            </g>
          ))}

          {/* X gridlines + ticks */}
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

          {/* Zero lines (emphasize) */}
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

          {/* Dots */}
          {dots.map((d) => (
            <g key={`${d.ticker}-${d.fiscalYear}`}>
              <circle
                cx={xScale(d.tsrSingleYear)}
                cy={yScale(d.capCents)}
                r={7}
                fill={d.color}
                fillOpacity={0.75}
                stroke="white"
                strokeWidth={1.5}
              >
                <title>
                  {d.ticker} FY{d.fiscalYear} · CAP {formatUsdAbbrev(d.capCents)} · TSR{" "}
                  {(d.tsrSingleYear * 100).toFixed(1)}%
                </title>
              </circle>
              <text
                x={xScale(d.tsrSingleYear) + 10}
                y={yScale(d.capCents)}
                dy="0.32em"
                className="fill-zinc-500 font-mono text-[10px] tabular-nums dark:fill-zinc-400"
              >
                FY{d.fiscalYear.toString().slice(-2)}
              </text>
            </g>
          ))}

          {/* Axis labels */}
          <text
            x={INNER_W / 2}
            y={INNER_H + 44}
            textAnchor="middle"
            className="fill-current text-xs font-medium"
          >
            Single-year total shareholder return
          </text>
          <text
            transform={`translate(${-46}, ${INNER_H / 2}) rotate(-90)`}
            textAnchor="middle"
            className="fill-current text-xs font-medium"
          >
            Compensation actually paid (CAP)
          </text>
        </g>
      </svg>

      <figcaption className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        {companies
          .filter((c) => c.pvpRecords && c.pvpRecords.length > 0)
          .map((c) => (
            <span key={c.ticker} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: COMPANY_COLOR[c.ticker] ?? FALLBACK_COLOR }}
              />
              <span className="text-zinc-700 dark:text-zinc-300">
                {c.displayName ?? c.legalName} ({c.ticker})
              </span>
            </span>
          ))}
      </figcaption>
    </figure>
  );
}
