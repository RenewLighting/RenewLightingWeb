import * as XLSX from "xlsx";

import { calculateQuote, type Quote } from "@/lib/quote";
import { describeCondition, describeWorkCodes } from "@/lib/quote-identifiers";

export function createQuoteWorkbook(quote: Quote) {
  const totals = calculateQuote(quote);
  const rows = quote.lines.map((line) => {
    const calculated = totals.rows.find((row) => row.line.id === line.id);
    return {
      "Fixture ID": line.fixtureId,
      "Work Codes": (line.workCodes ?? []).join(", "),
      "Work Description": describeWorkCodes(line.workCodes),
      "Condition Code": line.conditionCode ?? "",
      "Condition Description": describeCondition(line.conditionCode),
      Location: line.location,
      "Existing Fixture": line.existingDescription,
      "Existing Watts": line.existingWatts,
      "Existing Wattage Reference": line.existingWattageReference ?? "",
      "Existing Qty": line.existingQty,
      "Proposed Fixture": line.proposedDescription,
      "Proposed Watts": line.proposedWatts,
      Quantity: line.proposedQty,
      "Product Cost": line.productCost,
      "Product Extended Cost": calculated?.productTotal ?? 0,
      "Internal Cost Basis": line.productCostSource === "warehouse_quote"
        ? `Warehouse USD quote${line.productCostVendor ? ` from ${line.productCostVendor}` : ""}${line.productCostQuotedAt ? ` on ${line.productCostQuotedAt}` : ""}`
        : line.productCostSource === "prior_proposal"
          ? `Prior proposal (${line.productCostPriorUseCount || 1} use${line.productCostPriorUseCount === 1 ? "" : "s"})${line.productCostQuotedAt ? ` updated ${line.productCostQuotedAt}` : ""}`
          : "",
      "Labor Unit Cost": line.laborCost,
      "Labor Cost": calculated?.laborTotal ?? 0,
      "Line Sell Price": calculated?.sellTotal ?? 0,
      Notes: line.installNotes,
    };
  });
  rows.push({
    "Fixture ID": "",
    "Work Codes": "",
    "Work Description": "",
    "Condition Code": "",
    "Condition Description": "",
    Location: "",
    "Existing Fixture": "",
    "Existing Watts": "",
    "Existing Wattage Reference": "",
    "Existing Qty": 0,
    "Proposed Fixture": "TOTAL",
    "Proposed Watts": "",
    Quantity: totals.rows.reduce((sum, row) => sum + row.line.proposedQty, 0),
    "Product Cost": totals.productCost,
    "Product Extended Cost": totals.productCost,
    "Internal Cost Basis": "",
    "Labor Unit Cost": 0,
    "Labor Cost": totals.laborCost,
    "Line Sell Price": totals.sellTotal,
    Notes: "",
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Quote");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
