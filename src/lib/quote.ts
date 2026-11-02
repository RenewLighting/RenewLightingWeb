import type { ConditionCode, WorkCode } from "@/lib/quote-identifiers";

export type QuoteLine = {
  id: string;
  fixtureId: string;
  address: string;
  location: string;
  existingFixtureType: string;
  existingQty: number;
  existingDescription: string;
  existingWatts: string;
  existingWattageReference?: string;
  annualOperatingHoursOverride?: number | null;
  workCodes?: WorkCode[];
  conditionCode?: ConditionCode | "";
  proposedFixtureType: string;
  technology: string;
  mountingType: string;
  distribution: string;
  voltage: string;
  colorTemperature: string;
  dimming: string;
  controlType: string;
  controlSavingsPercent: number;
  proposedQty: number;
  proposedDescription: string;
  proposedWatts: string;
  productCostSource: "" | "prior_proposal" | "warehouse_quote";
  productCostVendor: string;
  productCostQuotedAt: string;
  productCostPriorUseCount: number;
  suggestedProductId: number | null;
  photoIds: string[];
  height: string;
  installNotes: string;
  productCost: number;
  laborCost: number;
  taxRateOverride?: number;
  productMarkupOverride?: number;
  laborMarginOverride?: number;
};

export type QuoteEnergyAnalysis = {
  annualOperatingHours: number | null;
  electricityRatePerKwh: number | null;
  demandChargePerKwMonth: number | null;
  demandCoincidencePercent: number | null;
  annualMaintenanceSavings: number | null;
  estimatedIncentive: number | null;
  analysisYears: number;
  electricityEscalationPercent: number;
  carbonEmissionKgPerKwh: number | null;
};

export type Quote = {
  projectName: string;
  address: string;
  pricingModel?: "standard" | "estimate_audit";
  taxRate: number;
  productMarkup: number;
  laborMargin: number;
  contingency: number;
  shipping: number;
  travel: number;
  miscellaneous: number;
  energyAnalysis: QuoteEnergyAnalysis;
  lines: QuoteLine[];
};

export const emptyEnergyAnalysis = (): QuoteEnergyAnalysis => ({
  annualOperatingHours: null,
  electricityRatePerKwh: null,
  demandChargePerKwMonth: null,
  demandCoincidencePercent: null,
  annualMaintenanceSavings: null,
  estimatedIncentive: null,
  analysisYears: 10,
  electricityEscalationPercent: 0,
  carbonEmissionKgPerKwh: null,
});

export const emptyLine = (): QuoteLine => ({
  id: crypto.randomUUID(),
  fixtureId: '',
  address: '',
  location: '',
  existingFixtureType: '',
  existingQty: 0,
  existingDescription: '',
  existingWatts: '',
  existingWattageReference: '',
  annualOperatingHoursOverride: null,
  workCodes: [],
  conditionCode: '',
  proposedFixtureType: '',
  technology: '',
  mountingType: '',
  distribution: '',
  voltage: '',
  colorTemperature: '',
  dimming: '',
  controlType: '',
  controlSavingsPercent: 0,
  proposedQty: 0,
  proposedDescription: '',
  proposedWatts: '',
  productCostSource: '',
  productCostVendor: '',
  productCostQuotedAt: '',
  productCostPriorUseCount: 0,
  suggestedProductId: null,
  photoIds: [],
  height: '',
  installNotes: '',
  productCost: 0,
  laborCost: 0,
});

export const emptyQuote = (): Quote => ({
  projectName: '',
  address: '',
  pricingModel: "standard",
  taxRate: 0.0875,
  productMarkup: 0.2,
  laborMargin: 0.35,
  contingency: 0,
  shipping: 0,
  travel: 0,
  miscellaneous: 0,
  energyAnalysis: emptyEnergyAnalysis(),
  lines: [emptyLine()],
});

