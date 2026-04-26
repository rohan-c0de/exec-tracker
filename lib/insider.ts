import type { TransactionCode } from "./schemas";

type CodeDef = {
  label: string;
  description: string;
};

/**
 * SEC Form 4 transaction codes per Rule 16a-1 / Section 16. Stored as a
 * registry rather than denormalized into the data so labels can be tweaked
 * without rewriting every transaction record.
 */
export const TRANSACTION_CODES: Record<TransactionCode, CodeDef> = {
  A: {
    label: "Equity grant",
    description: "Grant, award, or other acquisition pursuant to Rule 16b-3(d).",
  },
  C: {
    label: "Conversion",
    description: "Conversion of derivative security.",
  },
  D: {
    label: "Disposition",
    description: "Disposition to the issuer.",
  },
  E: {
    label: "Short expiration",
    description: "Expiration of short derivative position.",
  },
  F: {
    label: "Tax withholding",
    description:
      "Payment of exercise price or tax liability by delivering or withholding securities (typical for RSU vest).",
  },
  G: {
    label: "Gift",
    description: "Bona fide gift.",
  },
  H: {
    label: "Long expiration",
    description: "Expiration (or cancellation) of long derivative position with value received.",
  },
  I: {
    label: "Plan discretionary",
    description: "Discretionary transaction in accordance with an employee benefit plan.",
  },
  J: {
    label: "Other",
    description: "Other acquisition or disposition.",
  },
  K: {
    label: "Equity swap",
    description: "Transaction in equity swap.",
  },
  L: {
    label: "Small acquisition",
    description: "Small acquisition under Rule 16a-6.",
  },
  M: {
    label: "Option exercise",
    description: "Exercise or conversion of derivative security exempted pursuant to Rule 16b-3.",
  },
  O: {
    label: "OTM exercise",
    description: "Exercise of out-of-the-money derivative security.",
  },
  P: {
    label: "Purchase",
    description: "Open market or private purchase.",
  },
  S: {
    label: "Sale",
    description: "Open market or private sale.",
  },
  U: {
    label: "Tender",
    description: "Disposition pursuant to a tender of shares in a change-of-control transaction.",
  },
  V: {
    label: "Voluntary",
    description: "Transaction voluntarily reported earlier than required.",
  },
  W: {
    label: "Inheritance",
    description: "Acquisition or disposition by will or laws of descent and distribution.",
  },
  X: {
    label: "ITM exercise",
    description: "Exercise of in-the-money or at-the-money derivative security.",
  },
  Z: {
    label: "Voting trust",
    description: "Deposit into or withdrawal from voting trust.",
  },
};
