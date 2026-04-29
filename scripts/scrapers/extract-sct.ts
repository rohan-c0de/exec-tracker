/**
 * Summary Compensation Table extractor.
 *
 * Calls Claude API with structured output to extract per-NEO comp records
 * from a DEF 14A's SCT section. Schema validation rejects malformed output
 * — we never silently misread numbers.
 *
 * Architecture rationale: see scripts/scrapers/DEF14A.md.
 *
 * Input: an HTML chunk anchored at the SCT (use locateSctChunk in
 * discovery.ts to obtain it). The chunk should be ~30-60KB and include
 * the table itself plus immediate footnotes.
 *
 * Output: validated against ScrapedSctSchema; converts whole dollars to
 * integer cents downstream (we never let the LLM do arithmetic).
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// LLM-facing schema. Whole dollars are easier for the model than cents
// (no big-number arithmetic risk); we convert to cents in TS.
const NonNegativeDollar = z.number().int().nonnegative();

const ScrapedCompRecordSchema = z.object({
  fiscalYear: z.number().int().min(1990).max(2100),
  salaryDollars: NonNegativeDollar,
  bonusDollars: NonNegativeDollar,
  stockAwardsDollars: NonNegativeDollar,
  optionAwardsDollars: NonNegativeDollar,
  nonEquityIncentiveDollars: NonNegativeDollar,
  pensionAndNqdcDollars: NonNegativeDollar,
  allOtherCompDollars: NonNegativeDollar,
  totalDollars: NonNegativeDollar,
});

const ScrapedNeoSchema = z.object({
  name: z.string().min(1).describe("Full name as printed in the proxy, e.g. 'Tim Cook'"),
  role: z.string().min(1).describe(
    "Title as printed in the SCT row, e.g. 'Chief Executive Officer' or 'Former Senior Vice President, Chief Financial Officer'",
  ),
  isFormer: z.boolean().describe("True if the role string starts with 'Former'"),
  compRecords: z.array(ScrapedCompRecordSchema).min(1),
});

export const ScrapedSctSchema = z.object({
  neos: z.array(ScrapedNeoSchema).min(1),
});

export type ScrapedSct = z.infer<typeof ScrapedSctSchema>;
export type ScrapedNeo = z.infer<typeof ScrapedNeoSchema>;

const MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `You are an exec-comp data extractor. You read SEC DEF 14A proxy statements (Item 402) and return structured Summary Compensation Table data.

INSTRUCTIONS

For every Named Executive Officer (NEO) in the SCT, output one entry under "neos" with:
- name: the NEO's full name as printed in the proxy
- role: their title as printed in the SCT row. If the role starts with "Former" (e.g. "Former Senior Vice President, Chief Financial Officer"), keep that prefix in the role string and set isFormer to true.
- isFormer: true iff the role begins with "Former"
- compRecords: one entry per fiscal year disclosed for that NEO. The SCT typically discloses 3 years per filing, but new NEOs may have fewer.

For each compRecord, return all columns of the SCT in WHOLE DOLLARS (integers, not cents):
- fiscalYear: integer (proxy's year label, e.g. 2025, 2024, 2023)
- salaryDollars
- bonusDollars
- stockAwardsDollars
- optionAwardsDollars
- nonEquityIncentiveDollars
- pensionAndNqdcDollars
- allOtherCompDollars
- totalDollars (must equal the sum of the seven components UNLESS the proxy itself rounds; if there is a discrepancy, prefer the proxy's stated total)

CRITICAL RULES

1. NEVER fabricate numbers. If a column is blank, dash, or zero in the proxy, output 0.
2. If a column is not disclosed in this filing (some smaller filers omit "Pension & NQDC"), output 0.
3. Strip footnote markers like (1), (2), (a) from numbers — they are not part of the value.
4. Some proxies use commas (e.g. "3,000,000") and some don't. Always output as integer dollars (3000000).
5. "Bonus" and "Non-Equity Incentive Plan Compensation" are different SCT columns and frequently confused. Read the column headers carefully:
   - Bonus = discretionary cash, no formal performance plan
   - Non-Equity Incentive = cash from a formal performance plan with predetermined targets
6. If a number is illegible, ambiguous, or you are not confident, omit the entire compRecord rather than guess.
7. The order of NEOs in your output should match the proxy's order in the SCT.

You will receive an HTML chunk anchored at the Summary Compensation Table. The chunk includes the table and surrounding footnotes — read both before extracting.`;

/**
 * Extract SCT data from a proxy HTML chunk.
 *
 * The chunk should already be windowed around the SCT (use locateSctChunk
 * in discovery.ts). Passing the full proxy HTML works but is wasteful —
 * the LLM has to scan ~1.2MB instead of ~60KB.
 */
export async function extractSct(htmlChunk: string): Promise<ScrapedSct> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("extractSct: ANTHROPIC_API_KEY env var is required");
  }
  if (htmlChunk.length < 1000) {
    throw new Error(`extractSct: htmlChunk too short (${htmlChunk.length} chars)`);
  }

  const client = new Anthropic();

  // Stream because max_tokens is large enough that a non-streaming call
  // could hit the SDK HTTP timeout. finalMessage() collects the parsed result.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // Cache the system prompt — it's identical across every company we scrape.
        // Only the user-turn HTML chunk varies, so this is the textbook
        // shared-prefix-varying-suffix pattern from shared/prompt-caching.md.
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      format: zodOutputFormat(ScrapedSctSchema),
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract the Summary Compensation Table from this DEF 14A proxy chunk:\n\n${htmlChunk}`,
          },
        ],
      },
    ],
  });

  const finalMessage = await stream.finalMessage();

  // The structured-output parser returns parsed_output when zodOutputFormat
  // is set on a stream/.create() call. (`messages.parse()` does it more
  // automatically, but we want streaming to avoid timeouts.)
  // Manually run Zod over the response text.
  const textBlock = finalMessage.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("extractSct: no text block in response");
  }
  const parsed = JSON.parse(textBlock.text);
  const validated = ScrapedSctSchema.parse(parsed);

  return validated;
}
