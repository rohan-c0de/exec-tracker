import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { BadgeRow } from "@/components/Badge";
import { CompTotal } from "@/components/CompTotal";
import { OwnershipBadge } from "@/components/OwnershipBadge";
import { PayMixBar, PayMixLegend } from "@/components/PayMixBar";
import { PvpTrajectory } from "@/components/PvpTrajectory";
import { execBadges, recordBadges } from "@/lib/badges";
import { listExecsForCompany, loadCompany } from "@/lib/data";
import { latestRecord } from "@/lib/comp";
import type { Exec } from "@/lib/schemas";

type RouteParams = { ticker: string };

export async function generateMetadata({ params }: { params: Promise<RouteParams> }) {
  const { ticker } = await params;
  try {
    const company = await loadCompany(ticker);
    return {
      title: `${company.displayName ?? company.legalName} executive compensation · exec-tracker`,
      description: `Named executive officer compensation for ${company.legalName}, sourced from the most recent DEF 14A filed with the SEC.`,
    };
  } catch {
    return { title: "Not found · exec-tracker" };
  }
}

export default async function CompanyPage({ params }: { params: Promise<RouteParams> }) {
  const { ticker } = await params;
  let company, execs;
  try {
    [company, execs] = await Promise.all([loadCompany(ticker), listExecsForCompany(ticker)]);
  } catch {
    notFound();
  }

  const sourceRecord = latestRecord(execs[0]!.compRecords);
  const source = sourceRecord.source;

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <nav className="mb-12 text-sm">
        <Link
          href="/"
          className="text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Home
        </Link>
      </nav>

      <header className="border-b border-zinc-200 pb-10 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs font-medium tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {company.ticker}
          </span>
          <span className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {company.exchange}
          </span>
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          {company.legalName}
        </h1>
        <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
          {execs.length} named executive officer{execs.length === 1 ? "" : "s"} ·
          Fiscal year ends {fiscalEndLabel(company.fiscalYearEndMonthDay)}
          {company.websiteUrl ? (
            <>
              {" · "}
              <a
                href={company.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
              >
                {hostnameOf(company.websiteUrl)}
              </a>
            </>
          ) : null}
        </p>
      </header>

      <section className="mt-16">
        <SectionHeading
          eyebrow="Pay mix"
          title="How each executive is paid"
        />
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Each bar is sized by the proportion of total compensation in the executive&apos;s most
          recent fiscal year. Equity reflects grant-date fair value of stock and option awards —
          an accounting figure, not realized pay.
        </p>
        <div className="mt-6">
          <PayMixLegend />
        </div>
        <ul className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800">
          {execs.map((exec) => (
            <NeoRow key={exec.slug} exec={exec} />
          ))}
        </ul>
      </section>

      {company.pvpRecords && company.pvpRecords.length > 0 ? (
        <section className="mt-16">
          <SectionHeading
            eyebrow="Pay vs. Performance"
            title="Did the CEO's pay track the stock?"
          />
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            SEC-mandated &quot;Pay vs. Performance&quot; disclosure (Reg S-K Item 402(v)). One dot
            per fiscal year of the Principal Executive Officer&apos;s tenure.{" "}
            <em>Compensation Actually Paid</em> re-marks unvested equity to year-end fair value.
          </p>
          <div className="mt-6">
            <PvpTrajectory records={company.pvpRecords} />
          </div>
        </section>
      ) : null}

      <section className="mt-16 border-t border-zinc-200 pt-8 text-sm dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Source
        </p>
        <p className="mt-2 text-zinc-700 dark:text-zinc-300">
          All figures from{" "}
          <a
            href={source.filingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
          >
            {company.legalName} {source.formType}
          </a>
          , filed {formatIsoDate(source.filedDate)} (accession{" "}
          <span className="font-mono text-xs">{source.accessionNumber}</span>).
        </p>
      </section>
    </main>
  );
}

function NeoRow({ exec }: { exec: Exec }) {
  const latest = latestRecord(exec.compRecords);
  return (
    <li>
      <Link
        href={`/execs/${exec.ticker.toLowerCase()}/${exec.slug}`}
        className="group -mx-3 block rounded-lg px-3 py-5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={exec.name} photoPath={exec.photoPath} size="sm" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-medium text-zinc-900 dark:text-zinc-50">
                  {exec.name}
                </p>
                <BadgeRow badges={execBadges(exec)} size="sm" />
                {exec.beneficialOwnership ? (
                  <OwnershipBadge ownership={exec.beneficialOwnership} />
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                {exec.role}
              </p>
              <BadgeRow badges={recordBadges(latest)} size="sm" className="mt-1.5" />
            </div>
          </div>
          <div className="shrink-0">
            <CompTotal record={latest} fiscalYear={latest.fiscalYear} size="sm" />
          </div>
        </div>
        <div className="mt-4 ml-16">
          <PayMixBar record={latest} />
        </div>
      </Link>
    </li>
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

function fiscalEndLabel(monthDay: string): string {
  const [m, d] = monthDay.split("-").map(Number);
  const date = new Date(2000, m! - 1, d!);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
