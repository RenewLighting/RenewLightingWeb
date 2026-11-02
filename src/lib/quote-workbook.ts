import * as XLSX from "xlsx";

import { calculateEnergySavings, calculateQuote, type Quote } from "@/lib/quote";
import { describeCondition, describeWorkCodes } from "@/lib/quote-identifiers";

export function createQuoteWorkbook(quote: Quote) {
  const totals = calculateQuote(quote);
  const energy = calculateEnergySavings(quote);
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
      "Existing Fixture Type": line.existingFixtureType ?? "",
      "Existing Watts": line.existingWatts,
      "Existing Wattage Reference": line.existingWattageReference ?? "",
      "Existing Qty": line.existingQty,
      "Annual Operating Hours Override": line.annualOperatingHoursOverride ?? "",
      "Proposed Fixture": line.proposedDescription,
      "Proposed Fixture Type": line.proposedFixtureType ?? "",
      "Proposed Watts": line.proposedWatts,
      Technology: line.technology ?? "",
      Mounting: line.mountingType ?? "",
      Distribution: line.distribution ?? "",
      Voltage: line.voltage ?? "",
      "Color Temperature": line.colorTemperature ?? "",
      Dimming: line.dimming ?? "",
      Controls: line.controlType ?? "",
      "Control Savings Percent": line.controlSavingsPercent ?? 0,
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
    "Existing Fixture Type": "",
    "Existing Watts": "",
    "Existing Wattage Reference": "",
    "Existing Qty": 0,
    "Annual Operating Hours Override": "",
    "Proposed Fixture": "TOTAL",
    "Proposed Fixture Type": "",
    "Proposed Watts": "",
    Technology: "",
    Mounting: "",
    Distribution: "",
    Voltage: "",
    "Color Temperature": "",
    Dimming: "",
    Controls: "",
    "Control Savings Percent": 0,
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
  const settings = quote.energyAnalysis;
  const energyRows: unknown[][] = [
    ["Energy Savings Analysis", "Value", "Notes"],
    ["Annual operating hours", settings?.annualOperatingHours ?? "", "Site default; per-line overrides are on the Quote sheet."],
    ["Electricity rate ($/kWh)", settings?.electricityRatePerKwh ?? "", "Project-specific rate; no default applied."],
    ["Demand charge ($/kW-month)", settings?.demandChargePerKwMonth ?? "", "Demand savings are only estimated when coincidence is also entered."],
    ["Peak-demand coincidence (%)", settings?.demandCoincidencePercent ?? "", "Project-specific; do not assume all load reduction is coincident."],
    ["Annual maintenance savings ($)", settings?.annualMaintenanceSavings ?? "", "Optional verified estimate."],
    ["Estimated incentive ($)", settings?.estimatedIncentive ?? "", "Optional estimate; verify eligibility and availability."],
    ["Analysis period (years)", settings?.analysisYears ?? 10, "Undiscounted estimate."],
    ["Electricity price escalation (%/year)", settings?.electricityEscalationPercent ?? 0, "Applied to energy-only savings."],
    ["Grid emissions factor (kg CO2e/kWh)", settings?.carbonEmissionKgPerKwh ?? "", "Optional region-appropriate factor."],
    [],
    ["Analysis result", "Value", "Status"],
    ["Annual existing energy (kWh)", energy.energyReady ? energy.lineResults.reduce((sum, line) => sum + line.existingAnnualKwh, 0) : "", energy.energyReady ? "Calculated" : "Incomplete fixture or operating-hour inputs"],
    ["Annual proposed energy (kWh)", energy.energyReady ? energy.lineResults.reduce((sum, line) => sum + line.proposedAnnualKwh, 0) : "", energy.energyReady ? "Calculated" : "Incomplete fixture or operating-hour inputs"],
    ["Annual energy reduction (kWh)", energy.annualKwhSavings ?? "", energy.energyReady ? "Calculated" : "Not calculated"],
    ["Annual energy bill savings ($)", energy.annualEnergyCostSavings ?? "", energy.financialReady ? "Estimated" : "Requires a valid project electricity rate and complete assumptions"],
    ["Annual demand savings ($)", energy.annualDemandCostSavings ?? "", energy.annualDemandCostSavings === null ? "Not calculated; demand charge and coincidence are required" : "Estimated"],
    ["Annual maintenance savings ($)", energy.annualMaintenanceSavings ?? "", energy.annualMaintenanceSavings === null ? "Not entered" : "Entered estimate"],
    ["Simple payback (years)", energy.simplePaybackYears ?? "", energy.simplePaybackYears === null ? "Not calculated" : "Estimated"],
    [`${energy.analysisYears}-year net savings ($)`, energy.lifetimeNetSavings ?? "", energy.lifetimeNetSavings === null ? "Not calculated" : "Undiscounted estimate"],
    ["Annual net emissions change (tonnes CO2e; negative means increase)", energy.annualCarbonReductionTonnes ?? "", energy.annualCarbonReductionTonnes === null ? "Requires complete kWh analysis and emissions factor" : "Estimated"],
    [],
    ["Line", "Existing Fixture", "Existing Qty", "Existing Watts", "Annual Existing kWh", "Proposed Fixture", "Proposed Qty", "Proposed Watts", "Annual Proposed kWh", "Annual kWh Reduction", "Annual Energy Bill Savings"],
    ...quote.lines.map((line, index) => {
      const result = energy.lineResults.find((item) => item.line.id === line.id);
      return [
        line.fixtureId || index + 1,
        line.existingDescription,
        line.existingQty,
        line.existingWatts,
        result?.existingAnnualKwh ?? "",
        line.proposedDescription,
        line.proposedQty,
        line.proposedWatts,
        result?.proposedAnnualKwh ?? "",
        result?.annualKwhSavings ?? "",
        result?.annualEnergyCostSavings ?? "",
      ];
    }),
    [],
    ["Methodology", "Existing annual kWh = existing qty × existing input kW × operating hours. Proposed annual kWh applies the entered control savings percentage to proposed load. Energy cost savings require the entered electricity rate; demand savings require both demand charge and peak coincidence. Values are estimates, not guaranteed performance."],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(energyRows), "Energy Savings");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
