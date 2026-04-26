import { z } from "zod";

const Cents = z.number().int().nonnegative();
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const Url = z.string().url();
const Slug = z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits, hyphens only");
const Ticker = z.string().regex(/^[A-Z]{1,5}$/, "uppercase ticker, 1-5 chars");

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
    footnotes: z.array(z.string()).default([]),
    allOtherBreakdown: z.array(PerkItemSchema).optional(),
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

export type Source = z.infer<typeof SourceSchema>;
export type PerkItem = z.infer<typeof PerkItemSchema>;
export type CompRecord = z.infer<typeof CompRecordSchema>;
export type Exec = z.infer<typeof ExecSchema>;
export type Company = z.infer<typeof CompanySchema>;
