/**
 * Unit tests for namesMatch.
 *
 * namesMatch is the load-bearing tokenizer in scripts/lib/cik.ts that decides
 * whether SEC's "Lastname Firstname Middle" string matches our display-name
 * for an exec. It's deliberately loose (tokens are set-compared, our tokens
 * must all appear in SEC's), so that nicknames like "BJ Jenkins" can still
 * match SEC's "Jenkins William D Jr" when paired with a `secCik` override.
 *
 * Loose matching means false positives are theoretically possible — e.g.
 * "John Smith" matches both "Smith John Patrick" and "Smith John Allen".
 * That's caught by the multi-match guard in findInsiderCik (PR #19), but
 * the tokenizer itself remains the first line of defense.
 *
 * If you tighten namesMatch, the cases marked with `// nickname-fallback`
 * below MUST continue to pass — those are real overrides shipping in the
 * data/execs/ JSONs and breaking them would force re-onboarding work.
 *
 * Run: tsx scripts/test/names-match.test.ts
 */

import { namesMatch } from "../lib/cik";

type Case = { sec: string; ours: string; expected: boolean; note?: string };

const cases: Case[] = [
  // --- Exact matches that should pass ---
  { sec: "Kurtz George", ours: "George Kurtz", expected: true },
  { sec: "Arora Nikesh", ours: "Nikesh Arora", expected: true },
  { sec: "Larson Barbara A", ours: "Barbara Larson", expected: true,
    note: "SEC adds middle initial; our display name is shorter — should still match" },

  // --- Nickname-fallback cases (load-bearing for current data) ---
  // For each of these, namesMatch must currently return FALSE — they're the
  // reason the secCik override exists. If a future tightening makes them
  // *appear* to match, that's actually fine; if it makes them break a
  // currently-working secCik override, that's a regression.
  { sec: "Jenkins William D Jr", ours: "BJ Jenkins", expected: false,
    note: "nickname-fallback: BJ ∉ {jenkins,william,d,jr} — relies on secCik override" },
  { sec: "Chaudhry Jagtar Singh", ours: "Jay Chaudhry", expected: false,
    note: "nickname-fallback: jay ∉ {chaudhry,jagtar,singh}" },
  { sec: "Rich Michael J.", ours: "Mike Rich", expected: false,
    note: "nickname-fallback: mike ∉ {rich,michael,j}" },
  { sec: "Smith Ric", ours: "Richard Smith, Jr.", expected: false,
    note: "nickname-fallback: SEC short form 'Ric'; our 'Richard' ∉ {smith,ric}" },
  { sec: "Srivatsan Narayanan", ours: 'Narayanan "Vats" Srivatsan', expected: false,
    note: 'nickname-fallback: our quoted "Vats" tokenizes with quotes, SEC has no Vats' },

  // --- False-positive cases (current loose tokenizer accepts these) ---
  // namesMatch is permissive: any two tokens of OUR name appearing in SEC's
  // tokens is enough to match. These cases are why the multi-match guard in
  // findInsiderCik is required — both legitimate and illegitimate matches
  // can return true, the guard catches when more than one CIK does.
  { sec: "Smith John Patrick", ours: "John Smith", expected: true,
    note: "false-positive risk: a different 'Smith John Patrick' would match our generic 'John Smith'" },
  { sec: "Smith John Allen", ours: "John Smith", expected: true,
    note: "false-positive risk: same — multi-match guard required to disambiguate" },

  // --- Edge cases ---
  { sec: "", ours: "Some Person", expected: false,
    note: "empty SEC name → no tokens, our tokens can't all match" },
  { sec: "Doe Jane", ours: "", expected: false,
    note: "empty our name → namesMatch contract: false" },
  { sec: "DOE JANE", ours: "jane doe", expected: true,
    note: "case-insensitive normalization" },
  { sec: "Doe, Jane", ours: "Jane Doe", expected: true,
    note: "comma stripped by normalize()" },
  { sec: "Doe Jane.", ours: "Jane Doe", expected: true,
    note: "trailing period stripped" },
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const c of cases) {
  const got = namesMatch(c.sec, c.ours);
  const ok = got === c.expected;
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(
      `  sec=${JSON.stringify(c.sec)}, ours=${JSON.stringify(c.ours)}: expected ${c.expected}, got ${got}` +
        (c.note ? `\n      (${c.note})` : ""),
    );
  }
}

console.log(`namesMatch: ${passed}/${cases.length} cases passed`);
if (failed > 0) {
  console.error(`\n✗ ${failed} failure(s):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("✓ all namesMatch cases passed");