export function calculateQuote(quote: Quote) {
  const activeLines = quote.lines.filter((line) => line.proposedQty > 0 || line.productCost > 0 || line.laborCost > 0);
  const calculatedRows = activeLines.map((line) => {
    const taxRate = line.taxRateOverride ?? quote.taxRate;
    const productMarkup = line.productMarkupOverride ?? quote.productMarkup;
    const laborMargin = line.laborMarginOverride ?? quote.laborMargin;
    const productSubtotal = line.productCost * line.proposedQty;
    const productTax = productSubtotal * taxRate;
    const productTotal = productSubtotal + productTax;
    const productSell = productTotal / Math.max(1 - productMarkup, 0.01);
    const laborTotal = line.laborCost * line.proposedQty;
    const laborSell = laborTotal / Math.max(1 - laborMargin, 0.01);
    const baseSellTotal = productSell + laborSell;
    return {
      line,
      taxRate,
      productMarkup,
      laborMargin,
      productSubtotal,
      productTax,
      productTotal,
      productSell,
      laborTotal,
      laborSell,
      baseSellTotal,
    };
  });
  const projectCosts = quote.shipping + quote.travel + quote.miscellaneous;
  const positiveCostComponents = calculatedRows.reduce((count, row) => count
    + Number(row.productSell > 0) + Number(row.laborSell > 0), 0);
  const projectCostPerComponent = quote.pricingModel === "estimate_audit" && positiveCostComponents > 0
    ? projectCosts / positiveCostComponents
    : 0;
  const rows = calculatedRows.map((row) => {
    const projectCostAllocation = projectCostPerComponent
      * (Number(row.productSell > 0) + Number(row.laborSell > 0));
    return {
      ...row,
      projectCostAllocation,
      sellTotal: row.baseSellTotal + projectCostAllocation,
    };
  });
  const productCost = rows.reduce((sum, row) => sum + row.productTotal, 0);
  const laborCost = rows.reduce((sum, row) => sum + row.laborTotal, 0);
  const directCost = productCost + laborCost + quote.shipping + quote.travel + quote.miscellaneous;
  const contingency = directCost * quote.contingency;
  const sellTotal = rows.reduce((sum, row) => sum + row.sellTotal, 0)
    + (quote.pricingModel === "estimate_audit" ? 0 : projectCosts)
    + contingency;
  return { rows, productCost, laborCost, directCost, contingency, sellTotal, profit: sellTotal - directCost, margin: sellTotal ? (sellTotal - directCost) / sellTotal : 0 };
}

function parseWatts(value: string) {
  const text = value.trim();
  if (/-\s*\d+(?:\.\d+)?\s*w\b/i.test(text)) return null;
  const multiLamp = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*w\b/i);
  if (multiLamp) return Number(multiLamp[1]) * Number(multiLamp[2]);
  const explicitWatts = text.match(/(\d+(?:\.\d+)?)\s*w\b/i);
  if (explicitWatts) return Number(explicitWatts[1]);
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return null;
}

export type EnergyLineResult = {
  line: QuoteLine;
  existingConnectedKw: number;
  proposedConnectedKw: number;
  existingAnnualKwh: number;
  proposedAnnualKwh: number;
  annualKwhSavings: number;
  annualEnergyCostSavings: number | null;
  demandReductionKw: number;
};

