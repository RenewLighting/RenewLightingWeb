"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import Icon from "@/components/Icon";
import { calculateQuote, emptyLine, emptyQuote, money, type Quote, type QuoteLine } from "@/lib/quote";
import type { WarehouseQuoteSuggestion } from "@/lib/warehouse-quote-suggestions";
import type { WorkbookPhoto } from "@/lib/quote-workbook-import";

const maxQuoteWorkbookSize = 100 * 1024 * 1024;

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
  proposedQty: number | null;
  productCost: number | null;
  sourceDate: string | null;
};

type ImportPreview = {
  kind: "quote" | "suggestions";
  fileHash: string;
  fileName: string;
  sheetName: string;
  records: ImportedLine[];
  skippedRows: number;
  maxRecordsReached: boolean;
  quote?: Quote;
  photoCount?: number;
  skippedPhotos?: number;
};

type QuoteHistoryEntry = SavedQuote & {
  quote_data: Quote;
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

type AICandidate = {
  id: string;
  kind: "history" | "warehouse";
  productId: number | null;
  description: string;
  watts: string;
  quantity: number | null;
  unitCost: number | null;
  costSource: "" | "prior_proposal" | "warehouse_quote";
  vendor: string;
  quotedAt: string;
  priorUseCount: number;
  status: string;
};

type AIRecommendation = {
  lineIndex: number;
  candidate: AICandidate | null;
  confidence: "high" | "medium" | "low" | "none";
  reason: string;
};

const maxLinePhotos = 3;

function quotePhotoIds(quote: Quote) {
  return Array.from(new Set(quote.lines.flatMap((line) => line.photoIds)));
}

function QuoteHistoryDetails({
  saved,
  onBack,
  onEdit,
}: {
  saved: QuoteHistoryEntry;
  onBack: () => void;
  onEdit: () => void;
}) {
  const quote: Quote = {
    ...emptyQuote(),
    ...saved.quote_data,
    lines: (saved.quote_data.lines || []).map((line) => ({
      ...emptyLine(),
      ...line,
      photoIds: Array.isArray(line.photoIds) ? line.photoIds : [],
    })),
  };
  const totals = calculateQuote(quote);
  const formulaRows = [
    ["Product tax", `Unit product cost × quantity × ${(quote.taxRate * 100).toFixed(2)}%`],
    ["Product sell", "Taxed product cost ÷ (1 − product margin)"],
    ["Labor sell", "Unit labor cost × quantity ÷ (1 − labor margin)"],
    ["Line sell", quote.pricingModel === "estimate_audit"
      ? "Product sell + labor sell + allocated project costs"
      : "Product sell + labor sell"],
    ["Project costs", quote.pricingModel === "estimate_audit"
      ? "Shipping, travel, and miscellaneous are allocated evenly across positive product/labor sell components"
      : "Shipping + travel + miscellaneous + contingency"],
  ];

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <button type="button" className="text-sm font-semibold text-primary underline" onClick={onBack}>Back to quote history</button>
        <h3 className="mt-2 font-headline text-xl font-bold">{quote.projectName || `Quote #${saved.id}`}</h3>
        <p className="mt-1 text-xs text-on-surface-variant">{saved.status} · Created {new Date(saved.created_at).toLocaleDateString()} · Updated {new Date(saved.updated_at).toLocaleDateString()}</p>
        {quote.address && <p className="mt-1 text-sm text-on-surface-variant">{quote.address}</p>}
      </div>
      <button type="button" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={onEdit}>Open in quote builder</button>
    </div>

    <section className="rounded-xl border border-outline-variant/20 p-4">
      <h4 className="font-headline font-bold">Formula settings</h4>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p>Product tax: <strong>{(quote.taxRate * 100).toFixed(2)}%</strong></p>
        <p>Product margin: <strong>{(quote.productMarkup * 100).toFixed(2)}%</strong></p>
        <p>Labor margin: <strong>{(quote.laborMargin * 100).toFixed(2)}%</strong></p>
        <p>Contingency: <strong>{(quote.contingency * 100).toFixed(2)}%</strong></p>
      </div>
      <div className="mt-4 grid gap-2 text-xs text-on-surface-variant sm:grid-cols-2">
        {formulaRows.map(([label, formula]) => <p key={label}><strong className="text-on-surface">{label}:</strong> {formula}</p>)}
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Product cost (with tax)", totals.productCost],
        ["Labor cost", totals.laborCost],
        ["Direct cost", totals.directCost],
        ["Contingency", totals.contingency],
        ["Shipping", quote.shipping],
        ["Travel", quote.travel],
        ["Miscellaneous", quote.miscellaneous],
        ["Sell total", totals.sellTotal],
        ["Estimated profit", totals.profit],
      ].map(([label, amount]) => <div key={label} className="rounded-xl bg-surface-container-low p-3 text-sm">
        <span className="block text-xs text-on-surface-variant">{label}</span>
        <strong className="mt-1 block">{money(Number(amount))}</strong>
      </div>)}
      <div className="rounded-xl bg-surface-container-low p-3 text-sm">
        <span className="block text-xs text-on-surface-variant">Estimated margin</span>
        <strong className="mt-1 block">{(totals.margin * 100).toFixed(2)}%</strong>
      </div>
    </section>

    <section className="space-y-3">
      <h4 className="font-headline font-bold">Estimate lines ({quote.lines.length})</h4>
      {quote.lines.map((line, index) => {
        const row = totals.rows.find((item) => item.line.id === line.id);
        return <article key={line.id} className="rounded-xl border border-outline-variant/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Line {index + 1}{line.fixtureId ? ` · ${line.fixtureId}` : ""}{line.location ? ` · ${line.location}` : ""}</p>
              <h5 className="mt-1 font-semibold">{line.proposedDescription || "Proposed fixture not specified"}</h5>
              <p className="mt-1 text-sm text-on-surface-variant">Existing: {line.existingDescription || "Not specified"}{line.existingWatts ? ` · ${line.existingWatts}` : ""} · Qty {line.existingQty}</p>
              <p className="text-sm text-on-surface-variant">Proposed: {line.proposedWatts || "Watts not specified"} · Qty {line.proposedQty}{line.height ? ` · Height ${line.height}` : ""}</p>
              {line.installNotes && <p className="mt-2 whitespace-pre-wrap text-sm">{line.installNotes}</p>}
            </div>
            <p className="text-right text-sm"><span className="block text-xs text-on-surface-variant">Line sell</span><strong className="text-lg text-primary">{money(row?.sellTotal ?? 0)}</strong></p>
          </div>
          <div className="mt-3 grid gap-2 border-t border-outline-variant/15 pt-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <p>Product unit: <strong>{money(line.productCost)}</strong></p>
            <p>Product subtotal: <strong>{money(row?.productSubtotal ?? 0)}</strong></p>
            <p>Product tax: <strong>{money(row?.productTax ?? 0)}</strong></p>
            <p>Product with tax: <strong>{money(row?.productTotal ?? 0)}</strong></p>
            <p>Labor unit: <strong>{money(line.laborCost)}</strong></p>
            <p>Labor total: <strong>{money(row?.laborTotal ?? 0)}</strong></p>
            <p>Product sell: <strong>{money(row?.productSell ?? 0)}</strong></p>
            <p>Labor sell: <strong>{money(row?.laborSell ?? 0)}</strong></p>
            {quote.pricingModel === "estimate_audit" && <p>Allocated project costs: <strong>{money(row?.projectCostAllocation ?? 0)}</strong></p>}
            <p>Tax formula: <strong>{((row?.taxRate ?? quote.taxRate) * 100).toFixed(2)}%</strong></p>
            <p>Product margin formula: <strong>{((row?.productMarkup ?? quote.productMarkup) * 100).toFixed(2)}%</strong></p>
            <p>Labor margin formula: <strong>{((row?.laborMargin ?? quote.laborMargin) * 100).toFixed(2)}%</strong></p>
          </div>
          {line.photoIds.length > 0 && <div className="mt-3 flex flex-wrap gap-3">
            {line.photoIds.map((photoId, photoIndex) => <a key={photoId} href={`/api/quote/photos/${photoId}`} target="_blank" rel="noreferrer" className="block">
              <Image
                src={`/api/quote/photos/${photoId}`}
                alt={`Quote line ${index + 1} photo ${photoIndex + 1}`}
                width={240}
                height={180}
                unoptimized
                className="h-36 w-48 rounded-lg border border-outline-variant/20 object-cover"
              />
            </a>)}
          </div>}
        </article>;
      })}
    </section>
  </div>;
}

