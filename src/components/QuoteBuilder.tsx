"use client";

import { useState } from "react";
import Link from "next/link";

import { calculateQuote, emptyLine, emptyQuote, money, type Quote, type QuoteLine } from "@/lib/quote";

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function QuoteBuilder() {
  const [quote, setQuote] = useState<Quote>(emptyQuote);
  const totals = calculateQuote(quote);

  const formulaFields = [
    { key: "taxRate", label: "Product tax", description: "Product subtotal x tax rate is added before markup.", suffix: "%" },
    { key: "productMarkup", label: "Product margin", description: "Product sell price = taxed product cost / (1 - margin).", suffix: "%" },
    { key: "laborMargin", label: "Labor margin", description: "Labor sell price = labor cost / (1 - margin).", suffix: "%" },
    { key: "contingency", label: "Contingency", description: "Contingency = direct project cost x contingency rate.", suffix: "%" },
  ] as const;

  function updateQuote<K extends keyof Quote>(key: K, value: Quote[K]) {
    setQuote((current) => ({ ...current, [key]: value }));
  }

  function updateLine(index: number, key: keyof QuoteLine, value: string | number) {
    setQuote((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line),
    }));
  }

  function resetFormulaSettings() {
    const defaults = emptyQuote();
    setQuote((current) => ({
      ...current,
      taxRate: defaults.taxRate,
      productMarkup: defaults.productMarkup,
      laborMargin: defaults.laborMargin,
      contingency: defaults.contingency,
    }));
  }

  function download(format: "xlsx" | "pdf") {
    const link = document.createElement("a");
    link.href = `/api/quote/export?format=${format}&data=${encodeURIComponent(JSON.stringify(quote))}`;
    link.click();
  }

  return (
    <main className="min-h-screen bg-surface-container-low">
      <header className="border-b border-outline-variant/20 bg-surface-container-lowest">
        <div className="max-w-[1500px] mx-auto px-6 lg:px-10 h-20 flex items-center justify-between gap-6">
          <div>
            <p className="text-primary font-bold tracking-widest uppercase text-xs">Renew Workspace</p>
            <h1 className="font-headline text-2xl font-extrabold">Quote Builder</h1>
          </div>
          <Link href="/employee" className="text-sm font-semibold text-on-surface-variant hover:text-primary">Back to portal</Link>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-6 lg:px-10 py-8">
        <section className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <label className="text-sm font-semibold">Project name<input className="mt-2 w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 font-normal" value={quote.projectName} onChange={(event) => updateQuote("projectName", event.target.value)} placeholder="Project name" /></label>
            <label className="text-sm font-semibold">Address<input className="mt-2 w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 font-normal" value={quote.address} onChange={(event) => updateQuote("address", event.target.value)} placeholder="Project address" /></label>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <section className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-outline-variant/15 flex items-center justify-between gap-4">
              <div><h2 className="font-headline text-xl font-bold">Estimate lines</h2><p className="text-sm text-on-surface-variant">Enter fixtures, quantities, materials, and labor. Totals update instantly.</p></div>
              <button type="button" className="primary-gradient text-on-primary px-4 py-2 rounded-full text-sm font-bold" onClick={() => updateQuote("lines", [...quote.lines, emptyLine()])}>Add line</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1250px] w-full text-sm">
                <thead className="bg-surface-container-low text-left text-xs uppercase tracking-wider text-on-surface-variant"><tr>{["ID", "Location", "Proposed fixture", "Qty", "Product cost", "Labor cost", "Line total", ""].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
                <tbody>{quote.lines.map((line, index) => { const row = totals.rows.find((item) => item.line === line); return <tr key={index} className="border-t border-outline-variant/10 align-top">
                  <td className="p-3"><input className="w-20 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.fixtureId} onChange={(event) => updateLine(index, "fixtureId", event.target.value)} placeholder="F01" /></td>
                  <td className="p-3"><input className="w-40 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.location} onChange={(event) => updateLine(index, "location", event.target.value)} placeholder="Location" /></td>
                  <td className="p-3"><input className="w-64 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.proposedDescription} onChange={(event) => updateLine(index, "proposedDescription", event.target.value)} placeholder="Fixture description" /><textarea className="mt-2 w-64 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.installNotes} onChange={(event) => updateLine(index, "installNotes", event.target.value)} placeholder="Install notes" rows={2} /></td>
                  <td className="p-3"><input type="number" min="0" className="w-20 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.proposedQty || ""} onChange={(event) => updateLine(index, "proposedQty", numberValue(event.target.value))} /></td>
                  <td className="p-3"><input type="number" min="0" step="0.01" className="w-28 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.productCost || ""} onChange={(event) => updateLine(index, "productCost", numberValue(event.target.value))} /></td>
                  <td className="p-3"><input type="number" min="0" step="0.01" className="w-28 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.laborCost || ""} onChange={(event) => updateLine(index, "laborCost", numberValue(event.target.value))} /></td>
                  <td className="p-3 font-semibold">{row ? money(row.sellTotal) : money(0)}</td>
                  <td className="p-3"><button type="button" className="text-error text-xs font-bold" onClick={() => updateQuote("lines", quote.lines.filter((_, lineIndex) => lineIndex !== index))}>Remove</button></td>
                </tr>; })}</tbody>
              </table>
            </div>
          </section>

          <aside className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 xl:sticky xl:top-6">
            <h2 className="font-headline text-xl font-bold mb-5">Pricing controls</h2>
            <div className="mb-6 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-headline font-bold">Formula settings</h3><p className="mt-1 text-xs text-on-surface-variant">Edit the business rules used by the live totals and both exports.</p></div>
                <button type="button" className="shrink-0 text-xs font-bold text-primary hover:underline" onClick={resetFormulaSettings}>Reset defaults</button>
              </div>
              <div className="mt-4 space-y-4">{formulaFields.map(({ key, label, description, suffix }) => <label key={key} className="block text-sm font-semibold">{label}<span className="ml-1 text-on-surface-variant">({suffix})</span><input type="number" min="0" max="99.99" step="0.01" className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 font-normal" value={(quote[key] as number) * 100} onChange={(event) => updateQuote(key, numberValue(event.target.value) / 100)} /><span className="mt-1 block text-xs font-normal leading-relaxed text-on-surface-variant">{description}</span></label>)}</div>
            </div>
            <div className="space-y-4 text-sm"><h3 className="font-headline font-bold">Project costs</h3>{([["shipping", "Shipping"], ["travel", "Travel"], ["miscellaneous", "Miscellaneous"]] as const).map(([key, label]) => <label key={key} className="block font-semibold">{label}<input type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 font-normal" value={quote[key] || ""} onChange={(event) => updateQuote(key, numberValue(event.target.value))} /> </label>)}</div>
            <div className="border-t border-outline-variant/15 mt-6 pt-5 space-y-3 text-sm"><div className="flex justify-between"><span>Direct cost</span><strong>{money(totals.directCost)}</strong></div><div className="flex justify-between"><span>Contingency</span><strong>{money(totals.contingency)}</strong></div><div className="flex justify-between text-lg"><span>Sell total</span><strong className="text-primary">{money(totals.sellTotal)}</strong></div><div className="flex justify-between text-on-surface-variant"><span>Estimated profit</span><span>{money(totals.profit)} ({(totals.margin * 100).toFixed(1)}%)</span></div></div>
            <div className="mt-6 grid grid-cols-2 gap-3"><button type="button" className="bg-on-surface text-surface px-3 py-3 rounded-xl text-sm font-bold" onClick={() => download("xlsx")}>Excel</button><button type="button" className="primary-gradient text-on-primary px-3 py-3 rounded-xl text-sm font-bold" onClick={() => download("pdf")}>Proposal PDF</button></div>
          </aside>
        </div>
      </div>
    </main>
  );
}
