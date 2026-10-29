import { readFile } from "node:fs/promises";
import path from "node:path";

import PDFDocument from "pdfkit";
import sharp from "sharp";

import { db, ensureQuoteTable } from "@/lib/db";
import { calculateQuote, money, type Quote, type QuoteLine } from "@/lib/quote";
import { contact, siteName, siteUrl } from "@/lib/site";

const PAGE_WIDTH = 612;
const LEFT = 46;
const RIGHT = PAGE_WIDTH - LEFT;
const CONTENT_WIDTH = RIGHT - LEFT;
const CONTENT_BOTTOM = 728;
const GREEN = "#397447";
const DARK_GREEN = "#244D31";
const PALE_GREEN = "#EDF4EA";
const TEXT = "#26332A";
const MUTED = "#637067";
const RULE = "#D9E2D8";

type PdfDocument = InstanceType<typeof PDFDocument>;

function drawLogo(document: PdfDocument, logo: Buffer, x: number, y: number, size: number) {
  document.image(logo, x, y, { fit: [size, size] });
}

function addStandardPage(document: PdfDocument, logo: Buffer, section: string) {
  document.addPage({ size: "LETTER", margin: 0 });
  drawLogo(document, logo, LEFT, 22, 38);
  document.font("Helvetica-Bold").fontSize(13).fillColor(DARK_GREEN)
    .text(siteName, LEFT + 48, 27, { lineBreak: false });
  document.font("Helvetica").fontSize(8).fillColor(MUTED)
    .text(`${contact.telephone}  |  ${contact.email}  |  ${siteUrl.replace(/^https?:\/\//, "")}`, LEFT + 48, 45, { lineBreak: false });
  document.moveTo(LEFT, 72).lineTo(RIGHT, 72).strokeColor(RULE).lineWidth(0.8).stroke();
  document.font("Helvetica-Bold").fontSize(8).fillColor(GREEN)
    .text(section.toUpperCase(), LEFT, 88, { characterSpacing: 1.2 });
  return 112;
}

function drawSectionTitle(document: PdfDocument, title: string, y: number, subtitle?: string) {
  document.font("Helvetica-Bold").fontSize(22).fillColor(DARK_GREEN).text(title, LEFT, y, { width: CONTENT_WIDTH });
  let nextY = y + document.heightOfString(title, { width: CONTENT_WIDTH }) + 8;
  if (subtitle) {
    document.font("Helvetica").fontSize(9).fillColor(MUTED).text(subtitle, LEFT, nextY, { width: CONTENT_WIDTH });
    nextY += document.heightOfString(subtitle, { width: CONTENT_WIDTH }) + 12;
  }
  return nextY;
}

function drawLabelValue(document: PdfDocument, label: string, value: string, x: number, y: number, width: number) {
  document.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(label.toUpperCase(), x, y, { width });
  document.font("Helvetica").fontSize(10).fillColor(TEXT).text(value || "Not specified", x, y + 13, { width });
}

function drawPriceCard(document: PdfDocument, label: string, value: string, x: number, y: number, width: number, emphasis = false) {
  document.roundedRect(x, y, width, 66, 6).fillAndStroke(emphasis ? DARK_GREEN : PALE_GREEN, emphasis ? DARK_GREEN : RULE);
  document.font("Helvetica-Bold").fontSize(8).fillColor(emphasis ? "#D5E6D3" : MUTED)
    .text(label.toUpperCase(), x + 12, y + 12, { width: width - 24 });
  document.font("Helvetica-Bold").fontSize(emphasis ? 18 : 15).fillColor(emphasis ? "#FFFFFF" : DARK_GREEN)
    .text(value, x + 12, y + 31, { width: width - 24 });
}

function drawBulletList(document: PdfDocument, items: string[], x: number, y: number, width: number) {
  let nextY = y;
  for (const item of items) {
    document.circle(x + 4, nextY + 5, 2).fill(GREEN);
    document.font("Helvetica").fontSize(10).fillColor(TEXT).text(item, x + 15, nextY, {
      width: width - 15,
      lineGap: 2,
    });
    document.font("Helvetica").fontSize(10);
    nextY += document.heightOfString(item, { width: width - 15, lineGap: 2 }) + 11;
  }
  return nextY;
}

