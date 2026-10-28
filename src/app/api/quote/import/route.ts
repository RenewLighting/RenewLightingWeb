import { createHash, randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import * as XLSX from "xlsx";

import { authOptions } from "@/lib/auth";
import { db, ensureQuoteTable } from "@/lib/db";
import { parseQuoteWorkbook } from "@/lib/quote-workbook-import";
import type { Quote, QuoteLine } from "@/lib/quote";

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
  const existingAliases = ["existingfixture", "existingdescription", "existingfixturedescription", "existingfixturedescrption", "fixturetoreplace", "fixturebeingreplaced", "oldfixture", "existing"];
  const proposedAliases = ["proposedfixture", "proposeddescription", "proposedfixturedescrption", "replacementfixture", "recommendedfixture", "newfixture", "replacement", "proposed"];
  const wattsAliases = ["proposedwatts", "replacementwatts", "newwatts", "inputwatts", "watts", "wattage"];
  const quantityAliases = ["proposedqty", "proposedfixtureqty", "replacementqty", "quantity", "qty", "count"];
  const costAliases = ["unitproductcost", "unitcost", "productcost", "materialunitcost", "materialcost", "unitprice", "cost"];
  const dateAliases = ["quotedate", "proposaldate", "pricedate", "date"];
  const records: ImportedLine[] = [];
  const seenSheetRecords = new Set<string>();
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

    const sheetRecords: Omit<ImportedLine, "sourceRow">[] = [];
    for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] || [];
      const existingDescription = String(row[columns.existing] ?? "").trim().slice(0, 1000);
      const proposedDescription = String(row[columns.proposed] ?? "").trim().slice(0, 1000);
      if (!existingDescription && !proposedDescription) continue;
      if (!existingDescription || !proposedDescription || records.length + sheetRecords.length >= maxRecords) {
        skippedRows += 1;
        continue;
      }
      const rawWatts = columns.watts === undefined ? "" : String(row[columns.watts] ?? "").trim();
      const rawDate = columns.date === undefined ? null : parseDate(row[columns.date]);
      sheetRecords.push({
        existingDescription,
        proposedDescription,
        proposedWatts: rawWatts.slice(0, 100),
        proposedQty: columns.quantity === undefined ? null : parseQuantity(row[columns.quantity]),
        productCost: columns.cost === undefined ? null : parseCost(row[columns.cost]),
        sourceDate: rawDate,
      });
    }

    const sheetSignature = JSON.stringify(sheetRecords);
    if (sheetRecords.length && !seenSheetRecords.has(sheetSignature)) {
      seenSheetRecords.add(sheetSignature);
      records.push(...sheetRecords.map((record, index) => ({ ...record, sourceRow: records.length + index + 1 })));
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
  if (!/\.(xlsx|xls|xlsm|csv)$/i.test(file.name)) {
    return NextResponse.json({ error: "Supported formats are .xlsx, .xls, .xlsm, and .csv" }, { status: 415 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const quoteImport = parseQuoteWorkbook(bytes, file.name);
    if (quoteImport.recognized) {
      if (!quoteImport.quote) {
        return NextResponse.json({ error: "This workbook contains only a blank quote template; no quote history was created." }, { status: 422 });
      }
      return NextResponse.json({
        kind: "quote",
        fileHash,
        fileName: file.name.slice(0, 200),
        sheetName: quoteImport.sheetName,
        quote: quoteImport.quote,
        records: [],
        photoCount: quoteImport.photos.length,
        skippedPhotos: quoteImport.skippedPhotos,
      }, { headers: { "Cache-Control": "no-store" } });
    }

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
      kind: "suggestions",
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

async function importQuoteWorkbook(request: Request, email: string) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload the reviewed quote workbook again" }, { status: 400 });
  }
  const file = form.get("file");
  const expectedHash = form.get("fileHash");
  if (!(file instanceof File) || !/^[a-f0-9]{64}$/i.test(String(expectedHash || ""))) {
    return NextResponse.json({ error: "The reviewed quote workbook is invalid" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > maxFileSize) {
    return NextResponse.json({ error: "The file must be between 1 byte and 4 MB" }, { status: 413 });
  }
  if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
    return NextResponse.json({ error: "Quote history imports require an Excel workbook" }, { status: 415 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  if (fileHash !== String(expectedHash).toLowerCase()) {
    return NextResponse.json({ error: "The workbook changed after preview. Preview it again before importing." }, { status: 409 });
  }

  let parsed;
  try {
    parsed = parseQuoteWorkbook(bytes, file.name);
  } catch (error) {
    console.error("Quote workbook import parsing failed:", error);
    return NextResponse.json({ error: "This quote workbook could not be read. Check that it is a valid Excel file." }, { status: 400 });
  }
  if (!parsed.recognized || !parsed.quote) {
    return NextResponse.json({ error: "The reviewed workbook does not contain a completed quote." }, { status: 422 });
  }

  let client: PoolClient | null = null;
  let transactionStarted = false;
  try {
    await ensureQuoteTable();
    const connection = await db.connect();
    client = connection;
    await connection.query("BEGIN");
    transactionStarted = true;

    const priorImport = await connection.query(
      "SELECT id FROM quotes WHERE owner_email = $1 AND import_file_hash = $2",
      [email, fileHash],
    );
    if (priorImport.rows.length) {
      await connection.query("COMMIT");
      transactionStarted = false;
      return NextResponse.json({ imported: false, duplicate: true, quoteId: priorImport.rows[0].id, fileName: file.name });
    }

    for (const photo of parsed.photos) {
      const photoId = randomUUID();
      parsed.quote.lines[photo.lineIndex].photoIds.push(photoId);
      await connection.query(
        "INSERT INTO quote_line_photos (id, owner_email, content_type, image_data) VALUES ($1, $2, $3, $4)",
        [photoId, email, photo.contentType, Buffer.from(photo.imageData)],
      );
    }

    const result = await connection.query(
      `INSERT INTO quotes (owner_email, project_name, status, quote_data, import_file_hash, import_file_name)
       VALUES ($1, $2, 'imported', $3::jsonb, $4, $5)
       ON CONFLICT (owner_email, import_file_hash) WHERE import_file_hash IS NOT NULL DO NOTHING
       RETURNING id`,
      [email, parsed.quote.projectName, JSON.stringify(parsed.quote), fileHash, file.name.slice(0, 200)],
    );
    if (!result.rows.length) {
      const photoIds = parsed.quote.lines.flatMap((line) => line.photoIds);
      if (photoIds.length) {
        await connection.query("DELETE FROM quote_line_photos WHERE owner_email = $1 AND id = ANY($2::text[])", [email, photoIds]);
      }
      const existing = await connection.query(
        "SELECT id FROM quotes WHERE owner_email = $1 AND import_file_hash = $2",
        [email, fileHash],
      );
      await connection.query("COMMIT");
      transactionStarted = false;
      return NextResponse.json({ imported: false, duplicate: true, quoteId: existing.rows[0]?.id, fileName: file.name });
    }

    await connection.query("COMMIT");
    transactionStarted = false;
    return NextResponse.json({
      imported: true,
      duplicate: false,
      quoteId: result.rows[0].id,
      lines: parsed.quote.lines.length,
      photos: parsed.photos.length,
      skippedPhotos: parsed.skippedPhotos,
      fileName: file.name,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Quote workbook import rollback failed:", rollbackError);
      }
    }
    console.error("Quote workbook import failed:", error);
    return NextResponse.json({ error: "The quote workbook could not be imported" }, { status: 503 });
  } finally {
    client?.release();
  }
}

function parsePreparedQuote(value: unknown): Quote | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown> | null;
  if (!input || !Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 3000) return null;
  const quoteNumbers = ["taxRate", "productMarkup", "laborMargin", "contingency"] as const;
  if (quoteNumbers.some((key) => typeof input[key] !== "number" || !Number.isFinite(input[key])
    || Number(input[key]) < 0 || Number(input[key]) >= 1)) return null;
  const costNumbers = ["shipping", "travel", "miscellaneous"] as const;
  if (costNumbers.some((key) => typeof input[key] !== "number" || !Number.isFinite(input[key])
    || Number(input[key]) < 0 || Number(input[key]) > 1_000_000)) return null;
  if (input.pricingModel !== "standard" && input.pricingModel !== "estimate_audit") return null;

  const photoIds = new Set<string>();
  const lines: QuoteLine[] = [];
  for (const rawLine of input.lines) {
    if (typeof rawLine !== "object" || rawLine === null || Array.isArray(rawLine)) return null;
    const line = rawLine as Record<string, unknown>;
    const textLimits = {
      id: 100,
      fixtureId: 100,
      address: 500,
      location: 500,
      existingDescription: 1000,
      existingWatts: 100,
      proposedDescription: 1000,
      proposedWatts: 100,
      productCostVendor: 200,
      productCostQuotedAt: 100,
      height: 100,
      installNotes: 2000,
    } as const;
    const text = {} as Record<keyof typeof textLimits, string>;
    for (const [key, limit] of Object.entries(textLimits)) {
      const value = line[key];
      if (typeof value !== "string" || value.length > limit) return null;
      text[key as keyof typeof textLimits] = value;
    }
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(text.id)
      || !Array.isArray(line.photoIds) || line.photoIds.length > 3
      || !line.photoIds.every((id): id is string => typeof id === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))
      || line.productCostSource !== "" && line.productCostSource !== "prior_proposal" && line.productCostSource !== "warehouse_quote"
      || line.suggestedProductId !== null && (typeof line.suggestedProductId !== "number"
        || !Number.isSafeInteger(line.suggestedProductId) || line.suggestedProductId < 1)
      || typeof line.productCostPriorUseCount !== "number" || !Number.isSafeInteger(line.productCostPriorUseCount)
      || line.productCostPriorUseCount < 0) return null;
    for (const key of ["taxRateOverride", "productMarkupOverride", "laborMarginOverride"] as const) {
      const value = line[key];
      if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 1)) return null;
    }
    for (const id of line.photoIds) {
      if (photoIds.has(id)) return null;
      photoIds.add(id);
    }
    const lineNumbers = {} as Pick<QuoteLine, "existingQty" | "proposedQty" | "productCost" | "laborCost">;
    for (const key of ["existingQty", "proposedQty", "productCost", "laborCost"] as const) {
      const max = key.includes("Qty") ? 100_000 : 1_000_000;
      if (typeof line[key] !== "number" || !Number.isFinite(line[key]) || Number(line[key]) < 0 || Number(line[key]) > max) return null;
      lineNumbers[key] = line[key];
    }
    if (line.productCostPriorUseCount !== null && typeof line.productCostPriorUseCount !== "number") return null;
    lines.push({
      id: text.id,
      fixtureId: text.fixtureId,
      address: text.address,
      location: text.location,
      existingQty: lineNumbers.existingQty,
      existingDescription: text.existingDescription,
      existingWatts: text.existingWatts,
      proposedQty: lineNumbers.proposedQty,
      proposedDescription: text.proposedDescription,
      proposedWatts: text.proposedWatts,
      productCostSource: line.productCostSource,
      productCostVendor: text.productCostVendor,
      productCostQuotedAt: text.productCostQuotedAt,
      productCostPriorUseCount: line.productCostPriorUseCount,
      suggestedProductId: line.suggestedProductId as number | null,
      photoIds: line.photoIds,
      height: text.height,
      installNotes: text.installNotes,
      productCost: lineNumbers.productCost,
      laborCost: lineNumbers.laborCost,
      ...(typeof line.taxRateOverride === "number" ? { taxRateOverride: line.taxRateOverride } : {}),
      ...(typeof line.productMarkupOverride === "number" ? { productMarkupOverride: line.productMarkupOverride } : {}),
      ...(typeof line.laborMarginOverride === "number" ? { laborMarginOverride: line.laborMarginOverride } : {}),
    });
  }
  if (photoIds.size > 50 || typeof input.projectName !== "string" || input.projectName.length > 200
    || typeof input.address !== "string" || input.address.length > 500) return null;
  return {
    projectName: input.projectName,
    address: input.address,
    pricingModel: input.pricingModel,
    taxRate: Number(input.taxRate),
    productMarkup: Number(input.productMarkup),
    laborMargin: Number(input.laborMargin),
    contingency: Number(input.contingency),
    shipping: Number(input.shipping),
    travel: Number(input.travel),
    miscellaneous: Number(input.miscellaneous),
    lines,
  };
}

async function importPreparedQuote(body: Record<string, unknown>, email: string) {
  const fileHash = typeof body.fileHash === "string" && /^[a-f0-9]{64}$/i.test(body.fileHash)
    ? body.fileHash.toLowerCase()
    : null;
  const fileName = typeof body.fileName === "string" && /\.(xlsx|xls|xlsm)$/i.test(body.fileName)
    ? body.fileName.slice(0, 200)
    : "";
  const quote = parsePreparedQuote(body.quote);
  if (!fileHash || !fileName || !quote) {
    return NextResponse.json({ error: "The reviewed quote workbook import is invalid" }, { status: 400 });
  }
  const photoIds = quote.lines.flatMap((line) => line.photoIds);

  let client: PoolClient | null = null;
  let transactionStarted = false;
  try {
    await ensureQuoteTable();
    const connection = await db.connect();
    client = connection;
    await connection.query("BEGIN");
    transactionStarted = true;
    const priorImport = await connection.query(
      "SELECT id FROM quotes WHERE owner_email = $1 AND import_file_hash = $2",
      [email, fileHash],
    );
    if (priorImport.rows.length) {
      await connection.query("COMMIT");
      transactionStarted = false;
      return NextResponse.json({ imported: false, duplicate: true, quoteId: priorImport.rows[0].id, fileName });
    }
    if (photoIds.length) {
      const ownedPhotos = await connection.query(
        "SELECT id FROM quote_line_photos WHERE owner_email = $1 AND id = ANY($2::text[])",
        [email, photoIds],
      );
      if (ownedPhotos.rows.length !== photoIds.length) {
        await connection.query("ROLLBACK");
        transactionStarted = false;
        return NextResponse.json({ error: "One or more imported quote photos could not be verified." }, { status: 400 });
      }
    }
    const result = await connection.query(
      `INSERT INTO quotes (owner_email, project_name, status, quote_data, import_file_hash, import_file_name)
       VALUES ($1, $2, 'imported', $3::jsonb, $4, $5)
       ON CONFLICT (owner_email, import_file_hash) WHERE import_file_hash IS NOT NULL DO NOTHING
       RETURNING id`,
      [email, quote.projectName, JSON.stringify(quote), fileHash, fileName],
    );
    if (!result.rows.length) {
      const existing = await connection.query(
        "SELECT id FROM quotes WHERE owner_email = $1 AND import_file_hash = $2",
        [email, fileHash],
      );
      await connection.query("COMMIT");
      transactionStarted = false;
      return NextResponse.json({ imported: false, duplicate: true, quoteId: existing.rows[0]?.id, fileName });
    }
    await connection.query("COMMIT");
    transactionStarted = false;
    return NextResponse.json({
      imported: true,
      duplicate: false,
      quoteId: result.rows[0].id,
      lines: quote.lines.length,
      photos: photoIds.length,
      skippedPhotos: Number.isSafeInteger(body.skippedPhotos) && Number(body.skippedPhotos) >= 0
        ? Number(body.skippedPhotos)
        : 0,
      fileName,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Prepared quote import rollback failed:", rollbackError);
      }
    }
    console.error("Prepared quote import failed:", error);
    return NextResponse.json({ error: "The quote workbook could not be imported" }, { status: 503 });
  } finally {
    client?.release();
  }
}

export async function PUT(request: Request) {
  const email = await getEmployeeEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    return importQuoteWorkbook(request, email);
  }

  const body = await request.json().catch(() => null);
  if (body?.kind === "quote") return importPreparedQuote(body, email);
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
