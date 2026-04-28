import Link from "next/link";
import { PvpScatter } from "@/components/PvpScatter";
import { listCompanies } from "@/lib/data";

export const metadata = {
  title: "Pay versus Performance · exec-tracker",
  description:
    "Did the CEO get paid in line with how the stock performed? A scatter plot of Compensation Actually Paid against single-year total shareholder return for every covered CEO.",
};

export default async function PvpPage() {
  const companies = await listCompanies();
  const withPvp = companies.filter((c) => c.pvpRecords && c.pvpRecords.length > 0);

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
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Pay versus Performance
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Did the CEO get paid in line with how the stock performed?
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          One dot per covered CEO per fiscal year. <em>Compensation Actually Paid</em> (CAP)
          re-marks unvested equity to year-end fair value — it&apos;s the SEC&apos;s answer to
          &quot;what did this CEO really pocket this year?&quot; and is far more honest than the
          headline grant-date numbers in the Summary Compensation Table. <em>Single-year TSR</em> is
          derived from the proxy&apos;s indexed cumulative TSR series — the year-over-year growth
          in the value of $100 invested at the start of the disclosure window.
        </p>
      </header>

      <section className="mt-12">
        <PvpScatter companies={withPvp} />
      </section>

      <section className="mt-16 max-w-2xl space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">How to read this</h2>
        <p>
          <strong className="text-zinc-700 dark:text-zinc-300">Top-right dots</strong> are the
          aligned cases: stock soared, CEO got paid a lot. CrowdStrike FY2021 and FY2024 land here.
        </p>
        <p>
          <strong className="text-zinc-700 dark:text-zinc-300">Bottom-left dots</strong> are also
          aligned but for the opposite reason: the stock fell and unvested equity got marked down.
          Compensation Actually Paid can be deeply negative — CrowdStrike FY2023 and SentinelOne
          FY2023 are both well below the zero line.
        </p>
        <p>
          <strong className="text-zinc-700 dark:text-zinc-300">Top-left dots</strong> are the
          governance-failure quadrant: stock fell, CEO still made a fortune. There aren&apos;t many
          here in this dataset — the Compensation Actually Paid framework largely worked as
          intended for these companies.
        </p>
        <p className="pt-3 text-xs">
          Source: Item 402(v) of Regulation S-K (the &quot;Pay vs. Performance&quot; disclosure
          mandated since FY2022). All numbers transcribed from the cited DEF 14A.
        </p>
      </section>
    </main>
  );
}
