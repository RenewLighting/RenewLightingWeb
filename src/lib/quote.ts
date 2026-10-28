export type QuoteLine = {
  id: string;
  fixtureId: string;
  address: string;
  location: string;
  existingQty: number;
  existingDescription: string;
  existingWatts: string;
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
  lines: QuoteLine[];
};

export const emptyLine = (): QuoteLine => ({
  id: crypto.randomUUID(),
  fixtureId: '',
  address: '',
  location: '',
  existingQty: 0,
  existingDescription: '',
  existingWatts: '',
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

export function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}
