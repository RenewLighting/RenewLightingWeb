import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";

import { authOptions } from "@/lib/auth";
import { calculateQuote, money, type Quote } from "@/lib/quote";

export const dynamic = "force-dynamic";

function parseQuote(value: string | null): Quote | null {
  if (!value) return null;
  try {
    const quote = JSON.parse(value) as Quote;
    if (!quote || !Array.isArray(quote.lines)) return null;
    return quote;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email?.toLowerCase().endsWith("@renewlighting.com")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const quote = parseQuote(url.searchParams.get("data"));
  if (!quote) return NextResponse.json({ error: "Invalid quote" }, { status: 400 });
  const totals = calculateQuote(quote);
  const format = url.searchParams.get("format");

  if (format === "xlsx") {
    const rows = totals.rows.map(({ line, productTotal, laborTotal, sellTotal }) => ({
      "Fixture ID": line.fixtureId,
      Location: line.location,
      "Proposed Fixture": line.proposedDescription,
      Quantity: line.proposedQty,
      "Product Cost": productTotal,
      "Labor Cost": laborTotal,
      "Line Sell Price": sellTotal,
      Notes: line.installNotes,
    }));
    rows.push({ "Fixture ID": "", Location: "", "Proposed Fixture": "TOTAL", Quantity: totals.rows.reduce((sum, row) => sum + row.line.proposedQty, 0), "Product Cost": totals.productCost, "Labor Cost": totals.laborCost, "Line Sell Price": totals.sellTotal, Notes: "" });
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "Quote");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    return new NextResponse(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${(quote.projectName || "quote").replace(/[^a-z0-9]+/gi, "-")}.xlsx"` } });
  }

  if (format === "pdf") {
    const document = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    document.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => document.on("end", () => resolve(Buffer.concat(chunks))));
    document.fontSize(20).text("Renew Lighting Services");
    document.fontSize(10).fillColor("#526052").text("Lighting and electrical estimate proposal");
    document.moveDown();
    document.fillColor("#172117").fontSize(16).text(quote.projectName || "Project Proposal");
    document.fontSize(10).text(quote.address || "");
    document.moveDown();
    document.fontSize(11).text("Scope of work", { underline: true });
    totals.rows.forEach(({ line, sellTotal }) => { document.moveDown(0.4); document.fontSize(10).text(`${line.fixtureId || "Line item"}  ${line.proposedDescription || "Proposed fixture"}  x${line.proposedQty}`); if (line.location) document.text(`Location: ${line.location}`); if (line.installNotes) document.fillColor("#526052").text(line.installNotes); document.fillColor("#172117").text(`Line total: ${money(sellTotal)}`); });
    document.moveDown();
    document.fontSize(12).text(`Proposal total: ${money(totals.sellTotal)}`);
    document.fontSize(10).text(`Estimated profit: ${money(totals.profit)} (${(totals.margin * 100).toFixed(1)}% margin)`);
    document.end();
    const buffer = await done;
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${(quote.projectName || "proposal").replace(/[^a-z0-9]+/gi, "-")}.pdf"` } });
  }

  return NextResponse.json({ error: "format must be xlsx or pdf" }, { status: 400 });
}
