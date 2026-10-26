"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import Icon from "@/components/Icon";
import { calculateQuote, emptyLine, emptyQuote, money, type Quote, type QuoteLine } from "@/lib/quote";
import type { WarehouseQuoteSuggestion } from "@/lib/warehouse-quote-suggestions";

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type SavedQuote = {
  id: number;
  project_name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type ImportedLine = {
  sourceRow: number;
  existingDescription: string;
  proposedDescription: string;
  proposedWatts: string;
  productCost: number | null;
  sourceDate: string | null;
};

type ImportPreview = {
  fileHash: string;
  fileName: string;
  sheetName: string;
  records: ImportedLine[];
  skippedRows: number;
  maxRecordsReached: boolean;
};

type OneDriveFolder = {
  id: string;
  name: string;
  webUrl?: string;
};

type HistoricalSuggestion = {
  description: string;
  watts: string;
  priorUseCount: number;
  latestCost: number | null;
  latestUpdatedAt: string;
};

type SuggestionResponse = {
  history: HistoricalSuggestion[];
  warehouse: WarehouseQuoteSuggestion[];
  warehouseAvailable: boolean;
};

export default function QuoteBuilder() {
  const [quote, setQuote] = useState<Quote>(emptyQuote);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [hasMoreQuotes, setHasMoreQuotes] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [storageStatus, setStorageStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [showOneDrive, setShowOneDrive] = useState(false);
  const [oneDriveBusy, setOneDriveBusy] = useState(false);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderTrail, setFolderTrail] = useState<OneDriveFolder[]>([]);
  const [oneDriveFolders, setOneDriveFolders] = useState<OneDriveFolder[]>([]);
  const [oneDriveUrl, setOneDriveUrl] = useState("");
  const [draggingFile, setDraggingFile] = useState(false);
  const [suggestionState, setSuggestionState] = useState<{ lineIndex: number; query: string; result: SuggestionResponse | null; loading: boolean } | null>(null);
  const suggestionRequest = useRef(0);
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionController = useRef<AbortController | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const totals = calculateQuote(quote);

  function clearSuggestionSearch() {
    suggestionRequest.current += 1;
    if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    suggestionController.current?.abort();
    setSuggestionState(null);
  }

  useEffect(() => {
    fetch("/api/quotes")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load saved quotes");
        const result = await response.json();
        setSavedQuotes(result.quotes);
        setHasMoreQuotes(result.hasMore);
      })
      .catch(() => setStorageStatus("Saved quotes are unavailable until database access is configured."));
  }, []);

  async function refreshSavedQuotes() {
    const response = await fetch("/api/quotes", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not refresh quote history");
    const result = await response.json();
    setSavedQuotes(result.quotes);
    setHasMoreQuotes(result.hasMore);
  }

  async function loadMoreQuoteHistory() {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/quotes?offset=${savedQuotes.length}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load more quotes");
      setSavedQuotes((current) => [...current, ...result.quotes]);
      setHasMoreQuotes(result.hasMore);
    } catch (error) {
      setStorageStatus(error instanceof Error ? error.message : "Could not load more quotes");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function previewImport(file: File) {
    setImportBusy(true);
    setImportPreview(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/quote/import", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not read the workbook");
      setImportPreview(result as ImportPreview);
    } catch (error) {
      setStorageStatus(error instanceof Error ? error.message : "Could not read the workbook");
    } finally {
      setImportBusy(false);
    }
  }

  async function commitImport() {
    if (!importPreview) return;
    setImportBusy(true);
    try {
      const response = await fetch("/api/quote/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importPreview),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not import quote history");
      setStorageStatus(`${result.imported} historical line${result.imported === 1 ? "" : "s"} added to fixture suggestions${result.duplicates ? `; ${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"} skipped` : ""}.`);
      setImportPreview(null);
      setShowImport(false);
    } catch (error) {
      setStorageStatus(error instanceof Error ? error.message : "Could not import quote history");
    } finally {
      setImportBusy(false);
    }
  }

  async function loadOneDriveFolder(parentId?: string, previousTrail: OneDriveFolder[] = []) {
    setFolderLoading(true);
    setOneDriveUrl("");
    try {
      const query = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
      const response = await fetch(`/api/quote/onedrive/folders${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not browse the shared OneDrive folder");
      setFolderTrail([...previousTrail, result.current]);
      setOneDriveFolders(result.folders);
    } catch (error) {
      setStorageStatus(error instanceof Error ? error.message : "Could not browse the shared OneDrive folder");
    } finally {
      setFolderLoading(false);
    }
  }

  async function saveToOneDrive() {
    const destination = folderTrail[folderTrail.length - 1];
    if (!destination) return;
    setOneDriveBusy(true);
    setOneDriveUrl("");
    try {
      const response = await fetch("/api/quote/onedrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote, folderId: destination.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the quote to OneDrive");
      setOneDriveUrl(result.webUrl || "");
      setStorageStatus(`Excel quote saved to ${destination.name}${result.name ? ` as ${result.name}` : ""}.`);
    } catch (error) {
      setStorageStatus(error instanceof Error ? error.message : "Could not save the quote to OneDrive");
    } finally {
      setOneDriveBusy(false);
    }
  }

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
      lines: current.lines.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const updated = { ...line, [key]: value };
        if (key === "productCost" || key === "proposedDescription") {
          updated.productCostSource = "";
          updated.productCostVendor = "";
          updated.productCostQuotedAt = "";
          updated.productCostPriorUseCount = 0;
          updated.suggestedProductId = null;
        }
        return updated;
      }),
    }));
  }

  function searchSuggestions(lineIndex: number, query: string) {
    const requestId = ++suggestionRequest.current;
    if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    suggestionController.current?.abort();
    const normalized = query.trim();
    if (normalized.length < 3) {
      setSuggestionState(null);
      return;
    }

    setSuggestionState({ lineIndex, query: normalized, result: null, loading: true });
    suggestionTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      suggestionController.current = controller;
      try {
        const response = await fetch(`/api/quote/suggestions?q=${encodeURIComponent(normalized)}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Quote suggestions are unavailable.");
        if (requestId === suggestionRequest.current) {
          setSuggestionState({ lineIndex, query: normalized, result, loading: false });
        }
      } catch (error) {
        if (controller.signal.aborted || requestId !== suggestionRequest.current) return;
        setSuggestionState({ lineIndex, query: normalized, result: null, loading: false });
        setStorageStatus(error instanceof Error ? error.message : "Quote suggestions are unavailable.");
      }
    }, 250);
  }

  function applyHistorySuggestion(lineIndex: number, suggestion: HistoricalSuggestion) {
    clearSuggestionSearch();
    setQuote((current) => ({
      ...current,
      lines: current.lines.map((line, index) => index === lineIndex ? {
        ...line,
        proposedDescription: suggestion.description,
        proposedWatts: suggestion.watts || line.proposedWatts,
        productCost: suggestion.latestCost && suggestion.latestCost > 0 ? suggestion.latestCost : line.productCost,
        productCostSource: suggestion.latestCost && suggestion.latestCost > 0 ? "prior_proposal" : "",
        productCostVendor: "",
        productCostQuotedAt: suggestion.latestUpdatedAt,
        productCostPriorUseCount: suggestion.priorUseCount,
        suggestedProductId: null,
      } : line),
    }));
    setStorageStatus("Applied a prior proposal suggestion. Review the fixture and its recorded cost before quoting.");
  }

  function applyWarehouseSuggestion(lineIndex: number, suggestion: WarehouseQuoteSuggestion) {
    clearSuggestionSearch();
    const hasPrice = suggestion.latest_currency === "USD" && suggestion.latest_price !== null && Number.isFinite(Number(suggestion.latest_price));
    const description = [suggestion.name, suggestion.model_number].filter(Boolean).join(" · ");
    setQuote((current) => ({
      ...current,
      lines: current.lines.map((line, index) => index === lineIndex ? {
        ...line,
        proposedDescription: description,
        productCost: hasPrice ? Number(suggestion.latest_price) : line.productCost,
        productCostSource: hasPrice ? "warehouse_quote" : "",
        productCostVendor: hasPrice ? suggestion.latest_vendor || "" : "",
        productCostQuotedAt: hasPrice ? suggestion.latest_quoted_at || "" : "",
        productCostPriorUseCount: 0,
        suggestedProductId: suggestion.id,
      } : line),
    }));
    setStorageStatus(hasPrice
      ? "Applied a recent USD warehouse quote as a starting cost. Confirm current vendor pricing before sending the proposal."
      : "Applied the warehouse fixture. No recent USD quote was found, so its cost was not changed.");
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

  async function saveQuote() {
    setSaving(true);
    setStorageStatus("");
    try {
      const endpoint = selectedQuoteId ? `/api/quotes/${selectedQuoteId}` : "/api/quotes";
      const response = await fetch(endpoint, {
        method: selectedQuoteId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote }),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || "Could not save quote");
      setSelectedQuoteId(String(saved.id));
      setStorageStatus("Draft saved");
      try {
        await refreshSavedQuotes();
      } catch {
        setStorageStatus("Draft saved, but quote history could not be refreshed.");
      }
    } catch (error) {
      setStorageStatus(error instanceof Error ? error.message : "Could not save quote");
    } finally {
      setSaving(false);
    }
  }

  async function loadQuote(id: string) {
    if (!id) return;
    clearSuggestionSearch();
    const response = await fetch(`/api/quotes/${id}`);
    const saved = await response.json();
    if (!response.ok) {
      setStorageStatus(saved.error || "Could not load quote");
      return;
    }
    setQuote((current) => ({
      ...current,
      ...saved.quote_data,
      lines: saved.quote_data.lines.map((line: Partial<QuoteLine>) => ({ ...emptyLine(), ...line })),
    }));
    setSelectedQuoteId(id);
    setStorageStatus("Draft loaded");
  }

  async function deleteQuote() {
    if (!selectedQuoteId || !window.confirm("Delete this saved draft?")) return;
    const response = await fetch(`/api/quotes/${selectedQuoteId}`, { method: "DELETE" });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      setStorageStatus(error.error || "Could not delete quote");
      return;
    }
    setSavedQuotes((current) => current.filter((saved) => String(saved.id) !== selectedQuoteId));
    setSelectedQuoteId("");
    setQuote(emptyQuote());
    clearSuggestionSearch();
    setStorageStatus("Draft deleted");
  }

  function download(format: "xlsx" | "pdf") {
    const link = document.createElement("a");
    link.href = `/api/quote/export?format=${format}&data=${encodeURIComponent(JSON.stringify(quote))}`;
    link.click();
  }

  return (
    <main className="min-h-screen bg-surface-container-low">
      <header className="border-b border-outline-variant/20 bg-surface-container-lowest">
        <div className="max-w-[1500px] mx-auto px-6 lg:px-10 min-h-20 py-3 flex items-center justify-between gap-6">
          <div>
            <p className="text-primary font-bold tracking-widest uppercase text-xs">Renew Workspace</p>
            <h1 className="font-headline text-2xl font-extrabold">Quote Builder</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => setShowHistory(true)}>Quote history</button>
            <button type="button" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => { setShowImport(true); setImportPreview(null); }}>Import Excel</button>
            <button type="button" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => { setShowOneDrive(true); setFolderTrail([]); setOneDriveFolders([]); void loadOneDriveFolder(); }}>Save to OneDrive</button>
            <button type="button" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => { if (!window.confirm("Start a new quote? Unsaved changes will be lost.")) return; setSelectedQuoteId(""); setQuote(emptyQuote()); clearSuggestionSearch(); setStorageStatus("New quote started."); }}>New quote</button>
            <button type="button" className="primary-gradient text-on-primary px-4 py-2 rounded-full text-sm font-bold" onClick={saveQuote} disabled={saving}>
              {saving ? "Saving..." : selectedQuoteId ? "Update draft" : "Save draft"}
            </button>
            {selectedQuoteId && <button type="button" className="text-error text-sm font-semibold" onClick={deleteQuote}>Delete</button>}
            <Link href="/employee" className="text-sm font-semibold text-on-surface-variant hover:text-primary">Back to portal</Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-6 lg:px-10 py-8">
        {storageStatus && <p className="mb-4 text-sm text-on-surface-variant" role="status">{storageStatus}</p>}
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
              <table className="min-w-[1570px] w-full text-sm">
                <thead className="bg-surface-container-low text-left text-xs uppercase tracking-wider text-on-surface-variant"><tr>{["ID", "Location", "Existing fixture", "Proposed fixture", "Qty", "Product cost", "Labor cost", "Line total", ""].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
                <tbody>{quote.lines.map((line, index) => { const row = totals.rows.find((item) => item.line === line); const suggestions = suggestionState?.lineIndex === index ? suggestionState : null; return <tr key={index} className="border-t border-outline-variant/10 align-top">
                  <td className="p-3"><input className="w-20 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.fixtureId} onChange={(event) => updateLine(index, "fixtureId", event.target.value)} placeholder="F01" /></td>
                  <td className="p-3"><input className="w-40 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.location} onChange={(event) => updateLine(index, "location", event.target.value)} placeholder="Location" /></td>
                  <td className="p-3"><input className="w-64 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.existingDescription} onChange={(event) => { updateLine(index, "existingDescription", event.target.value); searchSuggestions(index, event.target.value); }} placeholder="Describe existing fixture" /><p className="mt-1 w-64 text-xs text-on-surface-variant">Type at least 3 characters to see prior proposal and warehouse suggestions.</p>
                    {suggestions && <div className="mt-2 w-80 max-w-[80vw] rounded-xl border border-outline-variant/30 bg-white p-3 shadow-lg">
                      {suggestions.loading ? <p className="text-xs text-on-surface-variant">Searching proposal history and warehouse pricing…</p> : suggestions.result ? <>
                        {suggestions.result.history.length > 0 && <div><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Used in previous proposals</h3><div className="space-y-2">{suggestions.result.history.map((item, suggestionIndex) => <button key={`${item.description}-${suggestionIndex}`} type="button" className="block w-full rounded-lg border border-outline-variant/20 p-2 text-left hover:border-primary/50 hover:bg-primary/[0.04]" onClick={() => applyHistorySuggestion(index, item)}><span className="block text-sm font-semibold">{item.description}</span><span className="mt-1 block text-xs text-on-surface-variant">{item.priorUseCount} prior use{item.priorUseCount === 1 ? "" : "s"}{item.watts ? ` · ${item.watts}` : ""}{item.latestCost && item.latestCost > 0 ? ` · recorded cost ${money(item.latestCost)}` : ""}</span></button>)}</div></div>}
                        {suggestions.result.warehouse.length > 0 && <div className="mt-3"><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Warehouse catalog · possible matches</h3><div className="space-y-2">{suggestions.result.warehouse.map((item) => <button key={item.id} type="button" className="block w-full rounded-lg border border-outline-variant/20 p-2 text-left hover:border-primary/50 hover:bg-primary/[0.04]" onClick={() => applyWarehouseSuggestion(index, item)}><span className="block text-sm font-semibold">{item.name} · {item.model_number}</span><span className="mt-1 block text-xs text-on-surface-variant">{[item.brand, item.category, item.latest_price !== null && item.latest_currency === "USD" ? `${money(item.latest_price)} latest USD quote` : "No recent USD quote"].filter(Boolean).join(" · ")}</span><span className="mt-1 block text-xs text-on-surface-variant">{item.latest_price !== null && item.latest_currency === "USD" ? `${item.latest_vendor || "Unknown vendor"} · ${item.latest_quoted_at ? new Date(item.latest_quoted_at).toLocaleDateString() : "date unavailable"} · quoted at ${item.latest_quantity ?? "?"} units` : "Price must be confirmed separately."}</span></button>)}</div></div>}
                        {!suggestions.result.warehouseAvailable && <p className="mt-2 text-xs text-error">Warehouse pricing is currently unavailable; prior proposal matches are still shown.</p>}
                        {!suggestions.result.history.length && !suggestions.result.warehouse.length && <p className="text-xs text-on-surface-variant">No close matches found. Continue entering the fixture and pricing manually.</p>}
                      </> : <p className="text-xs text-on-surface-variant">Suggestions could not be loaded. You can continue entering the quote manually.</p>}
                      <button type="button" className="mt-2 text-xs font-semibold text-on-surface-variant underline" onClick={() => setSuggestionState(null)}>Close suggestions</button>
                    </div>}
                  </td>
                  <td className="p-3"><input className="w-64 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.proposedDescription} onChange={(event) => updateLine(index, "proposedDescription", event.target.value)} placeholder="Fixture description" /><textarea className="mt-2 w-64 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.installNotes} onChange={(event) => updateLine(index, "installNotes", event.target.value)} placeholder="Install notes" rows={2} /></td>
                  <td className="p-3"><input type="number" min="0" className="w-20 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.proposedQty || ""} onChange={(event) => updateLine(index, "proposedQty", numberValue(event.target.value))} /></td>
                  <td className="p-3"><input type="number" min="0" step="0.01" className="w-28 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.productCost || ""} onChange={(event) => updateLine(index, "productCost", numberValue(event.target.value))} />{line.productCostSource && <p className="mt-1 max-w-40 text-xs text-on-surface-variant">{line.productCostSource === "warehouse_quote" ? `Warehouse quote: ${line.productCostVendor || "vendor not recorded"}${line.productCostQuotedAt ? ` · ${new Date(line.productCostQuotedAt).toLocaleDateString()}` : ""}` : `Prior proposal cost · used ${line.productCostPriorUseCount} time(s)`}</p>}</td>
                  <td className="p-3"><input type="number" min="0" step="0.01" className="w-28 rounded-lg border border-outline-variant/30 bg-surface px-2 py-2" value={line.laborCost || ""} onChange={(event) => updateLine(index, "laborCost", numberValue(event.target.value))} /></td>
                  <td className="p-3 font-semibold">{row ? money(row.sellTotal) : money(0)}</td>
                  <td className="p-3"><button type="button" className="text-error text-xs font-bold" onClick={() => { clearSuggestionSearch(); updateQuote("lines", quote.lines.filter((_, lineIndex) => lineIndex !== index)); }}>Remove</button></td>
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

      {showHistory && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowHistory(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="quote-history-title" className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl">
          <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4">
            <div><h2 id="quote-history-title" className="font-headline text-xl font-bold">Quote history</h2><p className="text-sm text-on-surface-variant">Your saved quotes, newest first.</p></div>
            <button type="button" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => setShowHistory(false)}>Close</button>
          </div>
          <div className="max-h-[65vh] overflow-y-auto p-4">
            {savedQuotes.length ? <div className="space-y-2">{savedQuotes.map((saved) => <div key={saved.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/20 p-4">
              <div><h3 className="font-semibold">{saved.project_name || `Quote #${saved.id}`}</h3><p className="mt-1 text-xs text-on-surface-variant">{saved.status} · Created {new Date(saved.created_at).toLocaleDateString()} · Updated {new Date(saved.updated_at).toLocaleDateString()}</p></div>
              <button type="button" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => { void loadQuote(String(saved.id)); setShowHistory(false); }}>Open quote</button>
            </div>)}</div> : <p className="p-5 text-sm text-on-surface-variant">No saved quotes yet. Save a draft to start your history.</p>}
            {hasMoreQuotes && <button type="button" className="mt-4 w-full rounded-xl border border-outline-variant/40 px-4 py-3 text-sm font-semibold hover:bg-surface-container-low" disabled={historyLoading} onClick={loadMoreQuoteHistory}>{historyLoading ? "Loading…" : "Load more quotes"}</button>}
          </div>
        </section>
      </div>}

      {showImport && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowImport(false); setImportPreview(null); } }}>
        <section role="dialog" aria-modal="true" aria-labelledby="quote-import-title" className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl">
          <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4">
            <div><h2 id="quote-import-title" className="font-headline text-xl font-bold">Import past proposal Excel</h2><p className="text-sm text-on-surface-variant">Review detected fixture pairs before adding them to company suggestion history.</p></div>
            <button type="button" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => { setShowImport(false); setImportPreview(null); }}>Close</button>
          </div>
          <div className="max-h-[72vh] space-y-4 overflow-y-auto p-6">
            <input ref={importInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void previewImport(file); }} />
            <button type="button" className={`w-full rounded-2xl border-2 border-dashed p-8 text-center transition ${draggingFile ? "border-primary bg-primary/[0.06]" : "border-outline-variant/40 hover:border-primary/50"}`} onClick={() => importInput.current?.click()} onDragOver={(event) => { event.preventDefault(); setDraggingFile(true); }} onDragLeave={() => setDraggingFile(false)} onDrop={(event) => { event.preventDefault(); setDraggingFile(false); const file = event.dataTransfer.files.item(0); if (file) void previewImport(file); }}>
              <span className="block font-semibold">{importBusy ? "Reading or importing workbook…" : "Drop an Excel or CSV file here, or click to browse"}</span>
              <span className="mt-1 block text-xs text-on-surface-variant">Up to 4 MB. Sheets need columns for an existing fixture and its proposed or replacement fixture.</span>
            </button>
            {importPreview && <>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-sm">
                <p className="font-semibold">{importPreview.fileName} · sheet “{importPreview.sheetName}”</p>
                <p className="mt-1 text-on-surface-variant">{importPreview.records.length} fixture pairs detected{importPreview.skippedRows ? ` · ${importPreview.skippedRows} incomplete rows skipped` : ""}{importPreview.maxRecordsReached ? " · 3,000-row safety limit reached" : ""}. Prices and dates are used when available.</p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant"><tr><th className="px-3 py-2">Existing fixture</th><th className="px-3 py-2">Proposed fixture</th><th className="px-3 py-2">Watts</th><th className="px-3 py-2">Product cost</th><th className="px-3 py-2">Quote date</th></tr></thead>
                  <tbody>{importPreview.records.slice(0, 20).map((record) => <tr key={record.sourceRow} className="border-t border-outline-variant/15"><td className="px-3 py-2">{record.existingDescription}</td><td className="px-3 py-2">{record.proposedDescription}</td><td className="px-3 py-2">{record.proposedWatts || "—"}</td><td className="px-3 py-2">{record.productCost === null ? "—" : money(record.productCost)}</td><td className="px-3 py-2">{record.sourceDate ? new Date(record.sourceDate).toLocaleDateString() : "Not provided"}</td></tr>)}</tbody>
                </table>
                {importPreview.records.length > 20 && <p className="border-t border-outline-variant/15 p-3 text-xs text-on-surface-variant">Showing the first 20 rows. All {importPreview.records.length} detected rows will be imported.</p>}
              </div>
              <p className="text-xs text-on-surface-variant">Imported records are shared with Renew employees for fixture suggestions. A repeated upload of the same file will not duplicate its rows.</p>
              <div className="flex justify-end gap-3">
                <button type="button" className="rounded-full border border-outline-variant/40 px-5 py-2 text-sm font-semibold" onClick={() => setImportPreview(null)} disabled={importBusy}>Choose another file</button>
                <button type="button" className="primary-gradient rounded-full px-5 py-2 text-sm font-bold text-on-primary" onClick={commitImport} disabled={importBusy}>{importBusy ? "Importing…" : `Import ${importPreview.records.length} rows`}</button>
              </div>
            </>}
          </div>
        </section>
      </div>}

      {showOneDrive && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowOneDrive(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="onedrive-title" className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl">
          <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4">
            <div><h2 id="onedrive-title" className="font-headline text-xl font-bold">Save Excel quote to OneDrive</h2><p className="text-sm text-on-surface-variant">Browse the existing shared customer and quote folders.</p></div>
            <button type="button" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => setShowOneDrive(false)}>Close</button>
          </div>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto p-6">
            {folderTrail.length > 0 && <nav aria-label="OneDrive folder path" className="flex flex-wrap items-center gap-2 text-sm">
              {folderTrail.map((folder, index) => <span key={folder.id} className="flex items-center gap-2"><button type="button" className={`max-w-48 truncate ${index === folderTrail.length - 1 ? "font-bold text-primary" : "text-on-surface-variant hover:underline"}`} onClick={() => { if (index < folderTrail.length - 1) void loadOneDriveFolder(folder.id, folderTrail.slice(0, index)); }}>{folder.name}</button>{index < folderTrail.length - 1 && <span className="text-on-surface-variant">/</span>}</span>)}
            </nav>}
            {folderLoading ? <p className="rounded-xl bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">Loading OneDrive folders…</p> : folderTrail.length ? <div className="max-h-72 overflow-y-auto rounded-xl border border-outline-variant/20">
              {oneDriveFolders.map((folder) => <button key={folder.id} type="button" className="flex w-full items-center justify-between border-b border-outline-variant/10 px-4 py-3 text-left text-sm last:border-0 hover:bg-surface-container-low" onClick={() => void loadOneDriveFolder(folder.id, folderTrail)}><span className="flex items-center gap-2"><Icon name="folder" className="text-primary" />{folder.name}</span><span className="text-xs text-on-surface-variant">Open</span></button>)}
              {!oneDriveFolders.length && <p className="p-5 text-sm text-on-surface-variant">No subfolders here. You can save the workbook in this folder.</p>}
            </div> : <p className="rounded-xl bg-surface-container-low p-5 text-sm text-on-surface-variant">The shared quote folder is not available.</p>}
            {oneDriveUrl && <a href={oneDriveUrl} target="_blank" rel="noreferrer" className="block text-sm font-semibold text-primary underline">Open the saved workbook in OneDrive</a>}
            <div className="flex justify-end">
              <button type="button" className="primary-gradient rounded-full px-5 py-2 text-sm font-bold text-on-primary" onClick={saveToOneDrive} disabled={!folderTrail.length || folderLoading || oneDriveBusy}>{oneDriveBusy ? "Uploading…" : `Save in ${folderTrail[folderTrail.length - 1]?.name || "selected folder"}`}</button>
            </div>
          </div>
        </section>
      </div>}
    </main>
  );
}
