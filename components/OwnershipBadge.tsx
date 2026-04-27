import type { BeneficialOwnership } from "@/lib/schemas";

export function OwnershipBadge({ ownership }: { ownership: BeneficialOwnership }) {
  const label =
    ownership.percentageOwned === null ? "< 1%" : `${ownership.percentageOwned}%`;
  const tooltip = `${ownership.sharesOwned.toLocaleString("en-US")} shares beneficially owned as of ${formatDate(ownership.asOfDate)}${ownership.percentageOwned === null ? " (proxy reports as less than 1%)" : ""}.`;
  return (
    <span
      title={tooltip}
      className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
    >
      Owns {label}
    </span>
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
