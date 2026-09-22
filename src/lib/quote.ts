export type QuoteLine = {
  fixtureId: string;
  address: string;
  location: string;
  existingQty: number;
  existingDescription: string;
  existingWatts: string;
  proposedQty: number;
  proposedDescription: string;
  proposedWatts: string;
  height: string;
  installNotes: string;
  productCost: number;
  laborCost: number;
};

export type Quote = {
  projectName: string;
  address: string;
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
  fixtureId: '',
  address: '',
  location: '',
  existingQty: 0,
  existingDescription: '',
  existingWatts: '',
  proposedQty: 0,
  proposedDescription: '',
  proposedWatts: '',
  height: '',
  installNotes: '',
  productCost: 0,
  laborCost: 0,
});

export const emptyQuote = (): Quote => ({
  projectName: '',
  address: '',
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
  const rows = activeLines.map((line) => {
    const productSubtotal = line.productCost * line.proposedQty;
    const productTax = productSubtotal * quote.taxRate;
    const productTotal = productSubtotal + productTax;
    const productSell = productTotal / Math.max(1 - quote.productMarkup, 0.01);
    const laborTotal = line.laborCost * line.proposedQty;
    const laborSell = laborTotal / Math.max(1 - quote.laborMargin, 0.01);
    const sellTotal = productSell + laborSell;
    return { line, productSubtotal, productTax, productTotal, productSell, laborTotal, laborSell, sellTotal };
  });
  const productCost = rows.reduce((sum, row) => sum + row.productTotal, 0);
  const laborCost = rows.reduce((sum, row) => sum + row.laborTotal, 0);
  const directCost = productCost + laborCost + quote.shipping + quote.travel + quote.miscellaneous;
  const contingency = directCost * quote.contingency;
  const sellTotal = rows.reduce((sum, row) => sum + row.sellTotal, 0) + quote.shipping + quote.travel + quote.miscellaneous + contingency;
  return { rows, productCost, laborCost, directCost, contingency, sellTotal, profit: sellTotal - directCost, margin: sellTotal ? (sellTotal - directCost) / sellTotal : 0 };
}

export function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}
