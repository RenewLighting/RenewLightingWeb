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
  `).then(() => undefined);
  return quoteTableReady;
}