async function compressQuotePhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
  if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} is larger than the 15 MB upload limit.`);

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the photo.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 2 * 1024 * 1024) return blob;
    }
    throw new Error(`${file.name} could not be compressed below 2 MB. Choose a smaller photo.`);
  } finally {
    bitmap.close();
  }
}

async function hashWorkbook(bytes: ArrayBuffer) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function deleteImportedPhotoUploads(photoIds: string[]) {
  const results = await Promise.allSettled(photoIds.map((id) =>
    fetch(`/api/quote/photos/${id}`, { method: "DELETE" }),
  ));
  return results.every((result) => result.status === "fulfilled"
    && (result.value.ok || result.value.status === 404));
}

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
  const [historyDetails, setHistoryDetails] = useState<QuoteHistoryEntry | null>(null);
  const [historyDetailsLoading, setHistoryDetailsLoading] = useState(false);
  const [showOneDrive, setShowOneDrive] = useState(false);
  const [oneDriveBusy, setOneDriveBusy] = useState(false);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderTrail, setFolderTrail] = useState<OneDriveFolder[]>([]);
  const [oneDriveFolders, setOneDriveFolders] = useState<OneDriveFolder[]>([]);
  const [oneDriveUrl, setOneDriveUrl] = useState("");
  const [draggingFile, setDraggingFile] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [uploadingLineId, setUploadingLineId] = useState<string | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [suggestionState, setSuggestionState] = useState<{ lineIndex: number; query: string; result: SuggestionResponse | null; loading: boolean } | null>(null);
  const persistedPhotoIds = useRef<string[]>([]);
  const uploadedPhotoIds = useRef<string[]>([]);
  const suggestionRequest = useRef(0);
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionController = useRef<AbortController | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const importFile = useRef<File | null>(null);
  const importPhotos = useRef<WorkbookPhoto[]>([]);
  const totals = calculateQuote(quote);
  const importQuoteTotals = importPreview?.quote ? calculateQuote(importPreview.quote) : null;

  function clearSuggestionSearch() {
    suggestionRequest.current += 1;
    if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    suggestionController.current?.abort();
    setSuggestionState(null);
  }

  function resetImportPreview() {
    setImportPreview(null);
    importFile.current = null;
    importPhotos.current = [];
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

  async function viewQuoteHistoryDetails(id: string) {
    setHistoryDetailsLoading(true);
    setHistoryDetails(null);
    try {
      const response = await fetch(`/api/quotes/${id}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not open quote details");
      setHistoryDetails(result as QuoteHistoryEntry);
    } catch (error) {
      setStorageStatus(error instanceof Error ? error.message : "Could not open quote details");
    } finally {
      setHistoryDetailsLoading(false);
    }
  }

  async function previewImport(file: File) {
    setImportBusy(true);
    setImportPreview(null);
    importPhotos.current = [];
    importFile.current = file;
    try {
      if (/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
        if (file.size > maxQuoteWorkbookSize) {
          throw new Error("Excel quote workbooks must be 100 MB or smaller.");
        }
        const arrayBuffer = await file.arrayBuffer();
        const workbookBytes = new Uint8Array(arrayBuffer);
        const { parseQuoteWorkbook } = await import("@/lib/quote-workbook-import");
        const quoteImport = parseQuoteWorkbook(workbookBytes, file.name);
        if (quoteImport.recognized) {
          if (!quoteImport.quote) {
            throw new Error("This workbook contains only a blank quote template; no quote history was created.");
          }
          const fileHash = await hashWorkbook(arrayBuffer);
          importPhotos.current = quoteImport.photos;
          setImportPreview({
            kind: "quote",
            fileHash,
            fileName: file.name.slice(0, 200),
            sheetName: quoteImport.sheetName,
            quote: quoteImport.quote,
            records: [],
            skippedRows: 0,
            maxRecordsReached: false,
            photoCount: quoteImport.photos.length,
            skippedPhotos: quoteImport.skippedPhotos,
          });
          return;
        }
        if (file.size > 4 * 1024 * 1024) {
          throw new Error("This workbook is not a recognized quote template and is too large for fixture-suggestion import. Use a completed Renew quote template.");
        }
      }

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
    const uploadedPhotoIds: string[] = [];
    try {
      let requestBody: BodyInit;
      const headers: Record<string, string> = {};
      if (importPreview.kind === "quote") {
        if (!importFile.current || !importPreview.quote) {
          throw new Error("Choose the workbook again before importing this quote.");
        }
        const quote = structuredClone(importPreview.quote);
        for (const [index, photo] of importPhotos.current.entries()) {
          const line = quote.lines[photo.lineIndex];
          if (!line) throw new Error(`Embedded photo ${index + 1} is not associated with a quote line.`);
          setStorageStatus(`Preparing embedded photo ${index + 1} of ${importPhotos.current.length}…`);
          const imageBuffer = new Uint8Array(photo.imageData.byteLength);
          imageBuffer.set(photo.imageData);
          const imageFile = new File([imageBuffer.buffer], `quote-photo-${index + 1}`, { type: photo.contentType });
          const compressedPhoto = await compressQuotePhoto(imageFile);
          const photoForm = new FormData();
          photoForm.set("photo", compressedPhoto, `quote-photo-${index + 1}.jpg`);
          const photoResponse = await fetch("/api/quote/photos", { method: "POST", body: photoForm });
          const photoResult = await photoResponse.json().catch(() => null);
          if (!photoResponse.ok || typeof photoResult?.id !== "string") {
            throw new Error(photoResult?.error || `Could not save embedded photo ${index + 1}.`);
          }
          uploadedPhotoIds.push(photoResult.id);
          line.photoIds.push(photoResult.id);
        }
        headers["Content-Type"] = "application/json";
        requestBody = JSON.stringify({
          kind: "quote",
          fileHash: importPreview.fileHash,
          fileName: importPreview.fileName,
          quote,
          skippedPhotos: importPreview.skippedPhotos || 0,
        });
      } else {
        headers["Content-Type"] = "application/json";
        requestBody = JSON.stringify(importPreview);
      }
      const response = await fetch("/api/quote/import", { method: "PUT", headers, body: requestBody });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not import quote history");
      if (importPreview.kind === "quote") {
        if (result.imported) {
          setStorageStatus(`Imported quote saved to Quote history with ${result.lines} line${result.lines === 1 ? "" : "s"} and ${result.photos} photo${result.photos === 1 ? "" : "s"}${result.skippedPhotos ? `; ${result.skippedPhotos} unsupported or oversized photo${result.skippedPhotos === 1 ? "" : "s"} skipped` : ""}.`);
          try {
            await refreshSavedQuotes();
          } catch {
            setStorageStatus("Quote imported successfully, but Quote history could not be refreshed. Close and reopen the history dialog.");
          }
        } else {
          if (uploadedPhotoIds.length && !(await deleteImportedPhotoUploads(uploadedPhotoIds))) {
            throw new Error("This workbook was already imported, but temporary photos could not be cleaned up.");
          }
          setStorageStatus("This workbook was already imported. Its quote is in Quote history.");
        }
      } else {
        setStorageStatus(`${result.imported} historical line${result.imported === 1 ? "" : "s"} added to fixture suggestions${result.duplicates ? `; ${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"} skipped` : ""}. Enter an existing fixture description and choose a prior proposal match to use it. Imported lines do not appear in Quote history.`);
      }
      resetImportPreview();
      setShowImport(false);
    } catch (error) {
      let message = error instanceof Error ? error.message : "Could not import quote history";
      if (uploadedPhotoIds.length && !(await deleteImportedPhotoUploads(uploadedPhotoIds))) {
          message += " Some temporary photos could not be cleaned up.";
      }
      setStorageStatus(message);
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

  async function requestAISuggestions() {
    const lines = quote.lines.map((line, lineIndex) => ({
      lineIndex,
      existingDescription: line.existingDescription,
      existingWatts: line.existingWatts,
      existingQty: line.existingQty,
      proposedDescription: line.proposedDescription,
    })).filter((line) => line.existingDescription.trim().length >= 3);
    if (!lines.length) {
      setStorageStatus("Enter an existing fixture description (at least 3 characters) before requesting AI suggestions.");
      return;
    }
    setAiBusy(true);
    setAiRecommendations([]);
    setStorageStatus("");
    try {
      const response = await fetch("/api/quote/ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "AI suggestions are unavailable.");
      setAiRecommendations(result.recommendations as AIRecommendation[]);
      setStorageStatus("AI compared the existing fixtures against proposal history and Warehouse matches. Review each recommendation before applying it.");
    } catch (error) {
      setStorageStatus(error instanceof Error ? error.message : "AI suggestions are unavailable.");
    } finally {
      setAiBusy(false);
    }
  }

  function applyAIRecommendation(recommendation: AIRecommendation) {
    const candidate = recommendation.candidate;
    if (!candidate || recommendation.confidence === "none") return;
    setQuote((current) => ({
      ...current,
      lines: current.lines.map((line, index) => {
        if (index !== recommendation.lineIndex) return line;
        const hasPrice = candidate.unitCost !== null && candidate.unitCost > 0 && candidate.costSource !== "";
        const quantity = line.proposedQty > 0 ? line.proposedQty : line.existingQty > 0 ? line.existingQty : 0;
        return {
          ...line,
          proposedDescription: line.proposedDescription || candidate.description,
          proposedWatts: line.proposedWatts || candidate.watts,
          proposedQty: quantity,
          productCost: line.productCost > 0 ? line.productCost : hasPrice ? candidate.unitCost ?? line.productCost : line.productCost,
          productCostSource: line.productCost > 0 ? line.productCostSource : hasPrice ? candidate.costSource : line.productCostSource,
          productCostVendor: line.productCost > 0 ? line.productCostVendor : hasPrice ? candidate.vendor : line.productCostVendor,
          productCostQuotedAt: line.productCost > 0 ? line.productCostQuotedAt : hasPrice ? candidate.quotedAt : line.productCostQuotedAt,
          productCostPriorUseCount: line.productCost > 0 ? line.productCostPriorUseCount : candidate.kind === "history" ? candidate.priorUseCount : 0,
          suggestedProductId: candidate.productId ?? line.suggestedProductId,
        };
      }),
    }));
    setStorageStatus("Applied the AI-selected evidence-backed candidate to empty fields. Review product fit, quantity, and current cost.");
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
    setAiRecommendations([]);
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

  async function uploadLinePhotos(lineId: string, files: FileList | null) {
    if (!files?.length) return;
    const line = quote.lines.find((item) => item.id === lineId);
    if (!line) return;
    const remaining = maxLinePhotos - line.photoIds.length;
    if (remaining <= 0) {
      setStorageStatus(`Each estimate line can have up to ${maxLinePhotos} photos.`);
      return;
    }
    const selectedFiles = Array.from(files);
    if (selectedFiles.length > remaining) {
      setStorageStatus(`Only ${remaining} more photo${remaining === 1 ? "" : "s"} can be added to this line.`);
    } else {
      setStorageStatus("");
    }

    setUploadingLineId(lineId);
    const uploadedIds: string[] = [];
    try {
      for (const file of selectedFiles.slice(0, remaining)) {
        const photo = await compressQuotePhoto(file);
        const form = new FormData();
        form.set("photo", photo, "quote-line-photo.jpg");
        const response = await fetch("/api/quote/photos", { method: "POST", body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Could not upload ${file.name}.`);
        if (typeof result.id !== "string") throw new Error(`The upload for ${file.name} returned an invalid photo ID.`);
        uploadedIds.push(result.id);
        uploadedPhotoIds.current = [...uploadedPhotoIds.current, result.id];
      }
      setQuote((current) => ({
        ...current,
        lines: current.lines.map((item) => item.id === lineId
          ? { ...item, photoIds: [...item.photoIds, ...uploadedIds] }
          : item),
      }));
      if (uploadedIds.length) setStorageStatus(`${uploadedIds.length} photo${uploadedIds.length === 1 ? "" : "s"} added to the estimate line.`);
    } catch (error) {
      if (uploadedIds.length) {
        setQuote((current) => ({
          ...current,
          lines: current.lines.map((item) => item.id === lineId
            ? { ...item, photoIds: [...item.photoIds, ...uploadedIds] }
            : item),
        }));
      }
      setStorageStatus(error instanceof Error ? error.message : "Could not upload the line photo.");
    } finally {
      setUploadingLineId(null);
    }
  }

  function removeLinePhoto(lineId: string, photoId: string) {
    setQuote((current) => ({
      ...current,
      lines: current.lines.map((item) => item.id === lineId
        ? { ...item, photoIds: item.photoIds.filter((id) => id !== photoId) }
        : item),
    }));
    setStorageStatus("Photo removed from the estimate line. Save the draft to keep this change.");
  }

  function removeEstimateLine(line: QuoteLine) {
    clearSuggestionSearch();
    updateQuote("lines", quote.lines.filter((item) => item.id !== line.id));
    setStorageStatus("Estimate line removed. Save the draft to keep this change.");
  }

  async function deleteStoredPhotos(photoIds: string[]) {
    const results = await Promise.all(photoIds.map((id) => fetch(`/api/quote/photos/${id}`, { method: "DELETE" })));
    return results.every((response) => response.ok);
  }

  async function tryDeleteStoredPhotos(photoIds: string[]) {
    try {
      return photoIds.length === 0 || await deleteStoredPhotos(Array.from(new Set(photoIds)));
    } catch {
      return false;
    }
  }

  async function startNewQuote() {
    if (!window.confirm("Start a new quote? Unsaved changes will be lost.")) return;
    const unsavedPhotoIds = uploadedPhotoIds.current.filter((id) => !persistedPhotoIds.current.includes(id));
    const photosDeleted = await tryDeleteStoredPhotos(unsavedPhotoIds);
    uploadedPhotoIds.current = photosDeleted ? [] : unsavedPhotoIds;
    setSelectedQuoteId("");
    setQuote(emptyQuote());
    persistedPhotoIds.current = [];
    clearSuggestionSearch();
    setStorageStatus(photosDeleted
      ? "New quote started."
      : "New quote started, but one or more unsaved photos could not be deleted.");
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
    setAiRecommendations([]);
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
    setAiRecommendations([]);
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
      const currentPhotoIds = quotePhotoIds(quote);
      const removedPhotoIds = Array.from(new Set([
        ...persistedPhotoIds.current.filter((id) => !currentPhotoIds.includes(id)),
        ...uploadedPhotoIds.current.filter((id) => !currentPhotoIds.includes(id)),
      ]));
      persistedPhotoIds.current = currentPhotoIds;
      setSelectedQuoteId(String(saved.id));
      const photosDeleted = await tryDeleteStoredPhotos(removedPhotoIds);
      uploadedPhotoIds.current = photosDeleted ? [] : removedPhotoIds;
      setStorageStatus(photosDeleted ? "Draft saved" : "Draft saved, but one or more removed photos could not be deleted.");
      try {
        await refreshSavedQuotes();
      } catch {
        setStorageStatus(photosDeleted
          ? "Draft saved, but quote history could not be refreshed."
          : "Draft saved, but one or more removed photos could not be deleted and quote history could not be refreshed.");
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
    const lines = saved.quote_data.lines.map((line: Partial<QuoteLine>) => ({ ...emptyLine(), ...line }));
    const unsavedPhotoIds = uploadedPhotoIds.current.filter((photoId) => !persistedPhotoIds.current.includes(photoId));
    const unsavedPhotosDeleted = await tryDeleteStoredPhotos(unsavedPhotoIds);
    uploadedPhotoIds.current = unsavedPhotosDeleted ? [] : unsavedPhotoIds;
    persistedPhotoIds.current = quotePhotoIds({ ...saved.quote_data, lines });
    setQuote((current) => ({
      ...current,
      ...saved.quote_data,
      lines,
    }));
    setSelectedQuoteId(id);
    setStorageStatus(unsavedPhotosDeleted
      ? "Draft loaded"
      : "Draft loaded, but one or more unsaved photos could not be deleted.");
  }

  async function deleteQuote() {
    if (!selectedQuoteId || !window.confirm("Delete this saved draft?")) return;
    const response = await fetch(`/api/quotes/${selectedQuoteId}`, { method: "DELETE" });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      setStorageStatus(error.error || "Could not delete quote");
      return;
    }
    const photosToDelete = [
      ...persistedPhotoIds.current,
      ...quotePhotoIds(quote),
      ...uploadedPhotoIds.current,
    ];
    const photosDeleted = await tryDeleteStoredPhotos(photosToDelete);
    uploadedPhotoIds.current = photosDeleted ? [] : Array.from(new Set(photosToDelete));
    setSavedQuotes((current) => current.filter((saved) => String(saved.id) !== selectedQuoteId));
    setSelectedQuoteId("");
    setQuote(emptyQuote());
    persistedPhotoIds.current = [];
    clearSuggestionSearch();
    setStorageStatus(photosDeleted
      ? "Draft deleted"
      : "Draft deleted, but one or more associated photos could not be deleted.");
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
            <button type="button" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-low disabled:opacity-50" onClick={() => { setHistoryDetails(null); setShowHistory(true); }} disabled={uploadingLineId !== null}>Quote history</button>
            <button type="button" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => { setShowImport(true); resetImportPreview(); }}>Import Excel</button>
            <button type="button" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => { setShowOneDrive(true); setFolderTrail([]); setOneDriveFolders([]); void loadOneDriveFolder(); }}>Save to OneDrive</button>
            <button type="button" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-low disabled:opacity-50" onClick={() => { void startNewQuote(); }} disabled={uploadingLineId !== null}>New quote</button>
            <button type="button" className="primary-gradient text-on-primary px-4 py-2 rounded-full text-sm font-bold" onClick={saveQuote} disabled={saving || uploadingLineId !== null}>
              {uploadingLineId !== null ? "Uploading photo…" : saving ? "Saving..." : selectedQuoteId ? "Update draft" : "Save draft"}
            </button>
            {selectedQuoteId && <button type="button" className="text-error text-sm font-semibold disabled:opacity-50" onClick={deleteQuote} disabled={uploadingLineId !== null}>Delete</button>}
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
          <section className="min-w-0 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/15 px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <h2 className="font-headline text-xl font-bold">Estimate lines</h2>
                <p className="mt-1 text-sm text-on-surface-variant">Each fixture stays together in a full-width card. Edit details and review totals without scrolling sideways.</p>
                <p className="mt-1 text-xs text-on-surface-variant">AI uses fixture details and matching history—not project addresses—to rank candidates.</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button type="button" className="rounded-full border border-primary/40 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/[0.05] disabled:opacity-60" onClick={requestAISuggestions} disabled={aiBusy}>{aiBusy ? "AI reviewing…" : "AI suggestions"}</button>
                <button type="button" className="primary-gradient rounded-full px-4 py-2 text-sm font-bold text-on-primary" onClick={() => updateQuote("lines", [...quote.lines, emptyLine()])}>Add line</button>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              {quote.lines.map((line, index) => {
                const row = totals.rows.find((item) => item.line === line);
                const suggestions = suggestionState?.lineIndex === index ? suggestionState : null;
                const lineAI = aiRecommendations.filter((item) => item.lineIndex === index);
                const fieldClass = "mt-1.5 w-full min-w-0 rounded-xl border border-outline-variant/30 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
                const labelClass = "block min-w-0 text-xs font-semibold text-on-surface-variant";
                return <article key={line.id} className="min-w-0 overflow-hidden rounded-2xl border border-outline-variant/25 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/15 bg-surface-container-low/60 px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <span className="rounded-full bg-primary/[0.08] px-3 py-1 text-xs font-bold text-primary">LINE {String(index + 1).padStart(2, "0")}</span>
                      <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                        Fixture ID
                        <input className="w-24 rounded-lg border border-outline-variant/30 bg-white px-2.5 py-1.5 text-sm font-medium text-on-surface outline-none focus:border-primary" value={line.fixtureId} onChange={(event) => updateLine(index, "fixtureId", event.target.value)} placeholder="F01" />
                      </label>
                      <label className="flex min-w-40 flex-1 items-center gap-2 text-xs font-semibold text-on-surface-variant sm:flex-none">
                        Location
                        <input className="w-full rounded-lg border border-outline-variant/30 bg-white px-2.5 py-1.5 text-sm font-medium text-on-surface outline-none focus:border-primary sm:w-48" value={line.location} onChange={(event) => updateLine(index, "location", event.target.value)} placeholder="Building / area" />
                      </label>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right"><span className="block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Line sell total</span><strong className="font-headline text-lg text-primary">{row ? money(row.sellTotal) : money(0)}</strong></div>
                      <button type="button" aria-label={`Remove estimate line ${index + 1}`} className="rounded-full px-3 py-2 text-xs font-bold text-error hover:bg-error/5 disabled:opacity-50" disabled={uploadingLineId === line.id} onClick={() => { void removeEstimateLine(line); }}>Remove</button>
                    </div>
                  </div>

                  <section className="border-b border-outline-variant/15 px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-on-surface">Line photos <span className="font-normal text-on-surface-variant">({line.photoIds.length}/{maxLinePhotos})</span></h3>
                        <p className="mt-0.5 text-xs text-on-surface-variant">Add site or fixture photos for this estimate line. Photos are saved with the draft.</p>
                      </div>
                      <label className={`inline-flex cursor-pointer items-center rounded-full border border-outline-variant/40 px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-primary/[0.05] ${uploadingLineId !== null || line.photoIds.length >= maxLinePhotos ? "pointer-events-none opacity-50" : ""}`}>
                        {uploadingLineId === line.id ? "Preparing photos…" : "Upload photos"}
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={uploadingLineId !== null || line.photoIds.length >= maxLinePhotos}
                          onChange={(event) => {
                            void uploadLinePhotos(line.id, event.currentTarget.files);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {line.photoIds.length > 0 && <div className="mt-3 flex flex-wrap gap-3">
                      {line.photoIds.map((photoId, photoIndex) => <figure key={photoId} className="relative">
                        <Image
                          src={`/api/quote/photos/${photoId}`}
                          alt={`Estimate line ${index + 1} photo ${photoIndex + 1}`}
                          width={160}
                          height={120}
                          unoptimized
                          className="h-24 w-32 rounded-lg border border-outline-variant/20 object-cover"
                        />
                        <button
                          type="button"
                          className="mt-1 text-xs font-semibold text-error underline disabled:opacity-50"
                          disabled={uploadingLineId !== null}
                          onClick={() => { void removeLinePhoto(line.id, photoId); }}
                        >
                          Remove photo
                        </button>
                      </figure>)}
                    </div>}
                  </section>

                  <div className="grid min-w-0 grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-2">
                    <section className="min-w-0 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div><h3 className="text-sm font-bold text-on-surface">Existing fixture</h3><p className="mt-0.5 text-xs text-on-surface-variant">What is being replaced?</p></div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Current</span>
                      </div>
                      <label className={labelClass}>Fixture description
                        <input className={fieldClass} value={line.existingDescription} onChange={(event) => { updateLine(index, "existingDescription", event.target.value); searchSuggestions(index, event.target.value); }} placeholder="Describe the current light" />
                      </label>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <label className={labelClass}>Existing watts<input className={fieldClass} value={line.existingWatts} onChange={(event) => updateLine(index, "existingWatts", event.target.value)} placeholder="e.g. 150W" /></label>
                        <label className={labelClass}>Existing quantity<input type="number" min="0" className={fieldClass} value={line.existingQty || ""} onChange={(event) => updateLine(index, "existingQty", numberValue(event.target.value))} placeholder="0" /></label>
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-on-surface-variant">Enter at least 3 characters, then select a prior proposal or Warehouse match to apply it.</p>
                      {suggestions && <div className="mt-3 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-outline-variant/20 bg-white p-3">
                        {suggestions.loading ? <p className="text-xs text-on-surface-variant">Searching proposal history and Warehouse pricing…</p> : suggestions.result ? <>
                          {suggestions.result.history.length > 0 && <div><h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Prior proposals</h4><div className="space-y-2">{suggestions.result.history.map((item, suggestionIndex) => <button key={`${item.description}-${suggestionIndex}`} type="button" className="block w-full rounded-lg border border-outline-variant/20 p-2.5 text-left transition hover:border-primary/50 hover:bg-primary/[0.04]" onClick={() => applyHistorySuggestion(index, item)}><span className="block break-words text-sm font-semibold">{item.description}</span><span className="mt-1 block text-xs text-on-surface-variant">{item.priorUseCount} prior use{item.priorUseCount === 1 ? "" : "s"}{item.watts ? ` · ${item.watts}` : ""}{item.latestCost && item.latestCost > 0 ? ` · ${money(item.latestCost)} recorded cost` : ""}</span></button>)}</div></div>}
                          {suggestions.result.warehouse.length > 0 && <div><h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Warehouse catalog matches</h4><div className="space-y-2">{suggestions.result.warehouse.map((item) => <button key={item.id} type="button" className="block w-full rounded-lg border border-outline-variant/20 p-2.5 text-left transition hover:border-primary/50 hover:bg-primary/[0.04]" onClick={() => applyWarehouseSuggestion(index, item)}><span className="block break-words text-sm font-semibold">{item.name} · {item.model_number}</span><span className="mt-1 block text-xs text-on-surface-variant">{[item.brand, item.category, item.latest_price !== null && item.latest_currency === "USD" ? `${money(item.latest_price)} latest USD quote` : "No recent USD quote"].filter(Boolean).join(" · ")}</span><span className="mt-1 block text-xs text-on-surface-variant">{item.latest_price !== null && item.latest_currency === "USD" ? `${item.latest_vendor || "Unknown vendor"} · ${item.latest_quoted_at ? new Date(item.latest_quoted_at).toLocaleDateString() : "date unavailable"} · quoted for ${item.latest_quantity ?? "?"} units` : "Price must be confirmed separately."}</span></button>)}</div></div>}
                          {!suggestions.result.warehouseAvailable && <p className="text-xs text-error">Warehouse pricing is currently unavailable; prior proposal matches are still shown.</p>}
                          {!suggestions.result.history.length && !suggestions.result.warehouse.length && <p className="text-xs text-on-surface-variant">No close matches found. You can continue entering this line manually.</p>}
                        </> : <p className="text-xs text-on-surface-variant">Suggestions could not be loaded. Continue entering the quote manually.</p>}
                        <button type="button" className="text-xs font-semibold text-on-surface-variant underline" onClick={() => setSuggestionState(null)}>Close suggestions</button>
                      </div>}
                    </section>

                    <section className="min-w-0 rounded-xl border border-primary/15 bg-primary/[0.025] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div><h3 className="text-sm font-bold text-on-surface">Proposed replacement</h3><p className="mt-0.5 text-xs text-on-surface-variant">What will be installed?</p></div>
                        <span className="rounded-full bg-primary/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">Proposed</span>
                      </div>
                      <label className={labelClass}>Replacement fixture
                        <input className={fieldClass} value={line.proposedDescription} onChange={(event) => updateLine(index, "proposedDescription", event.target.value)} placeholder="Fixture / model description" />
                      </label>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <label className={labelClass}>Proposed watts<input className={fieldClass} value={line.proposedWatts} onChange={(event) => updateLine(index, "proposedWatts", event.target.value)} placeholder="e.g. 40W" /></label>
                        <label className={labelClass}>Install quantity<input type="number" min="0" className={fieldClass} value={line.proposedQty || ""} onChange={(event) => updateLine(index, "proposedQty", numberValue(event.target.value))} placeholder="0" /></label>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <label className={labelClass}>Product unit cost<input type="number" min="0" step="0.01" className={fieldClass} value={line.productCost || ""} onChange={(event) => updateLine(index, "productCost", numberValue(event.target.value))} placeholder="$0.00" /></label>
                        <label className={labelClass}>Labor unit cost<input type="number" min="0" step="0.01" className={fieldClass} value={line.laborCost || ""} onChange={(event) => updateLine(index, "laborCost", numberValue(event.target.value))} placeholder="$0.00" /></label>
                      </div>
                      {line.productCostSource && <p className="mt-2 text-[11px] text-on-surface-variant">{line.productCostSource === "warehouse_quote" ? `Warehouse quote: ${line.productCostVendor || "vendor not recorded"}${line.productCostQuotedAt ? ` · ${new Date(line.productCostQuotedAt).toLocaleDateString()}` : ""}` : `Prior proposal cost · used ${line.productCostPriorUseCount} time(s)`}</p>}
                      <label className={`${labelClass} mt-3`}>Installation notes
                        <textarea className={`${fieldClass} resize-y`} value={line.installNotes} onChange={(event) => updateLine(index, "installNotes", event.target.value)} placeholder="Optional notes for installation" rows={2} />
                      </label>
                      {lineAI.map((item) => <div key={`${item.lineIndex}-${item.confidence}`} className="mt-3 rounded-xl border border-primary/20 bg-white p-3">
                        {item.candidate ? <>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">AI match · {item.confidence} confidence</p>
                          <p className="mt-1 break-words text-sm font-semibold">{item.candidate.description}</p>
                          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{item.reason}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">{item.candidate.kind === "history" ? `Proposal history · ${item.candidate.priorUseCount} use${item.candidate.priorUseCount === 1 ? "" : "s"}${item.candidate.status ? ` · ${item.candidate.status}` : ""}` : "Warehouse catalog"}{item.candidate.watts ? ` · ${item.candidate.watts}` : ""}{item.candidate.quantity ? ` · prior quantity ${item.candidate.quantity}` : ""}{item.candidate.unitCost !== null ? ` · ${money(item.candidate.unitCost)} / unit` : " · no verified unit cost"}</p>
                          {item.candidate.vendor && <p className="mt-1 text-xs text-on-surface-variant">{item.candidate.vendor}{item.candidate.quotedAt ? ` · ${new Date(item.candidate.quotedAt).toLocaleDateString()}` : ""}</p>}
                          <button type="button" className="mt-2 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-on-primary" onClick={() => applyAIRecommendation(item)}>Apply to empty fields</button>
                        </> : <><p className="text-xs font-bold text-on-surface-variant">No supported AI match</p><p className="mt-1 text-xs text-on-surface-variant">{item.reason}</p></>}
                      </div>)}
                    </section>
                  </div>
                </article>;
              })}
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

      {showHistory && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowHistory(false); setHistoryDetails(null); } }}>
        <section role="dialog" aria-modal="true" aria-labelledby="quote-history-title" className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl">
          <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4">
            <div><h2 id="quote-history-title" className="font-headline text-xl font-bold">Quote history</h2><p className="text-sm text-on-surface-variant">Your saved quotes, newest first.</p></div>
            <button type="button" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => { setShowHistory(false); setHistoryDetails(null); }}>Close</button>
          </div>
          <div className="max-h-[65vh] overflow-y-auto p-4">
            {historyDetails ? <QuoteHistoryDetails
              saved={historyDetails}
              onBack={() => setHistoryDetails(null)}
              onEdit={() => { void loadQuote(String(historyDetails.id)); setHistoryDetails(null); setShowHistory(false); }}
            /> : historyDetailsLoading ? <p className="p-5 text-sm text-on-surface-variant">Loading quote details…</p> : <>
              {savedQuotes.length ? <div className="space-y-2">{savedQuotes.map((saved) => <div key={saved.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/20 p-4">
                <div><h3 className="font-semibold">{saved.project_name || `Quote #${saved.id}`}</h3><p className="mt-1 text-xs text-on-surface-variant">{saved.status} · Created {new Date(saved.created_at).toLocaleDateString()} · Updated {new Date(saved.updated_at).toLocaleDateString()}</p></div>
                <div className="flex gap-2">
                  <button type="button" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => { void viewQuoteHistoryDetails(String(saved.id)); }}>View details</button>
                  <button type="button" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => { void loadQuote(String(saved.id)); setShowHistory(false); }}>Open in builder</button>
                </div>
              </div>)}</div> : <p className="p-5 text-sm text-on-surface-variant">No saved quotes yet. Save a draft or import a completed workbook to start your history.</p>}
              {hasMoreQuotes && <button type="button" className="mt-4 w-full rounded-xl border border-outline-variant/40 px-4 py-3 text-sm font-semibold hover:bg-surface-container-low" disabled={historyLoading} onClick={loadMoreQuoteHistory}>{historyLoading ? "Loading…" : "Load more quotes"}</button>}
            </>}
          </div>
        </section>
      </div>}

      {showImport && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowImport(false); resetImportPreview(); } }}>
        <section role="dialog" aria-modal="true" aria-labelledby="quote-import-title" className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl">
          <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4">
            <div><h2 id="quote-import-title" className="font-headline text-xl font-bold">Import quote or proposal history</h2><p className="text-sm text-on-surface-variant">Completed Renew quote workbooks become saved history records; other fixture-pair spreadsheets add prior suggestions.</p></div>
            <button type="button" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-surface-container-low" onClick={() => { setShowImport(false); resetImportPreview(); }}>Close</button>
          </div>
          <div className="max-h-[72vh] space-y-4 overflow-y-auto p-6">
            <input ref={importInput} type="file" accept=".xlsx,.xls,.xlsm,.csv" className="hidden" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void previewImport(file); }} />
            <button type="button" className={`w-full rounded-2xl border-2 border-dashed p-8 text-center transition ${draggingFile ? "border-primary bg-primary/[0.06]" : "border-outline-variant/40 hover:border-primary/50"}`} onClick={() => importInput.current?.click()} onDragOver={(event) => { event.preventDefault(); setDraggingFile(true); }} onDragLeave={() => setDraggingFile(false)} onDrop={(event) => { event.preventDefault(); setDraggingFile(false); const file = event.dataTransfer.files.item(0); if (file) void previewImport(file); }}>
              <span className="block font-semibold">{importBusy ? "Reading or importing workbook…" : "Drop an Excel or CSV file here, or click to browse"}</span>
              <span className="mt-1 block text-xs text-on-surface-variant">Supports .xls, .xlsx, and .xlsm quote templates up to 100 MB, including embedded photos. Other Excel/CSV fixture-suggestion files are limited to 4 MB.</span>
            </button>
            {importPreview && <>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-sm">
                <p className="font-semibold">{importPreview.fileName} · sheet “{importPreview.sheetName}”</p>
                {importPreview.kind === "quote" && importPreview.quote
                  ? <p className="mt-1 text-on-surface-variant">{importPreview.quote.projectName} · {importPreview.quote.lines.length} quote lines · {importPreview.photoCount || 0} embedded photos found{importPreview.skippedPhotos ? ` · ${importPreview.skippedPhotos} unsupported or oversized photos skipped` : ""}. Recalculated using the workbook’s tax and margin formulas.</p>
                  : <p className="mt-1 text-on-surface-variant">{importPreview.records.length} fixture pairs detected{importPreview.skippedRows ? ` · ${importPreview.skippedRows} incomplete rows skipped` : ""}{importPreview.maxRecordsReached ? " · 3,000-row safety limit reached" : ""}. Prices and dates are used when available.</p>}
              </div>
              {importPreview.kind === "quote" && importPreview.quote && importQuoteTotals ? <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <p className="rounded-xl bg-surface-container-low p-3 text-sm">Tax <strong>{(importPreview.quote.taxRate * 100).toFixed(2)}%</strong></p>
                  <p className="rounded-xl bg-surface-container-low p-3 text-sm">Product margin <strong>{(importPreview.quote.productMarkup * 100).toFixed(2)}%</strong></p>
                  <p className="rounded-xl bg-surface-container-low p-3 text-sm">Labor margin <strong>{(importPreview.quote.laborMargin * 100).toFixed(2)}%</strong></p>
                  <p className="rounded-xl bg-surface-container-low p-3 text-sm">Recalculated sell total <strong>{money(importQuoteTotals.sellTotal)}</strong></p>
                </div>
                <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                  <table className="w-full min-w-[1080px] text-left text-sm">
                    <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant"><tr><th className="px-3 py-2">Line</th><th className="px-3 py-2">Existing fixture</th><th className="px-3 py-2">Proposed fixture</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Product cost</th><th className="px-3 py-2">Labor cost</th><th className="px-3 py-2">Formula rates</th><th className="px-3 py-2">Calculated sell</th></tr></thead>
                    <tbody>{importPreview.quote.lines.slice(0, 30).map((line, index) => {
                      const row = importQuoteTotals.rows.find((item) => item.line.id === line.id);
                      return <tr key={line.id} className="border-t border-outline-variant/15">
                        <td className="px-3 py-2">{line.fixtureId || index + 1}</td>
                        <td className="px-3 py-2">{line.existingDescription || "—"}</td>
                        <td className="px-3 py-2">{line.proposedDescription || "—"}</td>
                        <td className="px-3 py-2">{line.proposedQty}</td>
                        <td className="px-3 py-2">{money(line.productCost)}</td>
                        <td className="px-3 py-2">{money(line.laborCost)}</td>
                        <td className="px-3 py-2">{((row?.taxRate ?? importPreview.quote?.taxRate ?? 0) * 100).toFixed(2)}% tax · {((row?.productMarkup ?? importPreview.quote?.productMarkup ?? 0) * 100).toFixed(2)}% product · {((row?.laborMargin ?? importPreview.quote?.laborMargin ?? 0) * 100).toFixed(2)}% labor</td>
                        <td className="px-3 py-2">{money(row?.sellTotal ?? 0)}</td>
                      </tr>;
                    })}</tbody>
                  </table>
                  {importPreview.quote.lines.length > 30 && <p className="border-t border-outline-variant/15 p-3 text-xs text-on-surface-variant">Showing the first 30 lines. All {importPreview.quote.lines.length} quote lines will be saved.</p>}
                </div>
                <p className="text-xs text-on-surface-variant">Importing creates a saved record in Quote history. Uploaded photos are extracted from the workbook and attached to their matching lines. Re-importing the same file will not create a duplicate quote.</p>
                <div className="flex justify-end gap-3">
                  <button type="button" className="rounded-full border border-outline-variant/40 px-5 py-2 text-sm font-semibold" onClick={resetImportPreview} disabled={importBusy}>Choose another file</button>
                  <button type="button" className="primary-gradient rounded-full px-5 py-2 text-sm font-bold text-on-primary" onClick={commitImport} disabled={importBusy}>{importBusy ? "Importing…" : `Save quote with ${importPreview.quote.lines.length} lines`}</button>
                </div>
              </> : <>
              <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant"><tr><th className="px-3 py-2">Existing fixture</th><th className="px-3 py-2">Proposed fixture</th><th className="px-3 py-2">Watts</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Product cost</th><th className="px-3 py-2">Quote date</th></tr></thead>
                  <tbody>{importPreview.records.slice(0, 20).map((record) => <tr key={record.sourceRow} className="border-t border-outline-variant/15"><td className="px-3 py-2">{record.existingDescription}</td><td className="px-3 py-2">{record.proposedDescription}</td><td className="px-3 py-2">{record.proposedWatts || "—"}</td><td className="px-3 py-2">{record.proposedQty ?? "—"}</td><td className="px-3 py-2">{record.productCost === null ? "—" : money(record.productCost)}</td><td className="px-3 py-2">{record.sourceDate ? new Date(record.sourceDate).toLocaleDateString() : "Not provided"}</td></tr>)}</tbody>
                </table>
                {importPreview.records.length > 20 && <p className="border-t border-outline-variant/15 p-3 text-xs text-on-surface-variant">Showing the first 20 rows. All {importPreview.records.length} detected rows will be imported.</p>}
              </div>
              <p className="text-xs text-on-surface-variant">Imported records are shared with Renew employees for fixture suggestions. A repeated upload of the same file will not duplicate its rows.</p>
              <div className="flex justify-end gap-3">
                <button type="button" className="rounded-full border border-outline-variant/40 px-5 py-2 text-sm font-semibold" onClick={resetImportPreview} disabled={importBusy}>Choose another file</button>
                <button type="button" className="primary-gradient rounded-full px-5 py-2 text-sm font-bold text-on-primary" onClick={commitImport} disabled={importBusy}>{importBusy ? "Importing…" : `Import ${importPreview.records.length} rows`}</button>
              </div>
              </>}
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
