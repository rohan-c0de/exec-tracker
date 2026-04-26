import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CompanySchema,
  ExecSchema,
  InsiderTransactionsFileSchema,
  type Company,
  type Exec,
  type InsiderTransactionsFile,
} from "./schemas";

const DATA_DIR = path.join(process.cwd(), "data");

export async function loadCompany(ticker: string): Promise<Company> {
  const file = path.join(DATA_DIR, "companies", `${ticker.toLowerCase()}.json`);
  const raw = await fs.readFile(file, "utf8");
  return CompanySchema.parse(JSON.parse(raw));
}

export async function loadExec(ticker: string, slug: string): Promise<Exec> {
  const file = path.join(DATA_DIR, "execs", ticker.toLowerCase(), `${slug}.json`);
  const raw = await fs.readFile(file, "utf8");
  return ExecSchema.parse(JSON.parse(raw));
}

export async function listCompanies(): Promise<Company[]> {
  const dir = path.join(DATA_DIR, "companies");
  const files = await fs.readdir(dir);
  const companies = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => CompanySchema.parse(JSON.parse(await fs.readFile(path.join(dir, f), "utf8")))),
  );
  return companies.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export async function listExecsForCompany(ticker: string): Promise<Exec[]> {
  const company = await loadCompany(ticker);
  return Promise.all(company.neoSlugs.map((slug) => loadExec(ticker, slug)));
}

export async function loadInsiderTransactions(
  ticker: string,
  slug: string,
): Promise<InsiderTransactionsFile | null> {
  const file = path.join(
    DATA_DIR,
    "insider-transactions",
    ticker.toLowerCase(),
    `${slug}.json`,
  );
  try {
    const raw = await fs.readFile(file, "utf8");
    return InsiderTransactionsFileSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
