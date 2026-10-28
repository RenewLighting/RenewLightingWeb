import { unzipSync } from "fflate";
import * as XLSX from "xlsx";

import { emptyQuote, type Quote, type QuoteLine } from "@/lib/quote";

const maxImportedPhotos = 50;
const maxPhotoSize = 12 * 1024 * 1024;
const maxPhotoBytes = 100 * 1024 * 1024;
const maxWorkbookMetadataBytes = 3 * 1024 * 1024;
const maxArchiveEntries = 2000;
const maxExpandedWorkbookBytes = 250 * 1024 * 1024;

class WorkbookLimitError extends Error {}

export type WorkbookPhoto = {
  lineIndex: number;
  contentType: string;
  imageData: Uint8Array;
};

type PhotoSheetRows = {
  rows: Map<number, number>;
  photoColumns: Set<number>;
};

export type QuoteWorkbookImport = {
  recognized: boolean;
  sheetName: string;
  quote: Quote | null;
  photos: WorkbookPhoto[];
  skippedPhotos: number;
};

function headerKey(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findColumn(headers: unknown[], aliases: string[]) {
  const normalized = new Map(headers.map((value, index) => [headerKey(value), index]));
  return aliases.map(headerKey).map((alias) => normalized.get(alias)).find((index) => index !== undefined);
}

function zipPath(...parts: string[]) {
  const segments: string[] = [];
  for (const segment of parts.join("/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments.join("/");
}

function zipDirname(value: string) {
  const index = value.lastIndexOf("/");
  return index < 0 ? "" : value.slice(0, index);
}

function zipBasename(value: string) {
  return value.slice(value.lastIndexOf("/") + 1);
}

function zipExtname(value: string) {
  const name = zipBasename(value);
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index);
}

function validateWorkbookArchive(bytes: Uint8Array) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return;
  let entryCount = 0;
  let expandedBytes = 0;
  unzipSync(bytes, {
    filter: (file) => {
      entryCount += 1;
      expandedBytes += file.originalSize;
      if (entryCount > maxArchiveEntries || file.originalSize > maxExpandedWorkbookBytes
        || expandedBytes > maxExpandedWorkbookBytes) {
        throw new WorkbookLimitError("The Excel workbook expands beyond the safe 250 MB import limit.");
      }
      return false;
    },
  });
}

function numericValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").replace(/[$,\s]/g, "");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function textValue(value: unknown, limit: number) {
  return String(value ?? "").trim().slice(0, limit);
}

function cellValue(sheet: XLSX.WorkSheet, cell: string) {
  return sheet[cell]?.v;
}

function numericCell(sheet: XLSX.WorkSheet, cell: string, fallback = 0) {
  return numericValue(cellValue(sheet, cell)) ?? fallback;
}

function cellRateFromFormula(sheet: XLSX.WorkSheet, address: string, fallback: number) {
  const formula = sheet[address]?.f || "";
  const percentage = formula.match(/\*\s*(\d+(?:\.\d+)?)\s*%/);
  return percentage ? Number(percentage[1]) / 100 : fallback;
}

function marginFromFormula(sheet: XLSX.WorkSheet, column: number | undefined, row: number) {
  if (column === undefined) return null;
  const formula = sheet[XLSX.utils.encode_cell({ r: row - 1, c: column })]?.f || "";
  const denominator = formula.match(/\/\s*(\d+(?:\.\d+)?)/);
  if (denominator) return Math.max(0, Math.min(0.9999, 1 - Number(denominator[1])));
  const multiplier = formula.match(/\*\s*(\d+(?:\.\d+)?)(?![\d%])/);
  if (multiplier && Number(multiplier[1]) > 1) {
    return Math.max(0, Math.min(0.9999, 1 - 1 / Number(multiplier[1])));
  }
  return null;
}

function percentageFromFormula(sheet: XLSX.WorkSheet, column: number | undefined, row: number) {
  if (column === undefined) return null;
  const formula = sheet[XLSX.utils.encode_cell({ r: row - 1, c: column })]?.f || "";
  const percentage = formula.match(/\*\s*(\d+(?:\.\d+)?)\s*%/);
  return percentage ? Number(percentage[1]) / 100 : null;
}

