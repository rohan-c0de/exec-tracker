import { z } from "zod";

const Cents = z.number().int().nonnegative();
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const Url = z.string().url();
export const SlugSchema = z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits, hyphens only");
export const TickerSchema = z.string().regex(/^[A-Z]{1,5}$/, "uppercase ticker, 1-5 chars");
const Slug = SlugSchema;
const Ticker = TickerSchema;

export const SourceSchema = z.object({
  filingUrl: Url,
  accessionNumber: z.string().regex(/^\d{10}-\d{2}-\d{6}$/, "SEC accession format ##########-##-######"),
  formType: z.literal("DEF 14A"),
  filedDate: IsoDate,
  periodOfReport: IsoDate,
});

export const PerkItemSchema = z.object({
  label: z.string().min(1),
  cents: Cents,
});

export const OwnershipLineItemSchema = z.object({
  // Mirrors the proxy footnote's wording (e.g. "Direct", "Annuity Trust",
  // "RSUs vesting within 60 days", "Options exercisable within 60 days").
  label: z.string().min(1),
  shares: z.number().int().nonnegative(),
});

export const BeneficialOwnershipSchema = z
  .object({
    sharesOwned: z.number().nonnegative(),
    // null means "less than 1%" (proxy convention "*" — the underlying number isn't disclosed)
    percentageOwned: z.number().nonnegative().nullable(),
    asOfDate: IsoDate,
    source: SourceSchema,
    // Optional. When present, sum of breakdown.shares MUST equal sharesOwned
    // unless `discrepancyNote` is also present (see below).
    // Used when the proxy's beneficial-ownership footnote splits the holding
    // across multiple tracks (direct / trust / LLC / vesting RSUs /
    // exercisable options) — otherwise the aggregate is misleading.
    breakdown: z.array(OwnershipLineItemSchema).optional(),
    // Optional. Records proxy-side typos / footnote omissions where the
    // disclosed line items don't sum to the stated total (e.g. Nir Zuk PANW
    // FY2025: footnote skips line "(iii)" so components are 132 shares short).
    // When present, the breakdown-sum-equals-total refine is relaxed.
    // Same shape of issue as paired SCT-row mismatches (e.g. SentinelOne
    // FY2023 Smith/Srivatsan ±$1,125, captured in compRecords[].footnotes[]).
    discrepancyNote: z.string().min(1).optional(),
  })
  .refine(
    (b) =>
      b.breakdown === undefined ||
      b.discrepancyNote !== undefined ||
      b.breakdown.reduce((s, i) => s + i.shares, 0) === b.sharesOwned,
    {
      message:
        "breakdown items must sum exactly to sharesOwned (or set discrepancyNote to record a proxy-side mismatch)",
      path: ["breakdown"],
    },
  );

export const BadgeKindSchema = z.enum([
  "founder",
  "former-officer",
  "no-equity-this-year",
  "salary-foregone",
  "foreign-currency",
  "partial-year",
  "sign-on-bonus",
  "multi-year-cliff-grant",
  "psu-re-recognition",
]);

export const BadgeSchema = z.object({
  kind: BadgeKindSchema,
  detail: z.string().optional(),
});

export const CompRecordSchema = z
  .object({
    fiscalYear: z.number().int().min(1990).max(2100),
    fiscalYearEnd: IsoDate,
    salaryCents: Cents,
    bonusCents: Cents,
    stockAwardsCents: Cents,
    optionAwardsCents: Cents,
    nonEquityIncentiveCents: Cents,
    pensionAndNqdcCents: Cents,
    allOtherCompCents: Cents,
    totalCents: Cents,
    compActuallyPaidCents: z.number().int().optional(),
    footnotes: z.array(z.string()).default([]),
    allOtherBreakdown: z.array(PerkItemSchema).optional(),
    badges: z.array(BadgeSchema).default([]),
    source: SourceSchema,
  })
  .refine(
    (r) =>
      r.allOtherBreakdown === undefined ||
      r.allOtherBreakdown.reduce((s, i) => s + i.cents, 0) === r.allOtherCompCents,
    {
      message: "allOtherBreakdown items must sum exactly to allOtherCompCents",
      path: ["allOtherBreakdown"],
    },
  );

