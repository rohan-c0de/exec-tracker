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
const DEFAULT_CACHE_DIR = "/tmp/edgar-cache";

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

  /** Fetch a URL as text, with caching + rate limiting. */
  async fetchText(url: string): Promise<string> {
    const cached = await this.readCache(url);
    if (cached !== null) return cached;
    await this.respectRateLimit();
    const res = await fetch(url, { headers: { "User-Agent": this.userAgent } });
    if (!res.ok) {
      throw new Error(`EDGAR ${res.status} ${res.statusText} for ${url}`);
    }
    const body = await res.text();
    await this.writeCache(url, body);
    return body;
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

  private cachePath(url: string): string {
    const hash = createHash("sha256").update(url).digest("hex").slice(0, 32);
    const ext = url.endsWith(".json") ? "json" : url.endsWith(".xml") ? "xml" : "html";
    return path.join(this.cacheDir, `${hash}.${ext}`);
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

export type EdgarSubmissions = {
  cik: string;
  name: string;
  tickers: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      form: string[];
      filingDate: string[];
      reportDate: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
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
