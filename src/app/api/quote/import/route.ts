import { createHash } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import * as XLSX from "xlsx";

import { authOptions } from "@/lib/auth";
import { db, ensureQuoteTable } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxFileSize = 4 * 1024 * 1024;
const maxRecords = 3000;

class ImportLimitError extends Error {}

type ImportedLine = {
  sourceRow: number;
  existingDescription: string;
  proposedDescription: string;
  proposedWatts: string;
  proposedQty: number | null;
  productCost: number | null;
  sourceDate: string | null;
};

function headerKey(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findColumn(headers: unknown[], aliases: string[]) {
  const normalized = new Map(headers.map((value, index) => [headerKey(value), index]));
  return aliases.map(headerKey).map((alias) => normalized.get(alias)).find((index) => index !== undefined);
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number") {
    const parts = XLSX.SSF.parse_date_code(value);
    if (parts) return new Date(Date.UTC(parts.y, parts.m - 1, parts.d, parts.H, parts.M, Math.floor(parts.S))).toISOString();
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function parseCost(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  const normalized = String(value ?? "").replace(/[$,\s]/g, "");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function parseQuantity(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100_000 ? parsed : null;
}

function detectRecords(workbook: XLSX.WorkBook) {
  const existingAliases = ["existingfixture", "existingdescription", "existingfixturedescription", "fixturetoreplace", "fixturebeingreplaced", "oldfixture", "existing"];
  const proposedAliases = ["proposedfixture", "proposeddescription", "replacementfixture", "recommendedfixture", "newfixture", "replacement", "proposed"];
  const wattsAliases = ["proposedwatts", "replacementwatts", "newwatts", "watts", "wattage"];
  const quantityAliases = ["proposedqty", "replacementqty", "quantity", "qty", "count"];
  const costAliases = ["unitproductcost", "unitcost", "productcost", "materialunitcost", "materialcost", "unitprice", "cost"];
  const dateAliases = ["quotedate", "proposaldate", "pricedate", "date"];
  const records: ImportedLine[] = [];
  let detectedSheet = "";
  let skippedRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rangeReference = sheet["!ref"];
    if (typeof rangeReference === "string") {
      const range = XLSX.utils.decode_range(rangeReference);
      if (range.e.r - range.s.r + 1 > 10_000 || range.e.c - range.s.c + 1 > 120) {
        throw new ImportLimitError("A workbook sheet exceeds the 10,000-row or 120-column import limit");
      }
    }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
    let headerRow = -1;
    let columns: { existing?: number; proposed?: number; watts?: number; quantity?: number; cost?: number; date?: number } = {};
    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 30); rowIndex += 1) {
      const row = rows[rowIndex] || [];
      const candidate = {
        existing: findColumn(row, existingAliases),
        proposed: findColumn(row, proposedAliases),
        watts: findColumn(row, wattsAliases),
        quantity: findColumn(row, quantityAliases),
        cost: findColumn(row, costAliases),
        date: findColumn(row, dateAliases),
      };
      if (candidate.existing !== undefined && candidate.proposed !== undefined) {
        headerRow = rowIndex;
        columns = candidate;
        break;
      }
    }
    if (headerRow < 0 || columns.existing === undefined || columns.proposed === undefined) continue;
    detectedSheet ||= sheetName;

    for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] || [];
      const existingDescription = String(row[columns.existing] ?? "").trim().slice(0, 1000);
      const proposedDescription = String(row[columns.proposed] ?? "").trim().slice(0, 1000);
      if (!existingDescription && !proposedDescription) continue;
      if (!existingDescription || !proposedDescription || records.length >= maxRecords) {
        skippedRows += 1;
        continue;
      }
      const rawWatts = columns.watts === undefined ? "" : String(row[columns.watts] ?? "").trim();
      const rawDate = columns.date === undefined ? null : parseDate(row[columns.date]);
      records.push({
        sourceRow: records.length + 1,
        existingDescription,
        proposedDescription,
        proposedWatts: rawWatts.slice(0, 100),
        proposedQty: columns.quantity === undefined ? null : parseQuantity(row[columns.quantity]),
        productCost: columns.cost === undefined ? null : parseCost(row[columns.cost]),
        sourceDate: rawDate,
      });
    }
  }
  return { records, detectedSheet, skippedRows };
}

async function getEmployeeEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  return email?.endsWith("@renewlighting.com") ? email : null;
}