export function calculateEnergySavings(quote: Quote) {
  const settings = quote.energyAnalysis ?? emptyEnergyAnalysis();
  const eligibleLines = quote.lines.filter((line) => line.existingDescription.trim()
    || line.proposedDescription.trim()
    || line.existingQty > 0
    || line.proposedQty > 0);
  const lineResults: EnergyLineResult[] = [];
  const missingInputs: string[] = [];
  const financialMissingInputs: string[] = [];

  if (!eligibleLines.length) missingInputs.push("Add at least one fixture line.");

  eligibleLines.forEach((line, index) => {
    const existingWatts = parseWatts(line.existingWatts);
    const proposedWatts = parseWatts(line.proposedWatts);
    const hours = line.annualOperatingHoursOverride ?? settings.annualOperatingHours;
    const controlSavingsPercent = line.controlSavingsPercent ?? 0;
    const rowMissing: string[] = [];
    if (existingWatts === null) rowMissing.push("existing watts");
    if (proposedWatts === null) rowMissing.push("proposed watts");
    if (hours === null || !Number.isFinite(hours) || hours < 0 || hours > 8760) rowMissing.push("annual operating hours (0-8,760)");
    if (!Number.isFinite(line.existingQty) || line.existingQty < 0) rowMissing.push("existing quantity");
    if (!Number.isFinite(line.proposedQty) || line.proposedQty < 0) rowMissing.push("proposed quantity");
    if (!Number.isFinite(controlSavingsPercent) || controlSavingsPercent < 0 || controlSavingsPercent > 100) {
      rowMissing.push("control savings percentage (0-100)");
    }
    if (rowMissing.length) {
      missingInputs.push(`Line ${index + 1}: enter ${rowMissing.join(", ")}.`);
      return;
    }

    const operatingHours = hours as number;
    const existingConnectedKw = (line.existingQty * (existingWatts as number)) / 1000;
    const proposedConnectedKw = (line.proposedQty * (proposedWatts as number)) / 1000;
    const controlSavings = controlSavingsPercent / 100;
    const existingAnnualKwh = existingConnectedKw * operatingHours;
    const proposedAnnualKwh = proposedConnectedKw * operatingHours * (1 - controlSavings);
    const annualKwhSavings = existingAnnualKwh - proposedAnnualKwh;
    const annualEnergyCostSavings = settings.electricityRatePerKwh === null
      || !Number.isFinite(settings.electricityRatePerKwh)
      || settings.electricityRatePerKwh < 0
      ? null
      : annualKwhSavings * settings.electricityRatePerKwh;

    lineResults.push({
      line,
      existingConnectedKw,
      proposedConnectedKw,
      existingAnnualKwh,
      proposedAnnualKwh,
      annualKwhSavings,
      annualEnergyCostSavings,
      demandReductionKw: existingConnectedKw - proposedConnectedKw,
    });
  });

  const energyReady = eligibleLines.length > 0 && lineResults.length === eligibleLines.length;
  if (energyReady && (settings.electricityRatePerKwh === null
    || !Number.isFinite(settings.electricityRatePerKwh)
    || settings.electricityRatePerKwh < 0)) {
    financialMissingInputs.push("Enter the project electricity rate (0 or greater) to calculate utility-bill savings and payback.");
  }
  if (energyReady && settings.annualMaintenanceSavings !== null
    && (!Number.isFinite(settings.annualMaintenanceSavings) || settings.annualMaintenanceSavings < 0)) {
    financialMissingInputs.push("Annual maintenance savings must be a non-negative project estimate.");
  }
  if (energyReady && settings.estimatedIncentive !== null
    && (!Number.isFinite(settings.estimatedIncentive) || settings.estimatedIncentive < 0)) {
    financialMissingInputs.push("Estimated incentive must be a non-negative project estimate.");
  }
  if (energyReady && ((settings.demandChargePerKwMonth !== null
    && (!Number.isFinite(settings.demandChargePerKwMonth) || settings.demandChargePerKwMonth < 0))
    || (settings.demandCoincidencePercent !== null
      && (!Number.isFinite(settings.demandCoincidencePercent)
        || settings.demandCoincidencePercent < 0
        || settings.demandCoincidencePercent > 100)))) {
    financialMissingInputs.push("Demand charge must be non-negative and demand coincidence must be between 0 and 100%.");
  }
  const financialReady = energyReady && financialMissingInputs.length === 0;
  const annualKwhSavings = energyReady
    ? lineResults.reduce((sum, line) => sum + line.annualKwhSavings, 0)
    : null;
  const annualEnergyCostSavings = financialReady
    ? lineResults.reduce((sum, line) => sum + (line.annualEnergyCostSavings ?? 0), 0)
    : null;
  const demandReductionKw = energyReady
    ? lineResults.reduce((sum, line) => sum + line.demandReductionKw, 0)
    : null;
  const demandSavingsAvailable = financialReady
    && settings.demandChargePerKwMonth !== null
    && settings.demandChargePerKwMonth >= 0
    && settings.demandCoincidencePercent !== null;
  const annualDemandCostSavings = demandSavingsAvailable
    ? (demandReductionKw ?? 0)
      * (settings.demandCoincidencePercent as number / 100)
      * (settings.demandChargePerKwMonth as number)
      * 12
    : null;
  const annualMaintenanceSavings = financialReady ? settings.annualMaintenanceSavings : null;
  const annualTotalCostSavings = financialReady
    ? (annualEnergyCostSavings ?? 0)
      + (annualDemandCostSavings ?? 0)
      + (annualMaintenanceSavings ?? 0)
    : null;
  const estimatedIncentive = financialReady ? settings.estimatedIncentive : null;
  const projectSellTotal = calculateQuote(quote).sellTotal;
  const netProjectInvestment = financialReady && projectSellTotal > 0
    ? Math.max(0, projectSellTotal - (estimatedIncentive ?? 0))
    : null;
  const simplePaybackYears = annualTotalCostSavings !== null && annualTotalCostSavings > 0
    && netProjectInvestment !== null
    && netProjectInvestment > 0
    ? netProjectInvestment / annualTotalCostSavings
    : null;
  const analysisYears = Math.min(50, Math.max(1, Math.floor(settings.analysisYears || 10)));
  const electricityEscalation = Math.min(30, Math.max(0, settings.electricityEscalationPercent || 0)) / 100;
  const lifetimeEnergyCostSavings = annualEnergyCostSavings === null
    ? null
    : annualEnergyCostSavings * Array.from({ length: analysisYears }, (_, year) =>
      (1 + electricityEscalation) ** year).reduce((sum, amount) => sum + amount, 0);
  const lifetimeCostSavings = financialReady
    ? (lifetimeEnergyCostSavings ?? 0)
      + ((annualDemandCostSavings ?? 0) + (annualMaintenanceSavings ?? 0)) * analysisYears
    : null;
  const lifetimeNetSavings = lifetimeCostSavings !== null && netProjectInvestment !== null
    ? lifetimeCostSavings - netProjectInvestment
    : null;
  const annualCarbonReductionTonnes = annualKwhSavings !== null
    && settings.carbonEmissionKgPerKwh !== null
    && Number.isFinite(settings.carbonEmissionKgPerKwh)
    && settings.carbonEmissionKgPerKwh >= 0
    ? annualKwhSavings * settings.carbonEmissionKgPerKwh / 1000
    : null;

  return {
    energyReady,
    financialReady,
    missingInputs,
    financialMissingInputs,
    lineResults,
    annualKwhSavings,
    annualEnergyCostSavings,
    demandReductionKw,
    annualDemandCostSavings,
    annualMaintenanceSavings,
    annualTotalCostSavings,
    estimatedIncentive,
    netProjectInvestment,
    simplePaybackYears,
    analysisYears,
    lifetimeEnergyCostSavings,
    lifetimeCostSavings,
    lifetimeNetSavings,
    annualCarbonReductionTonnes,
  };
}

export function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}
