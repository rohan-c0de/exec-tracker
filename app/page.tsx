import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { execBadges, recordBadges, topBadge } from "@/lib/badges";
import { latestRecord } from "@/lib/comp";
import { listCompanies, listExecsForCompany } from "@/lib/data";
import { formatUsdAbbrev } from "@/lib/format";
import type { Company, Exec } from "@/lib/schemas";

type ExecRow = {
  company: Company;
  exec: Exec;
  latestFiscalYear: number;
  latestTotalCents: number;
};

const LEADERBOARD_LIMIT = 5;

export default async function Home() {
  const companies = await listCompanies();
  const perCompany = await Promise.all(
    companies.map(async (company) => ({
      company,
      execs: await listExecsForCompany(company.ticker),
    })),
  );

  const allRows: ExecRow[] = perCompany.flatMap(({ company, execs }) =>
    execs.map((exec) => {
      const latest = latestRecord(exec.compRecords);
      return {
        company,
        exec,
        latestFiscalYear: latest.fiscalYear,
        latestTotalCents: latest.totalCents,
      };
    }),
  );

  const topExecs = [...allRows]
    .sort((a, b) => b.latestTotalCents - a.latestTotalCents)
    .slice(0, LEADERBOARD_LIMIT);

  const totalExecs = allRows.length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          How US public-company executives are paid.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Compensation for named executive officers — the CEO, CFO, and three other highest-paid
          officers at every US public company — sourced directly from each company&apos;s annual
          proxy statement (Form DEF 14A). Every figure is traceable to its filing.
        </p>
      </header>

      <section className="mt-20">
        <SectionHeading
          eyebrow="Top paid"
          title="Highest-compensated executives"
          aside={`${totalExecs} tracked`}
        />
        <ol className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800">
          {topExecs.map((row, i) => (
            <li key={`${row.exec.ticker}-${row.exec.slug}`}>
              <LeaderboardRow rank={i + 1} row={row} />
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-24">
        <SectionHeading
          eyebrow="Companies"
          title={`${companies.length} ${companies.length === 1 ? "company" : "companies"} tracked`}
        />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {perCompany.map(({ company, execs }) => (
            <CompanyCard key={company.ticker} company={company} execs={execs} />
          ))}
        </div>
      </section>

      <footer className="mt-24 border-t border-zinc-200 pt-8 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <p>
          Phase 1 — manually curated. All figures sourced from each company&apos;s most recent
          Form DEF 14A filed with the SEC.
        </p>
      </footer>
    </main>
  );
}

function LeaderboardRow({ rank, row }: { rank: number; row: ExecRow }) {
  const { company, exec, latestFiscalYear, latestTotalCents } = row;
  const latest = latestRecord(exec.compRecords);
  const top = topBadge([...execBadges(exec), ...recordBadges(latest)]);
  return (
    <Link
      href={`/execs/${exec.ticker.toLowerCase()}/${exec.slug}`}
      className="group -mx-3 flex items-center gap-4 rounded-lg px-3 py-5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
    >
      <span className="w-6 shrink-0 font-mono text-sm tabular-nums text-zinc-400 dark:text-zinc-500">
        {rank}
      </span>
      <Avatar name={exec.name} photoPath={exec.photoPath} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-medium text-zinc-900 dark:text-zinc-50">
            {exec.name}
          </p>
          {top ? <Badge badge={top} size="sm" /> : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
          {exec.role} · {company.displayName ?? company.legalName}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <p className="font-mono text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatUsdAbbrev(latestTotalCents)}
          </p>
          <p className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            FY{latestFiscalYear}
          </p>
        </div>
        <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs font-medium tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {company.ticker}
        </span>
        <span className="hidden text-zinc-400 transition-transform group-hover:translate-x-0.5 dark:text-zinc-500 sm:inline">
          →
        </span>
      </div>
    </Link>
  );
}

function CompanyCard({ company, execs }: { company: Company; execs: Exec[] }) {
  const topExec = [...execs].sort((a, b) => {
    return latestRecord(b.compRecords).totalCents - latestRecord(a.compRecords).totalCents;
  })[0]!;
  const topLatest = latestRecord(topExec.compRecords);

  return (
    <Link
      href={`/companies/${company.ticker.toLowerCase()}`}
      className="group block rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs font-medium tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {company.ticker}
            </span>
            <span className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {company.exchange}
            </span>
          </div>
          <h3 className="mt-3 truncate text-lg font-medium text-zinc-900 dark:text-zinc-50">
            {company.displayName ?? company.legalName}
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {execs.length} named executive officer{execs.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 dark:text-zinc-500">
          →
        </span>
      </div>
      <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Highest paid
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {topExec.name}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{topExec.role}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatUsdAbbrev(topLatest.totalCents)}
            </p>
            <p className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              FY{topLatest.fiscalYear}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
      </div>
      {aside ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{aside}</p>
      ) : null}
    </div>
  );
}