function rateFromFormula(sheet: XLSX.WorkSheet, column: number | undefined, sourceRows: number[], fallback: number) {
  for (const row of sourceRows) {
    const rate = marginFromFormula(sheet, column, row);
    if (rate !== null) return rate;
  }
  return fallback;
}

function rateFromRows(lines: QuoteLine[], sourceRows: number[], sheet: XLSX.WorkSheet, rate: "product" | "labor") {
  for (let index = 0; index < lines.length; index += 1) {
    const row = sourceRows[index];
    if (rate === "product") {
      const taxedMaterial = numericValue(cellValue(sheet, `O${row}`));
      const productSell = numericValue(cellValue(sheet, `R${row}`));
      if (productSell !== null && productSell > 0 && taxedMaterial !== null) {
        return Math.max(0, Math.min(0.9999, 1 - taxedMaterial / productSell));
      }
    } else {
      const labor = lines[index].laborCost;
      const laborSell = numericValue(cellValue(sheet, `U${row}`));
      if (labor > 0 && laborSell !== null && laborSell > 0) {
        return Math.max(0, Math.min(0.9999, 1 - labor / laborSell));
      }
    }
  }
  return rate === "product" ? 0.25 : 0.35;
}

function headerRowForQuote(sheet: XLSX.WorkSheet) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 30); rowIndex += 1) {
    const headers = rows[rowIndex] || [];
    const wattsColumns = headers
      .map((value, index) => headerKey(value) === "inputwatts" ? index : -1)
      .filter((index) => index >= 0);
    const columns = {
      fixtureId: findColumn(headers, ["fixtureid"]),
      existingQty: findColumn(headers, ["existingfixtureqty", "existingqty"]),
      sharedQty: findColumn(headers, ["fixtureqty", "quantity", "qty", "count"]),
      location: findColumn(headers, ["locationdescription", "location"]),
      existingDescription: findColumn(headers, ["existingfixturedescription", "existingfixturedescrption", "existingdescription"]),
      existingWatts: findColumn(headers, ["existingwatts", "oldwatts"]) ?? wattsColumns[0],
      proposedQty: findColumn(headers, ["proposedfixtureqty", "proposedqty", "replacementqty"]),
      proposedDescription: findColumn(headers, ["proposedfixturedescription", "proposedfixturedescrption", "proposeddescription", "replacementfixture"]),
      proposedWatts: findColumn(headers, ["proposedwatts", "replacementwatts", "newwatts"]) ?? wattsColumns.at(-1),
      height: findColumn(headers, ["height", "mountingheight"]),
      installNotes: findColumn(headers, ["installnotes", "notes"]),
      productCost: findColumn(headers, ["productcost", "unitproductcost"]),
      laborCost: findColumn(headers, ["laborcost", "unitlaborcost"]),
      tax: findColumn(headers, ["tax", "salestax"]),
      productSell: findColumn(headers, ["extendedproductcost", "productsell", "markedupproduct"]),
      laborSell: findColumn(headers, ["markeduplabor", "laborsell", "extendedlabor"]),
    };
    columns.existingQty ??= columns.sharedQty ?? columns.proposedQty;
    columns.proposedQty ??= columns.sharedQty ?? columns.existingQty;
    if (columns.existingQty !== undefined && columns.proposedQty !== undefined
      && columns.proposedDescription !== undefined && columns.productCost !== undefined
      && columns.laborCost !== undefined) {
      return { rows, rowIndex, columns };
    }
  }
  return null;
}

function labelValue(rows: unknown[][], label: string) {
  const expected = headerKey(label);
  for (const row of rows.slice(0, 1)) {
    for (let index = 0; index < row.length; index += 1) {
      if (!headerKey(row[index]).includes(expected)) continue;
      for (let valueIndex = index + 1; valueIndex < row.length; valueIndex += 1) {
        const value = textValue(row[valueIndex], 200);
        if (value && !["address", "projectname"].includes(headerKey(value))) return value;
      }
    }
  }
  return "";
}

