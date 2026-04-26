import { BADGE_REGISTRY } from "@/lib/badges";
import type { Badge as BadgeType } from "@/lib/schemas";

type Size = "sm" | "md";

const sizeMap: Record<Size, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
};

export function Badge({ badge, size = "md" }: { badge: BadgeType; size?: Size }) {
  const def = BADGE_REGISTRY[badge.kind];
  const tooltip = badge.detail ? `${def.description} ${badge.detail}` : def.description;
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 ${sizeMap[size]}`}
    >
      {def.label}
    </span>
  );
}

export function BadgeRow({
  badges,
  size = "md",
  className = "",
}: {
  badges: BadgeType[];
  size?: Size;
  className?: string;
}) {
  if (badges.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.map((b) => (
        <Badge key={b.kind} badge={b} size={size} />
      ))}
    </div>
  );
}
