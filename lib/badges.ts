import type { Badge, BadgeKind, CompRecord, Exec } from "./schemas";

type BadgeDef = {
  label: string;
  description: string;
  priority: number;
};

export const BADGE_REGISTRY: Record<BadgeKind, BadgeDef> = {
  founder: {
    label: "Founder",
    description: "A founder or co-founder of the company.",
    priority: 100,
  },
  "former-officer": {
    label: "Former officer",
    description:
      "Disclosed as a former named executive officer per SEC rules — no longer in the role at fiscal year-end.",
    priority: 90,
  },
  "multi-year-cliff-grant": {
    label: "Multi-year cliff grant",
    description:
      "Received a single equity grant designed to cover several years of compensation, inflating one fiscal year's reported total.",
    priority: 80,
  },
  "salary-foregone": {
    label: "Salary foregone",
    description:
      "The executive voluntarily declined some or all base salary for part of this fiscal year.",
    priority: 70,
  },
  "psu-re-recognition": {
    label: "PSU re-recognition",
    description:
      "Stock Awards include grant-date fair value of PSUs from prior fiscal years whose performance metrics were set this year (an ASC 718 mechanic).",
    priority: 60,
  },
  "no-equity-this-year": {
    label: "No equity this year",
    description: "Received no new stock or option grant in this fiscal year.",
    priority: 50,
  },
  "sign-on-bonus": {
    label: "Sign-on bonus",
    description: "Compensation includes a one-time sign-on bonus tied to joining the company.",
    priority: 40,
  },
  "partial-year": {
    label: "Partial year",
    description:
      "Compensation reflects only the portion of the fiscal year the executive served in the role.",
    priority: 30,
  },
  "foreign-currency": {
    label: "Foreign currency",
    description:
      "Cash compensation paid in a non-USD currency and converted for disclosure.",
    priority: 20,
  },
};

export function execBadges(exec: Exec): Badge[] {
  const out: Badge[] = [...exec.badges];
  if (exec.role.toLowerCase().startsWith("former") && !out.some((b) => b.kind === "former-officer")) {
    out.push({ kind: "former-officer" });
  }
  return dedupe(out);
}

export function recordBadges(record: CompRecord): Badge[] {
  const out: Badge[] = [...record.badges];
  if (
    record.stockAwardsCents + record.optionAwardsCents === 0 &&
    !out.some((b) => b.kind === "no-equity-this-year")
  ) {
    out.push({ kind: "no-equity-this-year" });
  }
  return dedupe(out);
}

function dedupe(badges: Badge[]): Badge[] {
  const seen = new Set<BadgeKind>();
  const out: Badge[] = [];
  for (const b of badges) {
    if (seen.has(b.kind)) continue;
    seen.add(b.kind);
    out.push(b);
  }
  return out.sort((a, b) => BADGE_REGISTRY[b.kind].priority - BADGE_REGISTRY[a.kind].priority);
}

export function topBadge(badges: Badge[]): Badge | undefined {
  return badges[0];
}