function photoRowsForSheet(sheet: XLSX.WorkSheet, lines: QuoteLine[]): PhotoSheetRows {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 30); rowIndex += 1) {
    const headers = rows[rowIndex] || [];
    const columns = {
      fixtureId: findColumn(headers, ["fixtureid"]),
      location: findColumn(headers, ["locationdescription", "location"]),
      existingDescription: findColumn(headers, ["existingfixturedescription", "existingfixturedescrption", "existingdescription"]),
      proposedDescription: findColumn(headers, ["proposedfixturedescription", "proposedfixturedescrption", "proposeddescription", "replacementfixture"]),
    };
    if (columns.existingDescription === undefined || columns.proposedDescription === undefined) continue;
    const photoColumns = new Set(headers
      .map((value, index) => /photo|image/.test(headerKey(value)) ? index : -1)
      .filter((index) => index >= 0));

    const keyFor = (values: unknown[]) => [
      columns.location === undefined ? "" : headerKey(values[columns.location]),
      headerKey(values[columns.existingDescription!]),
      headerKey(values[columns.proposedDescription!]),
    ].join("|");
    const linesByKey = new Map<string, number[]>();
    const linesByFixtureId = new Map<string, number>();
    lines.forEach((line, index) => {
      const key = [headerKey(line.location), headerKey(line.existingDescription), headerKey(line.proposedDescription)].join("|");
      if (key !== "||") linesByKey.set(key, [...(linesByKey.get(key) || []), index]);
      if (line.fixtureId) linesByFixtureId.set(headerKey(line.fixtureId), index);
    });

    const mappedRows = new Map<number, number>();
    const keyOccurrences = new Map<string, number>();
    for (let dataRow = rowIndex + 1; dataRow < rows.length; dataRow += 1) {
      const values = rows[dataRow] || [];
      const fixtureId = columns.fixtureId === undefined ? "" : headerKey(values[columns.fixtureId]);
      const rowKey = keyFor(values);
      const candidates = linesByKey.get(rowKey) || [];
      const occurrence = keyOccurrences.get(rowKey) || 0;
      const lineIndex = (fixtureId ? linesByFixtureId.get(fixtureId) : undefined)
        ?? candidates[Math.min(occurrence, candidates.length - 1)];
      if (candidates.length) keyOccurrences.set(rowKey, occurrence + 1);
      if (lineIndex !== undefined) mappedRows.set(dataRow + 1, lineIndex);
    }
    if (mappedRows.size) return { rows: mappedRows, photoColumns };
  }
  return { rows: new Map<number, number>(), photoColumns: new Set<number>() };
}