function drawTableHeader(document: PdfDocument, y: number) {
  document.roundedRect(LEFT, y, CONTENT_WIDTH, 25, 4).fill(DARK_GREEN);
  document.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF");
  document.text("#", LEFT + 10, y + 8, { width: 22 });
  document.text("SCOPE ITEM", LEFT + 40, y + 8, { width: 300 });
  document.text("QTY", LEFT + 355, y + 8, { width: 42, align: "right" });
  document.text("AMOUNT", RIGHT - 96, y + 8, { width: 84, align: "right" });
}

function getLineTitle(line: QuoteLine) {
  return line.proposedDescription.trim() || line.fixtureId.trim() || "Proposed fixture";
}

function drawScopeTable(
  document: PdfDocument,
  addPage: (section: string) => number,
  rows: ReturnType<typeof calculateQuote>["rows"],
  initialY: number,
) {
  let y = initialY;
  drawTableHeader(document, y);
  y += 31;
  rows.forEach(({ line, sellTotal }, index) => {
    const description = [getLineTitle(line), line.location.trim() && `Location: ${line.location.trim()}`]
      .filter(Boolean).join("\n");
    document.font("Helvetica").fontSize(9);
    const descriptionHeight = document.heightOfString(description, { width: 296, lineGap: 1 });
    const rowHeight = Math.max(34, descriptionHeight + 14);
    if (y + rowHeight > CONTENT_BOTTOM) {
      y = addPage("Scope of Work");
      drawTableHeader(document, y);
      y += 31;
    }
    if (index % 2 === 0) document.rect(LEFT, y - 4, CONTENT_WIDTH, rowHeight).fill("#F7F9F6");
    document.font("Helvetica").fontSize(9).fillColor(TEXT);
    document.text(String(index + 1).padStart(2, "0"), LEFT + 10, y + 3, { width: 22 });
    document.text(description, LEFT + 40, y + 2, { width: 296, lineGap: 1 });
    document.text(String(line.proposedQty), LEFT + 355, y + 3, { width: 42, align: "right" });
    document.font("Helvetica-Bold").text(money(sellTotal), RIGHT - 96, y + 3, { width: 84, align: "right" });
    y += rowHeight;
  });
  return y + 16;
}

