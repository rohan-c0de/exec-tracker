import type { BeneficialOwnership } from "@/lib/schemas";

/**
 * Inline breakdown of beneficial ownership lines from the proxy's footnote.
 * Renders only when `breakdown` is populated. The aggregate `sharesOwned` is
 * already shown via OwnershipBadge in the header — this surface explains
 * what's IN that number (direct vs. trust vs. vesting equity vs. exercisable
 * options), which can otherwise look like a single mysterious figure.
 *
 * Why this exists: Form 4 transactions show "currently held" by ownership
 * track (D direct vs. I indirect), and the running balance there often
 * doesn't match the proxy's beneficial-ownership figure because Form 4
 * doesn't capture vesting equity / exercisable options that get included
 * in the proxy's "within 60 days" beneficial-ownership rules. Showing the
 * proxy breakdown makes that gap legible.
 */
export function OwnershipBreakdown({
  ownership,
  asOfDate,
}: {
  ownership: BeneficialOwnership;
  asOfDate: string;
}) {
  const items = ownership.breakdown;
  if (!items || items.length === 0) return null;

  return (
    <section className="mt-10 rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">
            Beneficial ownership breakdown
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            From the proxy&apos;s &ldquo;Security Ownership of Certain Beneficial Owners
            and Management&rdquo; footnote, as of {formatDate(asOfDate)}.
          </p>
        </div>
        <span className="font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
          {ownership.sharesOwned.toLocaleString("en-US")} total
        </span>
      </header>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-baseline justify-between gap-4 py-2.5"
          >
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              {item.label}
            </span>
            <span className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-50">
              {item.shares.toLocaleString("en-US")}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Per SEC rules, beneficial ownership includes shares held directly,
        through trusts and LLCs, vested-but-deferred RSUs/PSUs, and equity
        exercisable within 60 days of the as-of date. The Form&nbsp;4
        &ldquo;Currently held&rdquo; figure on this page reflects only the
        most recent direct and indirect transaction balances, not the
        forward-vesting equity in the rows above.
      </p>
    </section>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