function parseQuoteSheet(sheet: XLSX.WorkSheet, sheetName: string, fileName: string, bytes: Uint8Array, workbook: XLSX.WorkBook) {
  const detected = headerRowForQuote(sheet);
  if (!detected) return { recognized: false as const };

  const { rows, rowIndex: headerRow, columns } = detected;
  const existingQtyColumn = columns.existingQty;
  const proposedQtyColumn = columns.proposedQty;
  const proposedDescriptionColumn = columns.proposedDescription;
  const productCostColumn = columns.productCost;
  const laborCostColumn = columns.laborCost;
  if (existingQtyColumn === undefined || proposedQtyColumn === undefined
    || proposedDescriptionColumn === undefined || productCostColumn === undefined || laborCostColumn === undefined) {
    return { recognized: false as const };
  }

  const lines: QuoteLine[] = [];
  const sourceRows: number[] = [];
  const lineIndexBySheetRow = new Map<number, number>();
  for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const existingDescription = textValue(row[columns.existingDescription ?? -1], 1000);
    const proposedDescription = textValue(row[proposedDescriptionColumn], 1000);
    const proposedQty = numericValue(row[proposedQtyColumn]) ?? 0;
    const productCost = numericValue(row[productCostColumn]) ?? 0;
    const laborCost = numericValue(row[laborCostColumn]) ?? 0;
    const fixtureId = textValue(row[columns.fixtureId ?? -1], 100);
    if (!existingDescription && !proposedDescription && proposedQty <= 0 && productCost <= 0 && laborCost <= 0) continue;
    if (lines.length >= 3000) break;
    if (proposedQty < 0 || proposedQty > 100_000 || productCost < 0 || productCost > 1_000_000
      || laborCost < 0 || laborCost > 1_000_000) continue;

    const sheetRow = rowIndex + 1;
    lineIndexBySheetRow.set(sheetRow, lines.length);
    sourceRows.push(sheetRow);
    lines.push({
      id: crypto.randomUUID(),
      fixtureId,
      address: "",
      location: textValue(row[columns.location ?? -1], 500),
      existingQty: Math.max(0, numericValue(row[existingQtyColumn]) ?? proposedQty),
      existingDescription,
      existingWatts: textValue(row[columns.existingWatts ?? -1], 100),
      proposedQty,
      proposedDescription,
      proposedWatts: textValue(row[columns.proposedWatts ?? -1], 100),
      productCostSource: "",
      productCostVendor: "",
      productCostQuotedAt: "",
      productCostPriorUseCount: 0,
      suggestedProductId: null,
      photoIds: [],
      height: textValue(row[columns.height ?? -1], 100),
      installNotes: textValue(row[columns.installNotes ?? -1], 2000),
      productCost,
      laborCost,
    });
  }

  if (!lines.length) return { recognized: true as const, empty: true as const, sheetName };

  const projectName = labelValue(rows, "projectname");
  const address = labelValue(rows, "address");
  const productMarkup = rateFromFormula(sheet, columns.productSell, sourceRows,
    rateFromRows(lines, sourceRows, sheet, "product"));
  const laborMargin = rateFromFormula(sheet, columns.laborSell, sourceRows,
    rateFromRows(lines, sourceRows, sheet, "labor"));
  const taxRate = columns.tax === undefined
    ? cellRateFromFormula(sheet, "N3", 0.0875)
    : cellRateFromFormula(sheet, XLSX.utils.encode_cell({ r: sourceRows[0] - 1, c: columns.tax }), 0.0875);
  for (let index = 0; index < lines.length; index += 1) {
    const sourceRow = sourceRows[index];
    const lineTaxRate = percentageFromFormula(sheet, columns.tax, sourceRow);
    const lineProductMarkup = marginFromFormula(sheet, columns.productSell, sourceRow);
    const lineLaborMargin = marginFromFormula(sheet, columns.laborSell, sourceRow);
    if (lineTaxRate !== null && Math.abs(lineTaxRate - taxRate) > 0.000001) {
      lines[index].taxRateOverride = lineTaxRate;
    }
    if (lineProductMarkup !== null && Math.abs(lineProductMarkup - productMarkup) > 0.000001) {
      lines[index].productMarkupOverride = lineProductMarkup;
    }
    if (lineLaborMargin !== null && Math.abs(lineLaborMargin - laborMargin) > 0.000001) {
      lines[index].laborMarginOverride = lineLaborMargin;
    }
  }
  const shipping = numericCell(sheet, "P31");
  const travel = numericCell(sheet, "T31");
  const miscellaneous = numericCell(sheet, "T32");
  const quote: Quote = {
    ...emptyQuote(),
    projectName: projectName || fileName.replace(/\.[^.]+$/, "").slice(0, 200),
    address,
    pricingModel: shipping + travel + miscellaneous > 0 ? "estimate_audit" : "standard",
    taxRate,
    productMarkup,
    laborMargin,
    contingency: 0,
    shipping,
    travel,
    miscellaneous,
    lines,
  };
  const lineRowsBySheet = new Map<string, PhotoSheetRows>();
  const selectedSheetPhotoColumns = photoRowsForSheet(sheet, lines).photoColumns;
  lineRowsBySheet.set(sheetName, { rows: lineIndexBySheetRow, photoColumns: selectedSheetPhotoColumns });
  for (const relatedSheetName of workbook.SheetNames) {
    if (relatedSheetName === sheetName) continue;
    const relatedSheet = workbook.Sheets[relatedSheetName];
    if (relatedSheet) lineRowsBySheet.set(relatedSheetName, photoRowsForSheet(relatedSheet, lines));
  }
  const extracted = extractPhotos(bytes, lineRowsBySheet);
  return {
    recognized: true as const,
    empty: false as const,
    sheetName,
    quote,
    photos: extracted.photos,
    skippedPhotos: extracted.skippedPhotos,
  };
}

function xmlText(files: Record<string, Uint8Array>, fileName: string) {
  const data = files[fileName];
  return data ? new TextDecoder().decode(data) : "";
}

