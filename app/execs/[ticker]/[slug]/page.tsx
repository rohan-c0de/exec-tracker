import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { BadgeRow } from "@/components/Badge";
import { PerksBreakdown } from "@/components/PerksBreakdown";
import { execBadges, recordBadges } from "@/lib/badges";
import { loadCompany, loadExec } from "@/lib/data";
import { formatCellOrDash, formatUsdAbbrev, formatUsdFull } from "@/lib/format";
import type { CompRecord } from "@/lib/schemas";

type RouteParams = { ticker: string; slug: string };

export async function generateMetadata({ params }: { params: Promise<RouteParams> }) {
  const { ticker, slug } = await params;
  try {
    const exec = await loadExec(ticker, slug);
    return {
      title: `${exec.name} · ${exec.ticker} compensation · exec-tracker`,
      description: `Three-year SEC-disclosed compensation history for ${exec.name}, ${exec.role} at ${exec.ticker}.`,
    };
  } catch {
    return { title: "Not found · exec-tracker" };
  }
}

export default async function ExecPage({ params }: { params: Promise<RouteParams> }) {
  const { ticker, slug } = await params;
  let exec, company;
  try {
    [exec, company] = await Promise.all([loadExec(ticker, slug), loadCompany(ticker)]);
  } catch {
    notFound();
  }

  const records = [...exec.compRecords].sort((a, b) => b.fiscalYear - a.fiscalYear);
  const latest = records[0];
  const allFootnotes = records.flatMap((r) =>
    r.footnotes.map((text) => ({ year: r.fiscalYear, text })),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <nav className="mb-12 text-sm">
        <Link
          href="/"
          className="text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← All executives
        </Link>
      </nav>

      <header className="flex flex-col gap-8 border-b border-zinc-200 pb-10 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-6">
          <Avatar name={exec.name} photoPath={exec.photoPath} size="lg" />
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
              {exec.name}
            </h1>
            <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">{exec.role}</p>
            <BadgeRow badges={execBadges(exec)} className="mt-3" />
          </div>
        </div>
        <div className="flex flex-col gap-1 text-sm sm:items-end">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs font-medium tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {company.ticker}
            </span>
            <span className="text-zinc-700 dark:text-zinc-300">
              {company.displayName ?? company.legalName}
            </span>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400">
            {company.exchange} · Fiscal year ends{" "}
            {fiscalEndLabel(company.fiscalYearEndMonthDay)}
          </p>
        </div>
      </header>

      {exec.bio ? (
        <p className="mt-8 max-w-2xl text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          {exec.bio}
        </p>
      ) : null}

      <section className="mt-16">
        <SectionHeading
          eyebrow="Summary"
          title={`Total compensation, FY${records[records.length - 1].fiscalYear}–FY${latest.fiscalYear}`}
        />
        <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-3">
          {records.map((r) => (
            <div key={r.fiscalYear} className="bg-white p-6 dark:bg-zinc-950">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                FY{r.fiscalYear}
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                {formatUsdAbbrev(r.totalCents)}
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatUsdFull(r.totalCents)}
              </p>
              <BadgeRow badges={recordBadges(r)} size="sm" className="mt-3" />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <SectionHeading eyebrow="Breakdown" title="Summary Compensation Table" />
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Components as disclosed in the SCT of the proxy statement. Stock and option awards are
          reported at <em>grant-date fair value</em> — an accounting figure, not realized pay.
        </p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                  Component
                </th>
                {records.map((r) => (
                  <th
                    key={r.fiscalYear}
                    className="px-4 py-3 text-right font-medium tabular-nums text-zinc-600 dark:text-zinc-400"
                  >
                    FY{r.fiscalYear}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {COMP_ROWS.map((row, i) => (
                <tr
                  key={row.label}
                  className={i % 2 === 1 ? "bg-zinc-50/50 dark:bg-zinc-900/40" : undefined}
                >
                  <td className="px-4 py-3 font-sans text-zinc-700 dark:text-zinc-300">
                    {row.label}
                  </td>
                  {records.map((r) => (
                    <td
                      key={r.fiscalYear}
                      className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-100"
                    >
                      {formatCellOrDash(row.get(r))}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 border-zinc-300 dark:border-zinc-700">
                <td className="px-4 py-4 font-sans font-semibold text-zinc-900 dark:text-zinc-50">
                  Total
                </td>
                {records.map((r) => (
                  <td
                    key={r.fiscalYear}
                    className="px-4 py-4 text-right font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    {formatUsdFull(r.totalCents)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {latest.allOtherBreakdown && latest.allOtherBreakdown.length > 0 ? (
        <section className="mt-16">
          <SectionHeading
            eyebrow="Perks & benefits"
            title={`What's inside the All Other Compensation column · FY${latest.fiscalYear}`}
          />
          <PerksBreakdown record={latest} />
        </section>
      ) : null}

      {allFootnotes.length > 0 ? (
        <section className="mt-16">
          <SectionHeading eyebrow="Notes" title="Disclosures and footnotes" />
          <ol className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {allFootnotes.map((fn, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                  FY{fn.year}
                </span>
                <span className="flex-1">{fn.text}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="mt-16 border-t border-zinc-200 pt-8 text-sm dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Source
        </p>
        <p className="mt-2 text-zinc-700 dark:text-zinc-300">
          All figures from{" "}
          <a
            href={latest.source.filingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
          >
            {company.legalName} {latest.source.formType}
          </a>
          , filed {formatIsoDate(latest.source.filedDate)} (accession{" "}
          <span className="font-mono text-xs">{latest.source.accessionNumber}</span>).
        </p>
        {exec.photoCredit ? (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            Photo: {exec.photoCredit}.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
    </div>
  );
}

const COMP_ROWS: { label: string; get: (r: CompRecord) => number }[] = [
  { label: "Salary", get: (r) => r.salaryCents },
  { label: "Bonus", get: (r) => r.bonusCents },
  { label: "Stock awards", get: (r) => r.stockAwardsCents },
  { label: "Option awards", get: (r) => r.optionAwardsCents },
  { label: "Non-equity incentive", get: (r) => r.nonEquityIncentiveCents },
  { label: "Pension & NQDC", get: (r) => r.pensionAndNqdcCents },
  { label: "All other compensation", get: (r) => r.allOtherCompCents },
];

function fiscalEndLabel(monthDay: string): string {
  const [m, d] = monthDay.split("-").map(Number);
  const date = new Date(2000, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
