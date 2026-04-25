import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { listCompanies, listExecsForCompany } from "@/lib/data";
import { formatUsdAbbrev } from "@/lib/format";
import type { Company, Exec } from "@/lib/schemas";

type Row = {
  company: Company;
  exec: Exec;
  latestFiscalYear: number;
  latestTotalCents: number;
};

export default async function Home() {
  const companies = await listCompanies();
  // Preserve proxy SCT order within each company (CEO → current CFO → others by total → former officers).
  // Companies are alphabetical by ticker via listCompanies().
  const rows: Row[] = (
    await Promise.all(
      companies.map(async (company) => {
        const execs = await listExecsForCompany(company.ticker);
        return execs.map<Row>((exec) => {
          const latest = [...exec.compRecords].sort((a, b) => b.fiscalYear - a.fiscalYear)[0];
          return {
            company,
            exec,
            latestFiscalYear: latest.fiscalYear,
            latestTotalCents: latest.totalCents,
          };
        });
      }),
    )
  ).flat();

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

      <section className="mt-16">
        <div className="flex items-baseline justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Executives
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {rows.length} {rows.length === 1 ? "exec" : "execs"} tracked
          </p>
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map(({ company, exec, latestFiscalYear, latestTotalCents }) => (
            <li key={`${exec.ticker}-${exec.slug}`}>
              <Link
                href={`/execs/${exec.ticker.toLowerCase()}/${exec.slug}`}
                className="group -mx-3 flex items-center justify-between gap-4 rounded-lg px-3 py-5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <Avatar name={exec.name} photoPath={exec.photoPath} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-zinc-900 dark:text-zinc-50">
                      {exec.name}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                      {exec.role} · {company.displayName ?? company.legalName}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-6">
                  <div className="text-right">
                    <p className="font-mono text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                      {formatUsdAbbrev(latestTotalCents)}
                    </p>
                    <p className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      FY{latestFiscalYear} total
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
            </li>
          ))}
        </ul>
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