export const ExecSchema = z.object({
  ticker: Ticker,
  slug: Slug,
  name: z.string().min(1),
  role: z.string().min(1),
  bio: z.string().optional(),
  photoPath: z.string().regex(/^\/[\w./-]+\.(png|jpg|jpeg|webp)$/i).optional(),
  photoCredit: z.string().optional(),
  badges: z.array(BadgeSchema).default([]),
  beneficialOwnership: BeneficialOwnershipSchema.optional(),
  // Override for the Form 4 importer when the exec's display name doesn't
  // match SEC's "Lastname Firstname M" tokenization (e.g. nicknames like
  // "BJ" for "William D Jr", or "Jay" for "Jagtar"). 10 digits, no formatting.
  secCik: z.string().regex(/^\d{10}$/).optional(),
  compRecords: z.array(CompRecordSchema).min(1),
});

export const CompanySchema = z.object({
  ticker: Ticker,
  legalName: z.string().min(1),
  displayName: z.string().optional(),
  exchange: z.enum(["NASDAQ", "NYSE", "AMEX", "OTHER"]),
  secCik: z.string().regex(/^\d{10}$/, "10-digit zero-padded CIK"),
  fiscalYearEndMonthDay: z.string().regex(/^\d{2}-\d{2}$/, "MM-DD of fiscal year end"),
  websiteUrl: Url.optional(),
  neoSlugs: z.array(Slug).min(1),
});

export const TransactionCodeSchema = z.enum([
  "A", "C", "D", "E", "F", "G", "H", "I", "J", "K",
  "L", "M", "O", "P", "S", "U", "V", "W", "X", "Z",
]);

export const InsiderTransactionSchema = z.object({
  transactionDate: IsoDate,
  filedDate: IsoDate,
  code: TransactionCodeSchema,
  acquiredOrDisposed: z.enum(["A", "D"]),
  securityTitle: z.string().min(1),
  isDerivative: z.boolean(),
  shares: z.number().nonnegative(),
  pricePerShareCents: z.number().int().nonnegative().nullable(),
  postTransactionShares: z.number().nonnegative(),
  ownershipNature: z.enum(["D", "I"]),
  ownershipExplanation: z.string().optional(),
  source: z.object({
    filingUrl: Url,
    accessionNumber: z.string().regex(/^\d{10}-\d{2}-\d{6}$/),
    formType: z.literal("4"),
  }),
});

export const InsiderTransactionsFileSchema = z.object({
  ticker: Ticker,
  slug: Slug,
  insiderCik: z.string().regex(/^\d{10}$/),
  insiderNameAtSec: z.string().min(1),
  lastUpdated: IsoDate,
  transactions: z.array(InsiderTransactionSchema),
});

export type Source = z.infer<typeof SourceSchema>;
export type PerkItem = z.infer<typeof PerkItemSchema>;
export type BeneficialOwnership = z.infer<typeof BeneficialOwnershipSchema>;
export type OwnershipLineItem = z.infer<typeof OwnershipLineItemSchema>;
export type BadgeKind = z.infer<typeof BadgeKindSchema>;
export type Badge = z.infer<typeof BadgeSchema>;
export type CompRecord = z.infer<typeof CompRecordSchema>;
export type Exec = z.infer<typeof ExecSchema>;
export type Company = z.infer<typeof CompanySchema>;
export type TransactionCode = z.infer<typeof TransactionCodeSchema>;
export type InsiderTransaction = z.infer<typeof InsiderTransactionSchema>;
export type InsiderTransactionsFile = z.infer<typeof InsiderTransactionsFileSchema>;