function drawLineCard(
  document: PdfDocument,
  logo: Buffer,
  addPage: (section: string) => number,
  line: QuoteLine,
  amount: number,
  index: number,
  photos: Map<string, Buffer>,
  initialY: number,
) {
  const imageIds = Array.isArray(line.photoIds) ? line.photoIds.slice(0, 3) : [];
  const textWidth = CONTENT_WIDTH - 26;
  const description = getLineTitle(line);
  const details = [
    `Quantity: ${line.proposedQty}${line.proposedWatts ? `  |  Wattage: ${line.proposedWatts}` : ""}${line.height ? `  |  Mounting height: ${line.height}` : ""}`,
    line.location && `Location: ${line.location}`,
    line.address && `Area: ${line.address}`,
    line.existingDescription && `Existing: ${line.existingDescription}${line.existingQty ? ` (qty ${line.existingQty})` : ""}`,
    line.installNotes && `Installation notes: ${line.installNotes}`,
  ].filter((value): value is string => Boolean(value?.trim()));
  document.font("Helvetica").fontSize(8.5);
  const detailHeight = details.reduce((sum, item) =>
    sum + document.heightOfString(item, { width: textWidth, lineGap: 1 }) + 4, 0);
  const photoHeight = imageIds.length ? 112 : 0;
  document.font("Helvetica-Bold").fontSize(11);
  const titleHeight = document.heightOfString(description, { width: textWidth - 100 });
  const cardHeight = 24 + Math.max(18, titleHeight) + detailHeight + (photoHeight ? photoHeight + 7 : 0) + 13;
  let y = initialY;
  if (y + cardHeight > CONTENT_BOTTOM) y = addPage("Scope of Work");

  document.roundedRect(LEFT, y, CONTENT_WIDTH, cardHeight, 5).lineWidth(0.7).strokeColor(RULE).stroke();
  document.font("Helvetica-Bold").fontSize(8).fillColor(GREEN)
    .text(`ITEM ${String(index + 1).padStart(2, "0")}`, LEFT + 12, y + 12);
  document.font("Helvetica-Bold").fontSize(11).fillColor(DARK_GREEN)
    .text(description, LEFT + 12, y + 26, { width: textWidth - 100 });
  document.font("Helvetica-Bold").fontSize(10).fillColor(DARK_GREEN)
    .text(money(amount), RIGHT - 105, y + 13, { width: 91, align: "right" });

  let detailY = y + 26 + Math.max(18, titleHeight) + 5;
  for (const detail of details) {
    document.font("Helvetica").fontSize(8.5).fillColor(TEXT).text(detail, LEFT + 12, detailY, {
      width: textWidth,
      lineGap: 1,
    });
    document.font("Helvetica").fontSize(8.5);
    detailY += document.heightOfString(detail, { width: textWidth, lineGap: 1 }) + 4;
  }
  if (imageIds.length) {
    const photoY = detailY + 2;
    const gap = 8;
    const photoWidth = (CONTENT_WIDTH - 24 - gap * (imageIds.length - 1)) / imageIds.length;
    imageIds.forEach((id, photoIndex) => {
      const x = LEFT + 12 + photoIndex * (photoWidth + gap);
      const image = photos.get(id);
      document.roundedRect(x, photoY, photoWidth, 100, 4).fill("#F3F6F2");
      if (image) {
        document.image(image, x + 2, photoY + 2, {
          fit: [photoWidth - 4, 96],
          align: "center",
          valign: "center",
        });
      } else {
        document.font("Helvetica").fontSize(8).fillColor(MUTED)
          .text("Photo unavailable", x + 6, photoY + 43, { width: photoWidth - 12, align: "center" });
      }
    });
  }
  return y + cardHeight + 10;
}

function drawFooter(document: PdfDocument, pageNumber: number, pageCount: number) {
  document.save();
  document.moveTo(LEFT, 751).lineTo(RIGHT, 751).strokeColor(RULE).lineWidth(0.7).stroke();
  document.font("Helvetica").fontSize(7.5).fillColor(MUTED)
    .text(`${siteName}  |  ${contact.telephone}  |  ${contact.email}`, LEFT, 761, { width: CONTENT_WIDTH - 80 });
  document.text(`${pageNumber} / ${pageCount}`, RIGHT - 60, 761, { width: 60, align: "right" });
  document.restore();
}

async function loadPhotos(quote: Quote, ownerEmail: string) {
  const ids = [...new Set(quote.lines.flatMap((line) => Array.isArray(line.photoIds) ? line.photoIds : []))];
  const photos = new Map<string, Buffer>();
  if (ids.length === 0) return photos;

  await ensureQuoteTable();
  const result = await db.query(
    "SELECT id, image_data FROM quote_line_photos WHERE owner_email = $1 AND id = ANY($2::text[])",
    [ownerEmail, ids],
  );
  await Promise.all(result.rows.map(async (row: { id: string; image_data: Buffer }) => {
    const buffer = Buffer.isBuffer(row.image_data) ? row.image_data : Buffer.from(row.image_data);
    const image = await sharp(buffer)
      .rotate()
      .flatten({ background: "#FFFFFF" })
      .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    photos.set(row.id, image);
  }));
  return photos;
}