export async function POST(request: Request) {
  const email = await getEmployeeEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload a valid multipart Excel or CSV file" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an Excel or CSV file" }, { status: 400 });
  if (file.size <= 0 || file.size > maxFileSize) {
    return NextResponse.json({ error: "The file must be between 1 byte and 4 MB" }, { status: 413 });
  }
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return NextResponse.json({ error: "Supported formats are .xlsx, .xls, and .csv" }, { status: 415 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true, dense: true });
    if (workbook.SheetNames.length > 30) {
      return NextResponse.json({ error: "The workbook has too many sheets to import safely" }, { status: 422 });
    }
    const { records, detectedSheet, skippedRows } = detectRecords(workbook);
    if (!detectedSheet) {
      return NextResponse.json({
        error: "Could not find columns for both existing fixture and proposed/replacement fixture. Use a sheet with clear column headers.",
      }, { status: 422 });
    }
    if (!records.length) {
      return NextResponse.json({ error: "No complete existing-to-proposed fixture rows were found" }, { status: 422 });
    }
    return NextResponse.json({
      fileHash,
      fileName: file.name.slice(0, 200),
      sheetName: detectedSheet,
      records,
      skippedRows,
      maxRecordsReached: records.length === maxRecords,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Quote history workbook parsing failed:", error);
    if (error instanceof ImportLimitError) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: "This workbook could not be read. Check that it is a valid Excel or CSV file." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const email = await getEmployeeEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const fileHash = typeof body?.fileHash === "string" && /^[a-f0-9]{64}$/i.test(body.fileHash) ? body.fileHash.toLowerCase() : null;
  const fileName = typeof body?.fileName === "string" ? body.fileName.slice(0, 200) : "";
  if (!fileHash || !fileName || !Array.isArray(body?.records) || body.records.length === 0 || body.records.length > maxRecords) {
    return NextResponse.json({ error: "The reviewed workbook import is invalid" }, { status: 400 });
  }

  const records: ImportedLine[] = [];
  const sourceRows = new Set<number>();
  for (const [index, record] of body.records.entries()) {
    const existingDescription = typeof record?.existingDescription === "string" ? record.existingDescription.trim().slice(0, 1000) : "";
    const proposedDescription = typeof record?.proposedDescription === "string" ? record.proposedDescription.trim().slice(0, 1000) : "";
    const sourceRow = Number(record?.sourceRow);
    const proposedQty = record?.proposedQty === null ? null : Number(record?.proposedQty);
    const productCost = record?.productCost === null ? null : Number(record?.productCost);
    const sourceDate = record?.sourceDate === null || record?.sourceDate === "" ? null : parseDate(record?.sourceDate);
    if (!existingDescription || !proposedDescription || !Number.isSafeInteger(sourceRow) || sourceRow < 1
      || productCost !== null && (!Number.isFinite(productCost) || productCost < 0 || productCost > 1_000_000)
      || proposedQty !== null && (!Number.isFinite(proposedQty) || proposedQty <= 0 || proposedQty > 100_000)
      || record?.sourceDate && !sourceDate || sourceRows.has(sourceRow)) {
      return NextResponse.json({ error: `Invalid proposal row ${index + 1}` }, { status: 400 });
    }
    sourceRows.add(sourceRow);
    records.push({
      sourceRow,
      existingDescription,
      proposedDescription,
      proposedWatts: typeof record?.proposedWatts === "string" ? record.proposedWatts.slice(0, 100) : "",
      proposedQty,
      productCost,
      sourceDate,
    });
  }

  let client: PoolClient | null = null;
  let transactionStarted = false;
  try {
    await ensureQuoteTable();
    const connection = await db.connect();
    client = connection;
    await connection.query("BEGIN");
    transactionStarted = true;
    const result = await connection.query(
      `INSERT INTO quote_suggestion_history
        (owner_email, existing_description, proposed_description, proposed_watts, proposed_qty, product_cost, source_date, source_file_hash, source_row)
       SELECT $1, imported.existing_description, imported.proposed_description, imported.proposed_watts,
         imported.proposed_qty, imported.product_cost, imported.source_date, $2, imported.source_row
       FROM unnest($3::integer[], $4::text[], $5::text[], $6::text[], $7::numeric[], $8::numeric[], $9::timestamptz[])
         AS imported(source_row, existing_description, proposed_description, proposed_watts, proposed_qty, product_cost, source_date)
       ON CONFLICT (owner_email, source_file_hash, source_row) DO NOTHING`,
      [
        email,
        fileHash,
        records.map((record) => record.sourceRow),
        records.map((record) => record.existingDescription),
        records.map((record) => record.proposedDescription),
        records.map((record) => record.proposedWatts),
        records.map((record) => record.proposedQty),
        records.map((record) => record.productCost),
        records.map((record) => record.sourceDate),
      ],
    );
    const inserted = result.rowCount || 0;
    await connection.query("COMMIT");
    transactionStarted = false;
    return NextResponse.json({ imported: inserted, duplicates: records.length - inserted, fileName });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Quote history import rollback failed:", rollbackError);
      }
    }
    console.error("Quote history import failed:", error);
    return NextResponse.json({ error: "The quote history could not be imported" }, { status: 503 });
  } finally {
    client?.release();
  }
}
