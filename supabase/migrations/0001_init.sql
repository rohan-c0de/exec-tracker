-- Phase 1 schema for exec-tracker.
--
-- Authored, not pushed. Phase 1 reads JSON under data/ via fs at build time;
-- Supabase becomes load-bearing only when Phase 2 scrapers come online or
-- billing on the shared 'cc' org is resolved. See project memory for context.
--
-- Migrations are append-only — never edit a committed migration. Schema
-- corrections go in a new file (0002_..., 0003_...).

create extension if not exists "pgcrypto";

-- Companies: one row per public company we track.
create table public.companies (
  ticker                    text primary key,
  legal_name                text not null,
  display_name              text,
  exchange                  text not null check (exchange in ('NASDAQ', 'NYSE', 'AMEX', 'OTHER')),
  sec_cik                   text not null unique check (sec_cik ~ '^\d{10}$'),
  fiscal_year_end_month_day text not null check (fiscal_year_end_month_day ~ '^\d{2}-\d{2}$'),
  website_url               text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index companies_legal_name_idx on public.companies (legal_name);

-- Executives: one row per NEO. Composite identity is (ticker, slug); we also
-- expose a UUID for future foreign-key joins from external tables.
create table public.executives (
  id          uuid primary key default gen_random_uuid(),
  ticker      text not null references public.companies (ticker) on delete cascade,
  slug        text not null check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  role        text not null,
  bio         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (ticker, slug)
);

create index executives_ticker_idx on public.executives (ticker);

-- Compensation records: one row per (executive, fiscal_year). All money columns
-- in integer cents per project invariant #5. Source citation is required per
-- invariant #1 — every comp number must be traceable to a SEC filing.
create table public.comp_records (
  id                          uuid primary key default gen_random_uuid(),
  executive_id                uuid not null references public.executives (id) on delete cascade,
  fiscal_year                 integer not null check (fiscal_year between 1990 and 2100),
  fiscal_year_end             date not null,

  salary_cents                bigint not null default 0 check (salary_cents >= 0),
  bonus_cents                 bigint not null default 0 check (bonus_cents >= 0),
  stock_awards_cents          bigint not null default 0 check (stock_awards_cents >= 0),
  option_awards_cents         bigint not null default 0 check (option_awards_cents >= 0),
  non_equity_incentive_cents  bigint not null default 0 check (non_equity_incentive_cents >= 0),
  pension_and_nqdc_cents      bigint not null default 0 check (pension_and_nqdc_cents >= 0),
  all_other_comp_cents        bigint not null default 0 check (all_other_comp_cents >= 0),
  total_cents                 bigint not null check (total_cents >= 0),

  footnotes                   text[] not null default '{}',

  source_filing_url           text not null,
  source_accession_number     text not null check (source_accession_number ~ '^\d{10}-\d{2}-\d{6}$'),
  source_form_type            text not null default 'DEF 14A' check (source_form_type = 'DEF 14A'),
  source_filed_date           date not null,
  source_period_of_report     date not null,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (executive_id, fiscal_year)
);

create index comp_records_exec_idx on public.comp_records (executive_id, fiscal_year desc);

-- Read-only access for the public site. Service role is used for imports.
alter table public.companies    enable row level security;
alter table public.executives   enable row level security;
alter table public.comp_records enable row level security;

create policy "anon_read_companies"    on public.companies    for select to anon using (true);
create policy "anon_read_executives"   on public.executives   for select to anon using (true);
create policy "anon_read_comp_records" on public.comp_records for select to anon using (true);