export async function createQuoteProposalPdf(quote: Quote, ownerEmail: string) {
  const [photos, logoSvg] = await Promise.all([
    loadPhotos(quote, ownerEmail),
    readFile(path.join(process.cwd(), "public", "logo-fixed-closer-transparent.svg")),
  ]);
  const logo = await sharp(logoSvg).resize(320, 320).png().toBuffer();
  const totals = calculateQuote(quote);
  const lineItemsTotal = totals.rows.reduce((sum, row) => sum + row.sellTotal, 0);
  const projectCostsAndContingency = totals.sellTotal - lineItemsTotal;
  const proposalDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date());

  const document = new PDFDocument({ autoFirstPage: false, bufferPages: true, size: "LETTER", margin: 0 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  const addPage = (section: string) => addStandardPage(document, logo, section);

  document.addPage({ size: "LETTER", margin: 0 });
  document.rect(0, 0, PAGE_WIDTH, 12).fill(GREEN);
  drawLogo(document, logo, LEFT, 40, 58);
  document.font("Helvetica-Bold").fontSize(19).fillColor(DARK_GREEN).text("RENEW", LEFT + 69, 51);
  document.font("Helvetica").fontSize(8).fillColor(MUTED).text("LIGHTING SERVICES", LEFT + 70, 75, { characterSpacing: 1.4 });
  document.font("Helvetica").fontSize(9).fillColor(MUTED)
    .text(`${contact.telephone}  |  ${contact.email}  |  ${siteUrl.replace(/^https?:\/\//, "")}`, LEFT, 119);
  document.moveTo(LEFT, 143).lineTo(RIGHT, 143).strokeColor(RULE).lineWidth(0.8).stroke();
  document.roundedRect(LEFT, 184, 112, 23, 11).fill(PALE_GREEN);
  document.font("Helvetica-Bold").fontSize(8).fillColor(GREEN)
    .text("PROJECT PROPOSAL", LEFT + 12, 191, { characterSpacing: 0.8 });
  const coverTitle = quote.projectName.trim() || "Lighting Proposal";
  const displayTitle = coverTitle.length > 72 ? `${coverTitle.slice(0, 69)}...` : coverTitle;
  document.font("Helvetica-Bold").fontSize(32).fillColor(DARK_GREEN)
    .text(displayTitle, LEFT, 239, { width: CONTENT_WIDTH, lineGap: 3 });
  const titleHeight = document.heightOfString(displayTitle, { width: CONTENT_WIDTH, lineGap: 3 });
  document.font("Helvetica").fontSize(13).fillColor(MUTED)
    .text(quote.address.trim() || "Project site address not provided", LEFT, 247 + titleHeight, { width: CONTENT_WIDTH });
  const coverDetailsY = 350;
  document.roundedRect(LEFT, coverDetailsY, CONTENT_WIDTH, 106, 7).fill("#F7F9F6");
  drawLabelValue(document, "Prepared by", siteName, LEFT + 18, coverDetailsY + 18, 230);
  drawLabelValue(document, "Proposal date", proposalDate, LEFT + 284, coverDetailsY + 18, 200);
  drawLabelValue(document, "Project location", quote.address.trim() || "Not specified", LEFT + 18, coverDetailsY + 63, CONTENT_WIDTH - 36);
  document.font("Helvetica-Bold").fontSize(10).fillColor(GREEN)
    .text("PROPOSED PROJECT INVESTMENT", LEFT, 515);
  document.font("Helvetica-Bold").fontSize(29).fillColor(DARK_GREEN)
    .text(money(totals.sellTotal), LEFT, 535);
  document.font("Helvetica").fontSize(10).fillColor(MUTED)
    .text("Detailed scope, pricing, and proposal terms follow.", LEFT, 580);

  let y = addPage("Executive Summary");
  y = drawSectionTitle(document, "Project overview", y, "A summary of the work and pricing currently included in this proposal.");
  const summary = `This proposal summarizes the lighting and electrical scope priced for ${quote.projectName.trim() || "the project"}. The itemized scope below reflects the quantities and descriptions in the quote.`;
  document.font("Helvetica").fontSize(10).fillColor(TEXT).text(summary, LEFT, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y += document.heightOfString(summary, { width: CONTENT_WIDTH, lineGap: 3 }) + 25;

  document.roundedRect(LEFT, y, CONTENT_WIDTH, 108, 6).lineWidth(0.7).strokeColor(RULE).stroke();
  drawLabelValue(document, "Project", quote.projectName.trim() || "Not specified", LEFT + 15, y + 14, 238);
  drawLabelValue(document, "Site address", quote.address.trim() || "Not specified", LEFT + 274, y + 14, 238);
  drawLabelValue(document, "Scope items", String(totals.rows.length), LEFT + 15, y + 60, 238);
  drawLabelValue(document, "Proposal date", proposalDate, LEFT + 274, y + 60, 238);
  y += 128;
  const gap = 12;
  const priceWidth = (CONTENT_WIDTH - gap) / 2;
  drawPriceCard(document, "Itemized scope", money(lineItemsTotal), LEFT, y, priceWidth);
  drawPriceCard(document, "Total proposal", money(totals.sellTotal), LEFT + priceWidth + gap, y, priceWidth, true);
  y += 91;
  if (Math.abs(projectCostsAndContingency) > 0.01) {
    document.font("Helvetica-Bold").fontSize(9).fillColor(TEXT)
      .text(`The total includes ${money(projectCostsAndContingency)} in project costs and contingency in addition to the itemized scope.`, LEFT, y, {
        width: CONTENT_WIDTH,
      });
    y += 32;
  }
  document.font("Helvetica").fontSize(9).fillColor(MUTED)
    .text("This proposal does not add customer, scheduling, payment, or warranty details that were not supplied with the quote. Refer to the acceptance and terms page for items to confirm.", LEFT, y, {
      width: CONTENT_WIDTH,
      lineGap: 2,
    });

  y = addPage("Scope of Work");
  y = drawSectionTitle(document, "Scope of work", y, "Item quantities and amounts are shown as entered in the quote.");
  y = drawScopeTable(document, addPage, totals.rows, y);
  for (const [index, row] of totals.rows.entries()) {
    y = drawLineCard(document, logo, addPage, row.line, row.sellTotal, index, photos, y);
  }

  y = addPage("Inclusions & Exclusions");
  y = drawSectionTitle(document, "Inclusions & exclusions", y, "Only work expressly identified in the quote is priced.");
  const colGap = 18;
  const colWidth = (CONTENT_WIDTH - colGap) / 2;
  document.roundedRect(LEFT, y, colWidth, 31, 5).fill(PALE_GREEN);
  document.font("Helvetica-Bold").fontSize(11).fillColor(DARK_GREEN).text("Included in this proposal", LEFT + 12, y + 10);
  document.roundedRect(LEFT + colWidth + colGap, y, colWidth, 31, 5).fill("#F4F5F3");
  document.font("Helvetica-Bold").fontSize(11).fillColor(DARK_GREEN).text("Not included unless listed", LEFT + colWidth + colGap + 12, y + 10);
  const listY = y + 47;
  const includedEnd = drawBulletList(document, [
    "The fixtures, materials, quantities, and installation work expressly listed in the scope of work.",
    "The line-item amounts and any project costs or contingency included in the quoted total.",
    "Site-specific work only to the extent it is described in the listed scope and notes.",
  ], LEFT + 3, listY, colWidth - 6);
  drawBulletList(document, [
    "Repairs, upgrades, or additional work not described in the itemized scope.",
    "Permits, engineering, patching, painting, or other trades unless specifically identified.",
    "Additional quantities or work arising from concealed or changed site conditions.",
  ], LEFT + colWidth + colGap + 3, listY, colWidth - 6);
  y = Math.max(includedEnd, listY + 115) + 30;
  document.roundedRect(LEFT, y, CONTENT_WIDTH, 91, 6).fill("#F7F9F6");
  document.font("Helvetica-Bold").fontSize(10).fillColor(DARK_GREEN).text("Scope changes", LEFT + 14, y + 14);
  document.font("Helvetica").fontSize(9).fillColor(TEXT)
    .text("If the requested work, quantities, or site conditions differ from this proposal, the change in scope and any related price or schedule adjustment should be agreed in writing before the additional work proceeds.", LEFT + 14, y + 34, {
      width: CONTENT_WIDTH - 28,
      lineGap: 2,
    });
  y += 116;
  document.font("Helvetica").fontSize(8).fillColor(MUTED)
    .text("Items identified as not included may be added by written agreement. This page is a scope summary and does not replace a fully executed project agreement.", LEFT, y, {
      width: CONTENT_WIDTH,
    });

  y = addPage("Terms & Acceptance");
  y = drawSectionTitle(document, "Terms & acceptance", y, "Review the scope and pricing, then complete the approval section below.");
  document.roundedRect(LEFT, y, CONTENT_WIDTH, 81, 6).fill(PALE_GREEN);
  document.font("Helvetica-Bold").fontSize(10).fillColor(DARK_GREEN)
    .text("Proposal amount", LEFT + 14, y + 15);
  document.font("Helvetica-Bold").fontSize(22).fillColor(DARK_GREEN)
    .text(money(totals.sellTotal), LEFT + 14, y + 36);
  document.font("Helvetica").fontSize(8.5).fillColor(MUTED)
    .text(`Based on ${totals.rows.length} itemized scope ${totals.rows.length === 1 ? "item" : "items"}.`, RIGHT - 225, y + 42, { width: 210, align: "right" });
  y += 105;
  document.font("Helvetica-Bold").fontSize(11).fillColor(DARK_GREEN).text("Terms to confirm", LEFT, y);
  y += 22;
  const terms = [
    ["Payment schedule", "To be specified in the written project agreement."],
    ["Project schedule", "To be coordinated and confirmed before work begins."],
    ["Proposal validity", "No expiration date was provided with the quote."],
    ["Warranty", "Refer to the written project agreement; no warranty terms were provided with the quote."],
  ];
  for (const [label, value] of terms) {
    document.moveTo(LEFT, y + 21).lineTo(RIGHT, y + 21).strokeColor(RULE).lineWidth(0.6).stroke();
    document.font("Helvetica-Bold").fontSize(8.5).fillColor(TEXT).text(label, LEFT, y + 5, { width: 132 });
    document.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(value, LEFT + 145, y + 5, { width: CONTENT_WIDTH - 145 });
    y += 31;
  }
  y += 14;
  document.font("Helvetica-Bold").fontSize(11).fillColor(DARK_GREEN).text("Acceptance", LEFT, y);
  y += 24;
  document.font("Helvetica").fontSize(9).fillColor(TEXT)
    .text("By signing below, the customer confirms acceptance of the scope and proposal amount shown in this document, subject to the final written project agreement.", LEFT, y, {
      width: CONTENT_WIDTH,
      lineGap: 2,
    });
  y += 45;
  const signatureGap = 28;
  const signatureWidth = (CONTENT_WIDTH - signatureGap) / 2;
  document.moveTo(LEFT, y + 29).lineTo(LEFT + signatureWidth, y + 29).strokeColor(MUTED).lineWidth(0.7).stroke();
  document.moveTo(LEFT + signatureWidth + signatureGap, y + 29).lineTo(RIGHT, y + 29).strokeColor(MUTED).lineWidth(0.7).stroke();
  document.font("Helvetica").fontSize(8).fillColor(MUTED).text("Customer signature", LEFT, y + 36);
  document.text("Date", LEFT + signatureWidth + signatureGap, y + 36);
  y += 75;
  document.moveTo(LEFT, y + 29).lineTo(LEFT + signatureWidth, y + 29).strokeColor(MUTED).lineWidth(0.7).stroke();
  document.moveTo(LEFT + signatureWidth + signatureGap, y + 29).lineTo(RIGHT, y + 29).strokeColor(MUTED).lineWidth(0.7).stroke();
  document.font("Helvetica").fontSize(8).fillColor(MUTED).text("Printed name / title", LEFT, y + 36);
  document.text("Project / purchase order reference", LEFT + signatureWidth + signatureGap, y + 36, { width: signatureWidth });
  y += 77;
  document.roundedRect(LEFT, y, CONTENT_WIDTH, 43, 5).fill("#F7F9F6");
  document.font("Helvetica-Bold").fontSize(9).fillColor(DARK_GREEN).text(siteName, LEFT + 12, y + 9);
  document.font("Helvetica").fontSize(8).fillColor(MUTED)
    .text(`${contact.telephone}  |  ${contact.email}  |  ${contact.streetAddress}, ${contact.addressLocality}, ${contact.addressRegion} ${contact.postalCode}`, LEFT + 12, y + 24, {
      width: CONTENT_WIDTH - 24,
    });

  const pageRange = document.bufferedPageRange();
  for (let pageIndex = pageRange.start; pageIndex < pageRange.start + pageRange.count; pageIndex += 1) {
    document.switchToPage(pageIndex);
    drawFooter(document, pageIndex + 1, pageRange.count);
  }
  document.end();
  return done;
}