function xmlAttributes(element: string) {
  const attributes: Record<string, string> = {};
  for (const match of element.matchAll(/([\w:.-]+)="([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function relationships(xml: string, basePath: string) {
  const result = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const attributes = xmlAttributes(match[0]);
    if (!attributes.Id || !attributes.Target || attributes.TargetMode === "External") continue;
    const target = attributes.Target.startsWith("/")
      ? zipPath(attributes.Target.slice(1))
      : zipPath(zipDirname(basePath), attributes.Target);
    result.set(attributes.Id, target);
  }
  return result;
}

function sniffImageType(extension: string, data: Uint8Array) {
  if (extension === ".png" && data.length >= 8
    && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
    && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) return "image/png";
  if ([".jpg", ".jpeg"].includes(extension) && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (extension === ".gif" && data.length >= 6 && ["GIF87a", "GIF89a"].includes(new TextDecoder().decode(data.slice(0, 6)))) return "image/gif";
  if (extension === ".webp" && data.length >= 12
    && new TextDecoder().decode(data.slice(0, 4)) === "RIFF"
    && new TextDecoder().decode(data.slice(8, 12)) === "WEBP") return "image/webp";
  if (extension === ".bmp" && data[0] === 0x42 && data[1] === 0x4d) return "image/bmp";
  return null;
}

function extractPhotos(bytes: Uint8Array, lineRowsBySheet: Map<string, PhotoSheetRows>) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return { photos: [] as WorkbookPhoto[], skippedPhotos: 0 };

  let skippedPhotos = 0;
  let photoBytes = 0;
  let metadataBytes = 0;
  let photoFiles = 0;
  const allowedImageExtensions = new Set([".bmp", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
  const files = unzipSync(bytes, {
    filter: (file) => {
      if (file.name.startsWith("xl/media/")) {
        const extension = zipExtname(file.name).toLowerCase();
        if (!allowedImageExtensions.has(extension) || file.originalSize > maxPhotoSize
          || photoFiles >= maxImportedPhotos || photoBytes + file.originalSize > maxPhotoBytes) {
          skippedPhotos += 1;
          return false;
        }
        photoFiles += 1;
        photoBytes += file.originalSize;
        return true;
      }

      const isWorkbookMetadata = file.name === "xl/workbook.xml"
        || file.name === "xl/_rels/workbook.xml.rels"
        || /^xl\/worksheets\/[^/]+\.xml$/.test(file.name)
        || /^xl\/worksheets\/_rels\/[^/]+\.rels$/.test(file.name)
        || /^xl\/drawings\/[^/]+\.xml$/.test(file.name)
        || /^xl\/drawings\/_rels\/[^/]+\.rels$/.test(file.name)
        || /^xl\/richData\/(?:rdrichvalue|richValueRel)\.xml$/.test(file.name)
        || file.name === "xl/richData/_rels/richValueRel.xml.rels";
      if (!isWorkbookMetadata) return false;
      if (file.originalSize > 1024 * 1024 || metadataBytes + file.originalSize > maxWorkbookMetadataBytes) return false;
      metadataBytes += file.originalSize;
      return true;
    },
  });

  const workbookXml = xmlText(files, "xl/workbook.xml");
  const workbookRels = relationships(xmlText(files, "xl/_rels/workbook.xml.rels"), "xl/workbook.xml");
  const photos: WorkbookPhoto[] = [];
  const photoCounts = new Map<number, number>();
  const seenPhotos = new Set<string>();
  const workbookSheetElements = [...workbookXml.matchAll(/<sheet\b[^>]*\/?>/g)]
    .map((match) => xmlAttributes(match[0]));
  for (const attributes of workbookSheetElements) {
    const sheetName = attributes.name;
    const photoSheet = lineRowsBySheet.get(sheetName);
    const sheetPath = attributes["r:id"] ? workbookRels.get(attributes["r:id"]) : undefined;
    if (!photoSheet?.rows.size || !sheetPath) continue;
    const sheetXml = xmlText(files, sheetPath);
    const drawingId = [...sheetXml.matchAll(/<drawing\b[^>]*\/?>/g)]
      .map((match) => xmlAttributes(match[0])["r:id"])
      .find(Boolean);
    const sheetRelsPath = zipPath(zipDirname(sheetPath), "_rels", `${zipBasename(sheetPath)}.rels`);
    const sheetRels = relationships(xmlText(files, sheetRelsPath), sheetPath);
    const drawingPath = drawingId ? sheetRels.get(drawingId) : undefined;
    if (drawingPath) {
      const drawingXml = xmlText(files, drawingPath);
      const drawingRelsPath = zipPath(zipDirname(drawingPath), "_rels", `${zipBasename(drawingPath)}.rels`);
      const drawingRels = relationships(xmlText(files, drawingRelsPath), drawingPath);
      for (const match of drawingXml.matchAll(/<(?:[\w.-]+:)?(?:twoCellAnchor|oneCellAnchor)\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?(?:twoCellAnchor|oneCellAnchor)>/g)) {
        const anchor = match[0];
        const rowMatch = anchor.match(/<(?:[\w.-]+:)?row>\s*(\d+)\s*<\/(?:[\w.-]+:)?row>/);
        const embeddedId = anchor.match(/<(?:[\w.-]+:)?blip\b[^>]*r:embed="([^"]+)"/)?.[1];
        const lineIndex = rowMatch ? photoSheet.rows.get(Number(rowMatch[1]) + 1) : undefined;
        const imagePath = embeddedId ? drawingRels.get(embeddedId) : undefined;
        const imageData = imagePath ? files[imagePath] : undefined;
        if (lineIndex === undefined || !imagePath || !imageData) continue;
        const contentType = sniffImageType(zipExtname(imagePath).toLowerCase(), imageData);
        const count = photoCounts.get(lineIndex) || 0;
        const photoKey = `${lineIndex}:${imagePath}`;
        if (seenPhotos.has(photoKey)) continue;
        if (!contentType || count >= 3 || photos.length >= maxImportedPhotos) {
          skippedPhotos += 1;
          continue;
        }
        photos.push({ lineIndex, contentType, imageData });
        photoCounts.set(lineIndex, count + 1);
        seenPhotos.add(photoKey);
      }
    }

    const richValues = [...xmlText(files, "xl/richData/rdrichvalue.xml").matchAll(/<rv\b[^>]*>([\s\S]*?)<\/rv>/g)]
      .map((match) => [...match[1].matchAll(/<v>(\d+)<\/v>/g)].map((value) => Number(value[1]))[0]);
    const richRelationIds = [...xmlText(files, "xl/richData/richValueRel.xml").matchAll(/<rel\b[^>]*\/?>/g)]
      .map((match) => xmlAttributes(match[0])["r:id"]);
    const richRelationships = relationships(
      xmlText(files, "xl/richData/_rels/richValueRel.xml.rels"),
      "xl/richData/richValueRel.xml",
    );
    const richImagePaths = richValues.map((relationshipIndex) => {
      const relationshipId = relationshipIndex === undefined ? undefined : richRelationIds[relationshipIndex];
      return relationshipId ? richRelationships.get(relationshipId) : undefined;
    });
    for (const cellMatch of sheetXml.matchAll(/<c\b[^>]*\/?>/g)) {
      const cellAttributes = xmlAttributes(cellMatch[0]);
      const cellAddress = cellAttributes.r || "";
      const cellIndex = XLSX.utils.decode_cell(cellAddress);
      if (!photoSheet.photoColumns.has(cellIndex.c)) continue;
      const lineIndex = photoSheet.rows.get(cellIndex.r + 1);
      const richValueIndex = Number(cellAttributes.vm);
      const imagePath = Number.isInteger(richValueIndex) && richValueIndex > 0
        ? richImagePaths[richValueIndex - 1]
        : undefined;
      const imageData = imagePath ? files[imagePath] : undefined;
      if (lineIndex === undefined || !imagePath || !imageData) continue;
      const contentType = sniffImageType(zipExtname(imagePath).toLowerCase(), imageData);
      const count = photoCounts.get(lineIndex) || 0;
      const photoKey = `${lineIndex}:${imagePath}`;
      if (seenPhotos.has(photoKey)) continue;
      if (!contentType || count >= 3 || photos.length >= maxImportedPhotos) {
        skippedPhotos += 1;
        continue;
      }
      photos.push({ lineIndex, contentType, imageData });
      photoCounts.set(lineIndex, count + 1);
      seenPhotos.add(photoKey);
    }
  }
  return { photos, skippedPhotos };
}

export function parseQuoteWorkbook(bytes: Uint8Array, fileName: string): QuoteWorkbookImport {
  validateWorkbookArchive(bytes);
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true, dense: false });
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const result = parseQuoteSheet(sheet, sheetName, fileName, bytes, workbook);
    if (result.recognized) {
      if (result.empty) return { recognized: true, sheetName: result.sheetName, quote: null, photos: [], skippedPhotos: 0 };
      return result;
    }
  }
  return { recognized: false, sheetName: "", quote: null, photos: [], skippedPhotos: 0 };
}
