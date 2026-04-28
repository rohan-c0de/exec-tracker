/**
 * EDGAR HTTP client.
 *
 * Enforces SEC's two non-negotiable requirements (per CLAUDE.md invariants):
 *   1. User-Agent must include contact info ("exec-tracker <email>").
 *   2. Request rate must not exceed 10/sec.
 *
 * Adds a disk cache so repeated dev iterations don't re-hit SEC. Filings are
 * immutable once filed — no TTL needed.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const RATE_LIMIT_MS = 110; // ~9 req/sec, comfortably under SEC's 10/sec cap
const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 500;

// In-repo so it survives reboots and serves as an audit trail.
// Gitignored via .gitignore (`scripts/scrapers/_cache/`).
const DEFAULT_CACHE_DIR = path.join(
  process.cwd(),
  "scripts",
  "scrapers",
  "_cache",
  "edgar",
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class EdgarClient {
  private lastRequestAt = 0;

  constructor(
    private readonly userAgent: string,
    private readonly cacheDir: string = DEFAULT_CACHE_DIR,
  ) {
    if (!userAgent || !userAgent.includes("@")) {
      throw new Error(
        `EdgarClient: user-agent must include contact email. Got: ${JSON.stringify(userAgent)}`,
      );
    }
  }

  /**
   * Fetch a URL as text, with disk cache, rate limiting, and exponential
   * backoff on 429 / 5xx responses (and on transport-level errors).
   *
   * Filings on EDGAR are immutable once filed, so a successful response is
   * cached forever. Failures are not cached.
   */
  async fetchText(url: string): Promise<string> {
    const cached = await this.readCache(url);
    if (cached !== null) return cached;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.respectRateLimit();
      let res: Response;
      try {
        res = await fetch(url, { headers: { "User-Agent": this.userAgent } });
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          const wait = BACKOFF_BASE_MS * Math.pow(2, attempt);
          console.warn(
            `EDGAR fetch error (attempt ${attempt + 1}/${MAX_RETRIES + 1}) for ${url}: ${lastError.message}. Retrying in ${wait}ms.`,
          );
          await sleep(wait);
          continue;
        }
        break;
      }

      if (res.ok) {
        const body = await res.text();
        await this.writeCache(url, body);
        return body;
      }

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        const retryAfterHeader = res.headers.get("Retry-After");
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
        const wait = Number.isFinite(retryAfterMs) && retryAfterMs > 0
          ? Math.max(retryAfterMs, BACKOFF_BASE_MS)
          : BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.warn(
          `EDGAR ${res.status} ${res.statusText} (attempt ${attempt + 1}/${MAX_RETRIES + 1}) for ${url}. Retrying in ${wait}ms.`,
        );
        lastError = new Error(`EDGAR ${res.status} ${res.statusText}`);
        await sleep(wait);
        continue;
      }
      // Non-retryable status (4xx other than 429), or out of retries.
      throw new Error(`EDGAR ${res.status} ${res.statusText} for ${url}`);
    }
    throw new Error(
      `EDGAR fetch failed after ${MAX_RETRIES + 1} attempts for ${url}: ${lastError?.message ?? "unknown error"}`,
    );
  }

  /** Fetch a URL as JSON. */
  async fetchJson<T = unknown>(url: string): Promise<T> {
    const text = await this.fetchText(url);
    return JSON.parse(text) as T;
  }

  /** EDGAR submissions API for a given CIK. CIK should be 10-digit zero-padded. */
  async getSubmissions(cik: string): Promise<EdgarSubmissions> {
    if (!/^\d{10}$/.test(cik)) {
      throw new Error(`getSubmissions: CIK must be 10-digit zero-padded. Got: ${cik}`);
    }
    return this.fetchJson<EdgarSubmissions>(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
    );
  }

  /**
   * Build the canonical URL for a primary document inside a filing.
   * Accession is the dashed form (e.g. 0001104659-25-045047).
   */
  filingUrl(cik: string, accession: string, primaryDocument: string): string {
    const cikInt = parseInt(cik, 10).toString();
    const accessionFlat = accession.replace(/-/g, "");
    return `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accessionFlat}/${primaryDocument}`;
  }

  // ---------- internals ----------

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
    }
    this.lastRequestAt = Date.now();
  }

  /**
   * Derive a grep-friendly cache path from the URL:
   *   data.sec.gov/submissions/CIK0001583708.json
   *     → {cacheDir}/submissions/CIK0001583708.json
   *   www.sec.gov/Archives/edgar/data/1583708/000158370825000095/s-20250514.htm
   *     → {cacheDir}/archives/1583708/000158370825000095/s-20250514.htm
   * Anything else → URL-hash filename (preserves cache without inventing structure).
   */
  private cachePath(url: string): string {
    try {
      const u = new URL(url);
      if (u.hostname === "data.sec.gov" && u.pathname.startsWith("/submissions/")) {
        return path.join(this.cacheDir, "submissions", path.basename(u.pathname));
      }
      if (u.hostname === "www.sec.gov" && u.pathname.startsWith("/Archives/edgar/data/")) {
        const rest = u.pathname.replace(/^\/Archives\/edgar\/data\//, "");
        return path.join(this.cacheDir, "archives", ...rest.split("/"));
      }
    } catch {
      // fall through to hash fallback
    }
    const hash = createHash("sha256").update(url).digest("hex").slice(0, 32);
    const ext = url.endsWith(".json") ? "json" : url.endsWith(".xml") ? "xml" : "html";
    return path.join(this.cacheDir, "misc", `${hash}.${ext}`);
  }

  private async readCache(url: string): Promise<string | null> {
    try {
      return await fs.readFile(this.cachePath(url), "utf8");
    } catch {
      return null;
    }
  }

  private async writeCache(url: string, body: string): Promise<void> {
    const file = this.cachePath(url);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body, "utf8");
  }
}

// ---------- shared SEC submissions API types ----------

export type EdgarSubmissionsRecent = {
  accessionNumber: string[];
  form: string[];
  filingDate: string[];
  reportDate: string[];
  primaryDocument: string[];
  primaryDocDescription: string[];
};

/**
 * Older year-bucket file referenced by the submissions API. The JSON at
 * `https://data.sec.gov/submissions/{name}` has the same shape as
 * `filings.recent`. The `filings.files` array is empty for issuers whose
 * total filing count fits in `recent` (~1000 most recent).
 */
export type EdgarSubmissionsFile = {
  name: string;
  filingCount: number;
  filingFrom: string;
  filingTo: string;
};

export type EdgarSubmissions = {
  cik: string;
  name: string;
  tickers: string[];
  filings: {
    recent: EdgarSubmissionsRecent;
    files: EdgarSubmissionsFile[];
  };
};

/**
 * Construct an EdgarClient using SEC_USER_AGENT from env (or .env.local fallback).
 */
export async function makeEdgarClient(): Promise<EdgarClient> {
  let ua = process.env.SEC_USER_AGENT;
  if (!ua) {
    // Fallback: read .env.local manually so scripts work without dotenv
    try {
      const env = await fs.readFile(
        path.join(process.cwd(), ".env.local"),
        "utf8",
      );
      const match = env.match(/^SEC_USER_AGENT=(.+)$/m);
      if (match) ua = match[1]!.trim().replace(/^["']|["']$/g, "");
    } catch {
      // ignore — will throw below
    }
  }
  if (!ua) {
    throw new Error(
      "SEC_USER_AGENT env var is required (set in .env.local or shell env). Format: 'exec-tracker your-email@example.com'",
    );
  }
  return new EdgarClient(ua);
}
