import { Pool } from "pg";

const globalForDb = globalThis as unknown as { quotePool?: Pool };

export const db = globalForDb.quotePool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false,
});

if (process.env.NODE_ENV !== "production") globalForDb.quotePool = db;

let quoteTableReady: Promise<void> | undefined;

export function ensureQuoteTable() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  quoteTableReady ??= db.query(`
    CREATE TABLE IF NOT EXISTS quotes (
      id BIGSERIAL PRIMARY KEY,
      owner_email TEXT NOT NULL,
      project_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'rejected', 'archived')),
      quote_data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_quotes_owner_updated ON quotes(owner_email, updated_at DESC);
    CREATE TABLE IF NOT EXISTS quote_suggestion_history (
      id BIGSERIAL PRIMARY KEY,
      owner_email TEXT NOT NULL,
      existing_description TEXT NOT NULL,
      proposed_description TEXT NOT NULL,
      proposed_watts TEXT NOT NULL DEFAULT '',
      product_cost NUMERIC,
      source_date TIMESTAMPTZ,
      source_file_hash TEXT NOT NULL,
      source_row INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (owner_email, source_file_hash, source_row)
    );
    CREATE INDEX IF NOT EXISTS idx_quote_suggestion_history_owner ON quote_suggestion_history(owner_email, source_date DESC);
  `).then(() => undefined);
  return quoteTableReady;
}