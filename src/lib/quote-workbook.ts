import * as XLSX from "xlsx";

import { calculateQuote, type Quote } from "@/lib/quote";

export function createQuoteWorkbook(quote: Quote) {
  const totals = calculateQuote(quote);
  const rows = totals.rows.map(({ line, productTotal, laborTotal, sellTotal }) => ({
    "Fixture ID": line.fixtureId,
    Location: line.location,
    "Existing Fixture": line.existingDescription,
    "Existing Watts": line.existingWatts,
    "Existing Qty": line.existingQty,
    "Proposed Fixture": line.proposedDescription,
    "Proposed Watts": line.proposedWatts,
    Quantity: line.proposedQty,
    "Product Cost": line.productCost,
    "Product Extended Cost": productTotal,
    "Internal Cost Basis": line.productCostSource === "warehouse_quote"
      ? `Warehouse USD quote${line.productCostVendor ? ` from ${line.productCostVendor}` : ""}${line.productCostQuotedAt ? ` on ${line.productCostQuotedAt}` : ""}`
      : line.productCostSource === "prior_proposal"
        ? `Prior proposal (${line.productCostPriorUseCount || 1} use${line.productCostPriorUseCount === 1 ? "" : "s"})${line.productCostQuotedAt ? ` updated ${line.productCostQuotedAt}` : ""}`
        : "",
    "Labor Cost": laborTotal,
    "Line Sell Price": sellTotal,
    Notes: line.installNotes,
  }));
  rows.push({
    "Fixture ID": "",
    Location: "",
    "Existing Fixture": "",
    "Existing Watts": "",
    "Existing Qty": 0,
    "Proposed Fixture": "TOTAL",
    "Proposed Watts": "",
    Quantity: totals.rows.reduce((sum, row) => sum + row.line.proposedQty, 0),
    "Product Cost": totals.productCost,
    "Product Extended Cost": totals.productCost,
    "Internal Cost Basis": "",
    "Labor Cost": totals.laborCost,
    "Line Sell Price": totals.sellTotal,
    Notes: "",
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Quote");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
