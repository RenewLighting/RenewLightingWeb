"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import Icon from "@/components/Icon";
import FixtureAutocomplete, { type FixtureAutocompleteOption } from "@/components/FixtureAutocomplete";
import FixtureTypePicker from "@/components/FixtureTypePicker";
import InputWattagePicker from "@/components/InputWattagePicker";
import { wattageReference, type InputWattageEntry } from "@/lib/input-wattage";
import { calculateEnergySavings, calculateQuote, emptyLine, emptyQuote, money, type Quote, type QuoteLine } from "@/lib/quote";
import { conditionIdentifiers, describeCondition, describeWorkCodes, workIdentifiers, type WorkCode } from "@/lib/quote-identifiers";
import { colorTemperatureOptions, controlOptions, dimmingOptions, fixtureTypes, lightDistributions, lightingTechnologies, matchFixtureDescriptionExamples, mountingTypes, voltageOptions } from "@/lib/quote-fixture-options";
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
  fixtureType?: string;
  priorUseCount: number;
  latestCost: number | null;
  latestUpdatedAt: string;
};

type SuggestionResponse = {
  history: HistoricalSuggestion[];
  existingFixtures: HistoricalSuggestion[];
  proposedFixtures: HistoricalSuggestion[];
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

function uniqueFixtureAutocompleteOptions(options: FixtureAutocompleteOption[]) {
  const priority = (group: string) => group.includes("Matching prior") ? 0
    : group.includes("Suggested replacements") || group.includes("Warehouse") ? 1
      : 2;
  const ranked = options.map((option, index) => ({ option, index }))
    .sort((left, right) => priority(left.option.group) - priority(right.option.group)
      || left.index - right.index);
  const seen = new Set<string>();
  return ranked.flatMap(({ option }) => {
    const key = option.label.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [option];
  });
}

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
    energyAnalysis: { ...emptyQuote().energyAnalysis, ...(saved.quote_data.energyAnalysis ?? {}) },
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
              {line.workCodes?.length ? <p className="mt-1 text-sm">Work: {describeWorkCodes(line.workCodes)}</p> : null}
              {line.conditionCode && <p className="text-sm">Condition: {describeCondition(line.conditionCode)}</p>}
              {line.existingWattageReference && <p className="text-xs text-on-surface-variant">Input wattage reference: {line.existingWattageReference}</p>}
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
  const [activeTab, setActiveTab] = useState<"quote" | "energy">("quote");
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
  const [suggestionState, setSuggestionState] = useState<{ lineIndex: number; field: "existing" | "proposed"; query: string; result: SuggestionResponse | null; loading: boolean } | null>(null);
  const persistedPhotoIds = useRef<string[]>([]);
  const uploadedPhotoIds = useRef<string[]>([]);
  const suggestionRequest = useRef(0);
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionController = useRef<AbortController | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const importFile = useRef<File | null>(null);
  const importPhotos = useRef<WorkbookPhoto[]>([]);
  const totals = calculateQuote(quote);
  const energy = calculateEnergySavings(quote);
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

  function updateEnergySetting<K extends keyof Quote["energyAnalysis"]>(
    key: K,
    value: Quote["energyAnalysis"][K],
  ) {
    setQuote((current) => ({
      ...current,
      energyAnalysis: {
        ...emptyQuote().energyAnalysis,
        ...current.energyAnalysis,
        [key]: value,
      },
    }));
  }

  function updateLine<K extends keyof QuoteLine>(index: number, key: K, value: QuoteLine[K]) {
    setAiRecommendations([]);
    setQuote((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const updated = { ...line, [key]: value };
        if (key === "existingWatts" || key === "existingDescription") {
          updated.existingWattageReference = "";
        }
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

  function applyInputWattage(index: number, entry: InputWattageEntry) {
    setAiRecommendations([]);
    setQuote((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => lineIndex === index ? {
        ...line,
        existingDescription: entry.description,
        existingWatts: `${entry.watts}W`,
        existingWattageReference: wattageReference(entry),
      } : line),
    }));
    searchSuggestions(index, "existing", entry.description);
  }

  function toggleWorkCode(index: number, code: WorkCode) {
    const codes = quote.lines[index].workCodes ?? [];
    updateLine(index, "workCodes", codes.includes(code)
      ? codes.filter((item) => item !== code)
      : [...codes, code]);
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

  function searchSuggestions(lineIndex: number, field: "existing" | "proposed", query: string) {
    const requestId = ++suggestionRequest.current;
    if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    suggestionController.current?.abort();
    const normalized = query.trim();
    if (normalized.length < 3) {
      setSuggestionState({ lineIndex, field, query: normalized, result: null, loading: false });
      return;
    }

    setSuggestionState({ lineIndex, field, query: normalized, result: null, loading: true });
    suggestionTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      suggestionController.current = controller;
      try {
        const response = await fetch(`/api/quote/suggestions?q=${encodeURIComponent(normalized)}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Quote suggestions are unavailable.");
        if (requestId === suggestionRequest.current) {
          setSuggestionState({ lineIndex, field, query: normalized, result, loading: false });
        }
      } catch (error) {
        if (controller.signal.aborted || requestId !== suggestionRequest.current) return;
        setSuggestionState({ lineIndex, field, query: normalized, result: null, loading: false });
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
        proposedFixtureType: line.proposedFixtureType || suggestion.fixtureType || "",
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

  function applyExistingFixtureSuggestion(lineIndex: number, suggestion: HistoricalSuggestion) {
    clearSuggestionSearch();
    setAiRecommendations([]);
    setQuote((current) => ({
      ...current,
      lines: current.lines.map((line, index) => index === lineIndex ? {
        ...line,
        existingDescription: suggestion.description,
        existingWatts: line.existingWatts || suggestion.watts,
        existingFixtureType: line.existingFixtureType || suggestion.fixtureType || "",
        existingWattageReference: "",
      } : line),
    }));
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
        proposedFixtureType: line.proposedFixtureType || suggestion.category || "",
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
      energyAnalysis: { ...emptyQuote().energyAnalysis, ...(saved.quote_data.energyAnalysis ?? {}) },
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
        <div className="mx-auto flex min-h-20 max-w-[1800px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Renew Workspace</p>
            <h1 className="font-headline text-2xl font-extrabold">Quote Builder</h1>
          </div>
          <div className="flex items-center gap-2">
            <details className="group relative">
              <summary className="cursor-pointer rounded-xl border border-outline-variant/30 bg-white px-3 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container-low">More actions</summary>
              <div className="absolute right-0 z-50 mt-2 flex w-52 flex-col overflow-hidden rounded-xl border border-outline-variant/20 bg-white p-1.5 shadow-xl">
                <button type="button" className="rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-container-low disabled:opacity-50" onClick={() => { setHistoryDetails(null); setShowHistory(true); }} disabled={uploadingLineId !== null}>Quote history</button>
                <button type="button" className="rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-container-low" onClick={() => { setShowImport(true); resetImportPreview(); }}>Import Excel</button>
                <button type="button" className="rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-container-low" onClick={() => { setShowOneDrive(true); setFolderTrail([]); setOneDriveFolders([]); void loadOneDriveFolder(); }}>Save to OneDrive</button>
                <button type="button" className="rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-container-low disabled:opacity-50" onClick={() => { void startNewQuote(); }} disabled={uploadingLineId !== null}>New quote</button>
                {selectedQuoteId && <button type="button" className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-error hover:bg-error/5 disabled:opacity-50" onClick={deleteQuote} disabled={uploadingLineId !== null}>Delete draft</button>}
              </div>
            </details>
            <Link href="/employee" className="hidden rounded-xl px-3 py-2.5 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-low hover:text-primary sm:inline-flex">Portal</Link>
            <button type="button" className="primary-gradient rounded-xl px-4 py-2.5 text-sm font-bold text-on-primary shadow-sm transition hover:brightness-105 disabled:opacity-60" onClick={saveQuote} disabled={saving || uploadingLineId !== null}>
              {uploadingLineId !== null ? "Uploading…" : saving ? "Saving…" : selectedQuoteId ? "Save changes" : "Save draft"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] px-3 py-5 sm:px-5 lg:px-8 lg:py-6">
        {storageStatus && <p className="mb-4 rounded-xl border border-outline-variant/20 bg-white px-4 py-3 text-sm text-on-surface-variant shadow-sm" role="status">{storageStatus}</p>}
        <section className="mb-5 overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary-container to-secondary" />
          <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-2 lg:items-end">
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Project name<input className="mt-1.5 w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-2.5 text-sm font-medium normal-case tracking-normal text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" value={quote.projectName} onChange={(event) => updateQuote("projectName", event.target.value)} placeholder="Name this project" /></label>
              <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Project address<input className="mt-1.5 w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-2.5 text-sm font-medium normal-case tracking-normal text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" value={quote.address} onChange={(event) => updateQuote("address", event.target.value)} placeholder="Site address" /></label>
            </div>
            <p className="self-end text-right text-xs text-on-surface-variant">{quote.lines.length} quote line{quote.lines.length === 1 ? "" : "s"}</p>
          </div>
        </section>

        <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Quote workspace">
          <button type="button" role="tab" aria-selected={activeTab === "quote"} className={`flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition ${activeTab === "quote" ? "border-primary bg-primary text-on-primary shadow-sm" : "border-outline-variant/30 bg-white text-on-surface-variant hover:border-primary/40 hover:bg-primary/[0.03]"}`} onClick={() => setActiveTab("quote")}><span>01</span> Quote details <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === "quote" ? "bg-white/15" : "bg-surface-container-low"}`}>{quote.lines.length}</span></button>
          <button type="button" role="tab" aria-selected={activeTab === "energy"} className={`flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition ${activeTab === "energy" ? "border-primary bg-primary text-on-primary shadow-sm" : "border-outline-variant/30 bg-white text-on-surface-variant hover:border-primary/40 hover:bg-primary/[0.03]"}`} onClick={() => setActiveTab("energy")}><span>02</span> Energy analysis {energy.annualKwhSavings !== null && <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === "energy" ? "bg-white/15" : "bg-surface-container-low"}`}>{energy.annualKwhSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh</span>}</button>
        </div>

        {activeTab === "quote" && <div role="tabpanel" aria-label="Quote details" className="space-y-4">
          <section className="rounded-2xl border border-primary/15 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 font-headline text-lg font-bold">Quote summary</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
              <div className="rounded-xl bg-primary p-4 text-on-primary">
                <span className="text-xs font-semibold uppercase tracking-wide text-on-primary/75">Sell total</span>
                <strong className="mt-1 block font-headline text-3xl">{money(totals.sellTotal)}</strong>
                <span className="mt-1 block text-xs text-on-primary/75">{quote.lines.length} quote line{quote.lines.length === 1 ? "" : "s"}</span>
              </div>
              {[
                ["Direct cost", money(totals.directCost)],
                ["Contingency", money(totals.contingency)],
                ["Estimated profit", `${money(totals.profit)} · ${(totals.margin * 100).toFixed(1)}% margin`],
              ].map(([label, amount]) => <div key={label} className="flex flex-col justify-center rounded-xl bg-surface-container-low px-4 py-3">
                <span className="text-xs text-on-surface-variant">{label}</span>
                <strong className="mt-1 text-lg">{amount}</strong>
              </div>)}
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <details className="rounded-xl border border-outline-variant/20">
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-on-surface">Project costs <span className="text-xs font-normal text-on-surface-variant">· Optional</span></summary>
                <div className="grid gap-3 border-t border-outline-variant/15 p-3 sm:grid-cols-3">{([["shipping", "Shipping"], ["travel", "Travel"], ["miscellaneous", "Miscellaneous"]] as const).map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}<input type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 font-normal" value={quote[key] || ""} onChange={(event) => updateQuote(key, numberValue(event.target.value))} /></label>)}</div>
              </details>
              <details className="rounded-xl border border-outline-variant/20">
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-on-surface">Formula settings <span className="text-xs font-normal text-on-surface-variant">· Advanced</span></summary>
                <div className="border-t border-outline-variant/15 p-3">
                  <div className="flex items-start justify-between gap-3"><p className="text-xs leading-relaxed text-on-surface-variant">Business rules used to calculate quote totals and exports.</p><button type="button" className="shrink-0 text-xs font-bold text-primary hover:underline" onClick={resetFormulaSettings}>Reset</button></div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{formulaFields.map(({ key, label, description, suffix }) => <label key={key} className="text-sm font-semibold">{label}<span className="ml-1 text-on-surface-variant">({suffix})</span><input type="number" min="0" max="99.99" step="0.01" className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 font-normal" value={(quote[key] as number) * 100} onChange={(event) => updateQuote(key, numberValue(event.target.value) / 100)} /><span className="mt-1 block text-xs font-normal leading-relaxed text-on-surface-variant">{description}</span></label>)}</div>
                </div>
              </details>
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button type="button" className="rounded-xl border border-outline-variant/30 bg-white px-4 py-2.5 text-sm font-bold text-on-surface transition hover:bg-surface-container-low" onClick={() => download("xlsx")}>Export Excel</button>
              <button type="button" className="primary-gradient rounded-xl px-4 py-2.5 text-sm font-bold text-on-primary shadow-sm transition hover:brightness-105" onClick={() => download("pdf")}>Proposal PDF</button>
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/15 px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <h2 className="font-headline text-xl font-bold">Build your quote</h2>
                <p className="mt-1 text-sm text-on-surface-variant">Add what is there, then what you are installing. Type in the description fields to see suggestions.</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button type="button" className="rounded-xl border border-primary/30 bg-white px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/[0.04] disabled:opacity-60" onClick={requestAISuggestions} disabled={aiBusy}>{aiBusy ? "Reviewing…" : "Review with AI"}</button>
                <button type="button" className="primary-gradient rounded-xl px-4 py-2.5 text-sm font-bold text-on-primary shadow-sm transition hover:brightness-105" onClick={() => updateQuote("lines", [...quote.lines, emptyLine()])}>+ Add fixture</button>
              </div>
            </div>

            <div className="space-y-3 bg-surface-container-low/50 p-3 sm:p-4">
              {quote.lines.map((line, index) => {
                const row = totals.rows.find((item) => item.line === line);
                const existingSuggestions = suggestionState?.lineIndex === index && suggestionState.field === "existing" ? suggestionState : null;
                const proposedSuggestions = suggestionState?.lineIndex === index && suggestionState.field === "proposed" ? suggestionState : null;
                const lineAI = aiRecommendations.filter((item) => item.lineIndex === index);
                const lineNeedsDetails = !line.proposedDescription.trim() || line.proposedQty <= 0;
                const fieldClass = "mt-1.5 w-full min-w-0 rounded-xl border border-outline-variant/30 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
                const labelClass = "block min-w-0 text-xs font-semibold text-on-surface-variant";
                const existingAutocompleteOptions = uniqueFixtureAutocompleteOptions([
                  ...matchFixtureDescriptionExamples(line.existingDescription).map((description) => ({
                    id: `existing-example-${description}`,
                    group: line.existingDescription ? "Common descriptions" : "Common fixture descriptions",
                    label: description,
                    onSelect: () => {
                      updateLine(index, "existingDescription", description);
                      clearSuggestionSearch();
                    },
                  })),
                  ...(existingSuggestions?.result?.existingFixtures ?? []).map((suggestion) => ({
                    id: `existing-history-${suggestion.description}`,
                    group: "Matching prior existing fixtures",
                    label: suggestion.description,
                    detail: [suggestion.fixtureType, suggestion.watts, `${suggestion.priorUseCount} prior use${suggestion.priorUseCount === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
                    onSelect: () => applyExistingFixtureSuggestion(index, suggestion),
                  })),
                  ...(existingSuggestions?.result?.history ?? []).map((suggestion) => ({
                    id: `existing-replacement-${suggestion.description}`,
                    group: "Suggested replacements from prior quotes",
                    label: suggestion.description,
                    detail: [suggestion.watts, `${suggestion.priorUseCount} prior use${suggestion.priorUseCount === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
                    onSelect: () => applyHistorySuggestion(index, suggestion),
                  })),
                  ...(existingSuggestions?.result?.warehouse ?? []).map((suggestion) => ({
                    id: `existing-warehouse-${suggestion.id}`,
                    group: "Warehouse replacement products",
                    label: [suggestion.name, suggestion.model_number].filter(Boolean).join(" · "),
                    detail: [suggestion.brand, suggestion.category].filter(Boolean).join(" · "),
                    onSelect: () => applyWarehouseSuggestion(index, suggestion),
                  })),
                ]);
                const proposedAutocompleteOptions = uniqueFixtureAutocompleteOptions([
                  ...matchFixtureDescriptionExamples(line.proposedDescription).map((description) => ({
                    id: `proposed-example-${description}`,
                    group: line.proposedDescription ? "Common descriptions" : "Common fixture descriptions",
                    label: description,
                    onSelect: () => {
                      updateLine(index, "proposedDescription", description);
                      clearSuggestionSearch();
                    },
                  })),
                  ...(proposedSuggestions?.result?.proposedFixtures ?? []).map((suggestion) => ({
                    id: `proposed-history-${suggestion.description}`,
                    group: "Matching prior proposed fixtures",
                    label: suggestion.description,
                    detail: [suggestion.fixtureType, suggestion.watts, `${suggestion.priorUseCount} prior use${suggestion.priorUseCount === 1 ? "" : "s"}`, suggestion.latestCost !== null && suggestion.latestCost > 0 ? `${money(suggestion.latestCost)} recorded unit cost` : ""].filter(Boolean).join(" · "),
                    onSelect: () => applyHistorySuggestion(index, suggestion),
                  })),
                  ...(proposedSuggestions?.result?.warehouse ?? []).map((suggestion) => ({
                    id: `proposed-warehouse-${suggestion.id}`,
                    group: "Matching Warehouse products",
                    label: [suggestion.name, suggestion.model_number].filter(Boolean).join(" · "),
                    detail: [suggestion.brand, suggestion.category, suggestion.latest_price !== null && suggestion.latest_currency === "USD" ? `${money(suggestion.latest_price)} latest USD quote` : ""].filter(Boolean).join(" · "),
                    onSelect: () => applyWarehouseSuggestion(index, suggestion),
                  })),
                ]);
                const hasActiveAutocomplete = Boolean(existingSuggestions || proposedSuggestions);
                return <article key={line.id} className={`relative ${hasActiveAutocomplete ? "z-20" : "z-0"} min-w-0 overflow-visible rounded-xl border border-outline-variant/25 bg-white shadow-sm`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/15 bg-surface-container-low/60 px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <span className="rounded-full bg-on-surface/[0.06] px-3 py-1 text-xs font-bold text-on-surface">LINE {String(index + 1).padStart(2, "0")}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${lineNeedsDetails ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{lineNeedsDetails ? "Add scope + qty" : "Scope entered"}</span>
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
                      <div className="text-right"><span className="block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Line total</span><strong className="font-headline text-lg text-primary">{row ? money(row.sellTotal) : money(0)}</strong></div>
                      <button type="button" aria-label={`Remove estimate line ${index + 1}`} className="rounded-lg px-3 py-2 text-xs font-semibold text-error transition hover:bg-error/5 disabled:opacity-50" disabled={uploadingLineId === line.id} onClick={() => { void removeEstimateLine(line); }}>Remove</button>
                    </div>
                  </div>

                  <details className="border-b border-outline-variant/15">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold text-on-surface marker:hidden hover:bg-surface-container-low/50 sm:px-5">
                      <span>Scope and condition codes <span className="ml-1 text-xs font-normal text-on-surface-variant">{(line.workCodes?.length ?? 0) + (line.conditionCode ? 1 : 0) ? `· ${(line.workCodes?.length ?? 0) + (line.conditionCode ? 1 : 0)} selected` : "· Optional"}</span></span>
                      <span className="text-xs font-semibold text-primary">Show details</span>
                    </summary>
                    <section className="px-4 pb-4 sm:px-5">
                    <p className="mb-3 text-xs text-on-surface-variant">Codes document the work and observed condition; they do not change quantities or pricing.</p>
                    <label className={`${labelClass} mt-3`}>Work identifiers (select all that apply)
                      <select className={fieldClass} value="" onChange={(event) => {
                        const item = workIdentifiers.find((identifier) => identifier.code === event.target.value);
                        if (item && !line.workCodes?.includes(item.code)) toggleWorkCode(index, item.code);
                      }}>
                        <option value="">Select a work identifier to add</option>
                        {workIdentifiers.map((item) => (
                          <option key={item.code} value={item.code} disabled={line.workCodes?.includes(item.code)}>
                            {item.code} - {item.description}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(line.workCodes ?? []).map((code) => {
                      const item = workIdentifiers.find((identifier) => identifier.code === code);
                      return item ? <div key={code} className="mt-2 flex items-start justify-between gap-3 rounded-lg border border-outline-variant/20 p-3 text-xs text-on-surface-variant">
                        <div><p className="font-semibold">{code} - {item.description}</p><p className="mt-1">{item.treatment}</p></div>
                        <button type="button" aria-label={`Remove ${code} from line ${index + 1}`} className="shrink-0 font-semibold text-error hover:underline" onClick={() => toggleWorkCode(index, code)}>Remove</button>
                      </div> : null;
                    })}
                    <label className={`${labelClass} mt-3 block`}>Existing fixture condition
                      <select className={fieldClass} value={line.conditionCode ?? ""} onChange={(event) => {
                        const condition = conditionIdentifiers.find((item) => item.code === event.target.value);
                        updateLine(index, "conditionCode", condition?.code ?? "");
                      }}>
                        <option value="">Not recorded</option>
                        {conditionIdentifiers.map((item) => <option key={item.code} value={item.code}>{item.code} - {item.description}</option>)}
                      </select>
                    </label>
                    {line.conditionCode && <p className="mt-2 text-xs text-on-surface-variant">{conditionIdentifiers.find((item) => item.code === line.conditionCode)?.treatment}</p>}
                    </section>
                  </details>

                  <details className="border-b border-outline-variant/15">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold text-on-surface marker:hidden hover:bg-surface-container-low/50 sm:px-5">
                      <div>
                        Line photos <span className="ml-1 text-xs font-normal text-on-surface-variant">({line.photoIds.length}/{maxLinePhotos}) · Optional</span>
                      </div>
                      <span className="text-xs font-semibold text-primary">{line.photoIds.length ? "View / manage" : "Add photos"}</span>
                    </summary>
                    <section className="px-4 pb-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
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
                  </details>

                  <div className="grid min-w-0 grid-cols-1 gap-3 p-3 sm:p-4 xl:grid-cols-2">
                    <section className="grid min-w-0 content-start grid-cols-1 gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4 xl:grid-cols-2 xl:gap-x-4">
                      <div className="mb-1 flex items-center justify-between gap-3 xl:col-span-2">
                        <div><h3 className="text-sm font-bold text-sky-950">Existing fixture</h3><p className="mt-0.5 text-xs text-sky-900/75">What is installed now?</p></div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-900">Existing</span>
                      </div>
                      <div className={`${labelClass} xl:col-span-2`}>
                        Existing fixture description
                        <FixtureAutocomplete
                          value={line.existingDescription}
                          onChange={(value) => updateLine(index, "existingDescription", value)}
                          onSearch={(query) => searchSuggestions(index, "existing", query)}
                          label={`Existing fixture description, line ${index + 1}`}
                          options={existingAutocompleteOptions}
                          loading={existingSuggestions?.loading ?? false}
                          notice={existingSuggestions?.result?.warehouseAvailable === false ? "Warehouse search is unavailable; fixture history and common descriptions are still available." : undefined}
                          placeholder="Type a fixture, lamp, or model"
                          className={fieldClass}
                        />
                      </div>
                      <label className={labelClass}>Existing fixture type
                        <FixtureTypePicker
                          value={line.existingFixtureType}
                          onChange={(value) => updateLine(index, "existingFixtureType", value)}
                          label={`Existing fixture type, line ${index + 1}`}
                          options={fixtureTypes}
                          className={fieldClass}
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3 xl:col-span-2">
                        <label className={labelClass}>Existing input watts<input className={fieldClass} value={line.existingWatts} onChange={(event) => updateLine(index, "existingWatts", event.target.value)} placeholder="e.g. 190W" /></label>
                        <label className={labelClass}>Existing quantity<input type="number" min="0" className={fieldClass} value={line.existingQty || ""} onChange={(event) => updateLine(index, "existingQty", numberValue(event.target.value))} placeholder="0" /></label>
                      </div>
                      {line.existingWattageReference && <p className="text-xs text-on-surface-variant xl:col-span-2">Reference: {line.existingWattageReference}. Editing the description or watts clears this reference.</p>}
                      <div className="xl:col-span-2"><InputWattagePicker onSelect={(entry) => applyInputWattage(index, entry)} /></div>
                      <p className="mt-2 text-[11px] leading-relaxed text-sky-900/75 xl:col-span-2">Start typing for common descriptions and matches from prior quotes. Custom descriptions are welcome.</p>
                    </section>

                    <section className="grid min-w-0 content-start grid-cols-1 gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 xl:grid-cols-2 xl:gap-x-4">
                      <div className="mb-1 flex items-center justify-between gap-3 xl:col-span-2">
                        <div><h3 className="text-sm font-bold text-emerald-950">Proposed work</h3><p className="mt-0.5 text-xs text-emerald-900/75">What will be installed or performed?</p></div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-900">Proposed</span>
                      </div>
                      <div className={`${labelClass} xl:col-span-2`}>
                        Proposed fixture / scope description
                        <FixtureAutocomplete
                          value={line.proposedDescription}
                          onChange={(value) => updateLine(index, "proposedDescription", value)}
                          onSearch={(query) => searchSuggestions(index, "proposed", query)}
                          label={`Proposed fixture or scope description, line ${index + 1}`}
                          options={proposedAutocompleteOptions}
                          loading={proposedSuggestions?.loading ?? false}
                          notice={proposedSuggestions?.result?.warehouseAvailable === false ? "Warehouse search is unavailable; fixture history and common descriptions are still available." : undefined}
                          placeholder="Type a fixture, model, or work description"
                          className={fieldClass}
                        />
                      </div>
                      <label className={labelClass}>Proposed fixture type
                        <FixtureTypePicker
                          value={line.proposedFixtureType}
                          onChange={(value) => updateLine(index, "proposedFixtureType", value)}
                          label={`Proposed fixture type, line ${index + 1}`}
                          options={fixtureTypes}
                          className={fieldClass}
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3 xl:col-span-2">
                        <label className={labelClass}>Proposed watts<input className={fieldClass} value={line.proposedWatts} onChange={(event) => updateLine(index, "proposedWatts", event.target.value)} placeholder="e.g. 40W" /></label>
                        <label className={labelClass}>Work quantity<input type="number" min="0" className={fieldClass} value={line.proposedQty || ""} onChange={(event) => updateLine(index, "proposedQty", numberValue(event.target.value))} placeholder="0" /></label>
                      </div>
                      <details className="rounded-lg border border-emerald-200/80 bg-white/70 xl:col-span-2">
                        <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold text-emerald-950 marker:text-emerald-800">Additional specifications and installation notes <span className="font-normal text-emerald-900/70">· Optional</span></summary>
                        <div className="space-y-3 border-t border-emerald-200/70 p-3">
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          ["technology", "Technology", lightingTechnologies],
                          ["mountingType", "Mounting", mountingTypes],
                          ["distribution", "Distribution", lightDistributions],
                          ["voltage", "Voltage", voltageOptions],
                          ["colorTemperature", "Color temperature", colorTemperatureOptions],
                          ["dimming", "Dimming", dimmingOptions],
                          ["controlType", "Controls", controlOptions],
                        ] as const).map(([key, label, options]) => <label key={key} className={labelClass}>{label}
                          <input list={`quote-option-${key}-${line.id}`} className={fieldClass} value={line[key]} onChange={(event) => updateLine(index, key, event.target.value)} placeholder="Type or choose" />
                          <datalist id={`quote-option-${key}-${line.id}`}>{options.map((option) => <option key={option} value={option} />)}</datalist>
                        </label>)}
                      </div>
                      <label className={labelClass}>Installation notes
                        <textarea className={`${fieldClass} resize-y`} value={line.installNotes} onChange={(event) => updateLine(index, "installNotes", event.target.value)} placeholder="Optional notes for installation" rows={2} />
                      </label>
                        </div>
                      </details>
                      <div className="grid grid-cols-2 gap-3 xl:col-span-2">
                        <label className={labelClass}>Product unit cost<input type="number" min="0" step="0.01" className={fieldClass} value={line.productCost || ""} onChange={(event) => updateLine(index, "productCost", numberValue(event.target.value))} placeholder="$0.00" /></label>
                        <label className={labelClass}>Labor unit cost<input type="number" min="0" step="0.01" className={fieldClass} value={line.laborCost || ""} onChange={(event) => updateLine(index, "laborCost", numberValue(event.target.value))} placeholder="$0.00" /></label>
                      </div>

                      {line.productCostSource && <p className="mt-2 text-[11px] text-emerald-950 xl:col-span-2">{line.productCostSource === "warehouse_quote" ? `Warehouse quote: ${line.productCostVendor || "vendor not recorded"}${line.productCostQuotedAt ? ` · ${new Date(line.productCostQuotedAt).toLocaleDateString()}` : ""}` : `Prior proposal cost · used ${line.productCostPriorUseCount} time(s)`}</p>}
                      {lineAI.map((item) => <div key={`${item.lineIndex}-${item.confidence}`} className="mt-3 rounded-xl border border-primary/20 bg-white p-3 xl:col-span-2">
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
                  <div className="grid gap-2 border-t border-outline-variant/15 bg-surface-container-low/40 px-4 py-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
                    <p className="text-on-surface-variant">Existing load <strong className="text-on-surface">{line.existingQty} × {line.existingWatts || "—"}{line.existingFixtureType ? ` · ${line.existingFixtureType}` : ""}</strong></p>
                    <p className="text-on-surface-variant">Proposed load <strong className="text-on-surface">{line.proposedQty} × {line.proposedWatts || "—"}{line.proposedFixtureType ? ` · ${line.proposedFixtureType}` : ""}</strong></p>
                    <p className="text-on-surface-variant">Product / labor sell <strong className="text-on-surface">{money(row?.productSell ?? 0)} / {money(row?.laborSell ?? 0)}</strong></p>
                    <p className="text-on-surface-variant">Line total <strong className="text-primary">{money(row?.sellTotal ?? 0)}</strong></p>
                  </div>
                </article>;
              })}
            </div>
          </section>
        </div>}

                      {activeTab === "energy" && <section role="tabpanel" aria-label="Energy savings analysis" className="space-y-6 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 sm:p-7">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h2 className="font-headline text-2xl font-bold">Energy savings analysis</h2>
                            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-on-surface-variant">Estimates update from the fixture quantities and wattages in this quote. Enter verified site operating hours and the project electricity rate before using bill savings or payback. No utility rate, rebate, or control savings is assumed.</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button type="button" className="rounded-full bg-on-surface px-4 py-2 text-sm font-bold text-surface" onClick={() => download("xlsx")}>Excel</button>
                            <button type="button" className="primary-gradient rounded-full px-4 py-2 text-sm font-bold text-on-primary" onClick={() => download("pdf")}>Proposal PDF</button>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <label className="text-sm font-semibold">Annual operating hours (site default)
                            <input type="number" min="0" max="8760" step="1" className="mt-1.5 w-full rounded-xl border border-outline-variant/30 bg-white px-3 py-2.5 font-normal" value={quote.energyAnalysis.annualOperatingHours ?? ""} onChange={(event) => updateEnergySetting("annualOperatingHours", event.target.value === "" ? null : Math.max(0, Math.min(8760, numberValue(event.target.value))))} placeholder="Required for kWh" />
                            <span className="mt-1 block text-xs font-normal text-on-surface-variant">Use a project-specific schedule; line-level hours below can override it.</span>
                          </label>
                          <label className="text-sm font-semibold">Electricity rate ($/kWh)
                            <input type="number" min="0" step="0.001" className="mt-1.5 w-full rounded-xl border border-outline-variant/30 bg-white px-3 py-2.5 font-normal" value={quote.energyAnalysis.electricityRatePerKwh ?? ""} onChange={(event) => updateEnergySetting("electricityRatePerKwh", event.target.value === "" ? null : Math.max(0, numberValue(event.target.value)))} placeholder="Required for bill savings" />
                            <span className="mt-1 block text-xs font-normal text-on-surface-variant">Enter the applicable blended energy rate from the customer’s bill or tariff.</span>
                          </label>
                          <label className="text-sm font-semibold">Demand charge ($/kW-month)
                            <input type="number" min="0" step="0.01" className="mt-1.5 w-full rounded-xl border border-outline-variant/30 bg-white px-3 py-2.5 font-normal" value={quote.energyAnalysis.demandChargePerKwMonth ?? ""} onChange={(event) => updateEnergySetting("demandChargePerKwMonth", event.target.value === "" ? null : Math.max(0, numberValue(event.target.value)))} placeholder="Optional" />
                            <span className="mt-1 block text-xs font-normal text-on-surface-variant">Demand savings require both this value and a coincidence percentage.</span>
                          </label>
                          <label className="text-sm font-semibold">Peak-demand coincidence (%)
                            <input type="number" min="0" max="100" step="1" className="mt-1.5 w-full rounded-xl border border-outline-variant/30 bg-white px-3 py-2.5 font-normal" value={quote.energyAnalysis.demandCoincidencePercent ?? ""} onChange={(event) => updateEnergySetting("demandCoincidencePercent", event.target.value === "" ? null : Math.max(0, Math.min(100, numberValue(event.target.value))))} placeholder="Optional" />
                            <span className="mt-1 block text-xs font-normal text-on-surface-variant">Use a measured or utility-accepted estimate; do not assume all load reduction is coincident.</span>
                          </label>
                          <label className="text-sm font-semibold">Annual maintenance savings ($)
                            <input type="number" min="0" step="0.01" className="mt-1.5 w-full rounded-xl border border-outline-variant/30 bg-white px-3 py-2.5 font-normal" value={quote.energyAnalysis.annualMaintenanceSavings ?? ""} onChange={(event) => updateEnergySetting("annualMaintenanceSavings", event.target.value === "" ? null : Math.max(0, numberValue(event.target.value)))} placeholder="Optional verified estimate" />
                            <span className="mt-1 block text-xs font-normal text-on-surface-variant">Include only substantiated avoided lamp, ballast, or service costs.</span>
                          </label>
                          <label className="text-sm font-semibold">Estimated incentive ($)
                            <input type="number" min="0" step="0.01" className="mt-1.5 w-full rounded-xl border border-outline-variant/30 bg-white px-3 py-2.5 font-normal" value={quote.energyAnalysis.estimatedIncentive ?? ""} onChange={(event) => updateEnergySetting("estimatedIncentive", event.target.value === "" ? null : Math.max(0, numberValue(event.target.value)))} placeholder="Optional; verify eligibility" />
                            <span className="mt-1 block text-xs font-normal text-on-surface-variant">Estimate only; confirm program, eligibility, and funding before relying on it.</span>
                          </label>
                          <label className="text-sm font-semibold">Analysis period (years)
                            <input type="number" min="1" max="50" step="1" className="mt-1.5 w-full rounded-xl border border-outline-variant/30 bg-white px-3 py-2.5 font-normal" value={quote.energyAnalysis.analysisYears || 10} onChange={(event) => updateEnergySetting("analysisYears", Math.max(1, Math.min(50, Math.floor(numberValue(event.target.value) || 1))))} />
                            <span className="mt-1 block text-xs font-normal text-on-surface-variant">Lifetime values are undiscounted estimates over this period.</span>
                          </label>
                          <label className="text-sm font-semibold">Electricity price escalation (%/year)
                            <input type="number" min="0" max="30" step="0.1" className="mt-1.5 w-full rounded-xl border border-outline-variant/30 bg-white px-3 py-2.5 font-normal" value={quote.energyAnalysis.electricityEscalationPercent ?? 0} onChange={(event) => updateEnergySetting("electricityEscalationPercent", Math.max(0, Math.min(30, numberValue(event.target.value))))} />
                            <span className="mt-1 block text-xs font-normal text-on-surface-variant">Optional projection; zero escalation is used unless changed.</span>
                          </label>
                          <label className="text-sm font-semibold">Grid emissions factor (kg CO₂e/kWh)
                            <input type="number" min="0" step="0.001" className="mt-1.5 w-full rounded-xl border border-outline-variant/30 bg-white px-3 py-2.5 font-normal" value={quote.energyAnalysis.carbonEmissionKgPerKwh ?? ""} onChange={(event) => updateEnergySetting("carbonEmissionKgPerKwh", event.target.value === "" ? null : Math.max(0, numberValue(event.target.value)))} placeholder="Optional regional factor" />
                            <span className="mt-1 block text-xs font-normal text-on-surface-variant">Use a cited, region-appropriate factor if reporting emissions.</span>
                          </label>
                        </div>

                        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/40 p-4">
                          <h3 className="font-headline font-bold">Line-level energy inputs</h3>
                          <p className="mt-1 text-xs text-on-surface-variant">Enter input watts (not lamp wattage) and quantities on Quote details. A line override replaces the site hours. Control savings percentages are applied only to the proposed load.</p>
                          <div className="mt-4 space-y-3">
                            {quote.lines.map((line, index) => <div key={line.id} className="grid gap-3 rounded-lg border border-outline-variant/20 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_170px_170px] sm:items-end">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{line.proposedDescription || line.existingDescription || `Line ${index + 1}`}</p>
                                <p className="mt-1 text-xs text-on-surface-variant">Existing {line.existingQty} × {line.existingWatts || "—"} → proposed {line.proposedQty} × {line.proposedWatts || "—"}</p>
                              </div>
                              <label className="text-xs font-semibold text-on-surface-variant">Operating hours override
                                <input type="number" min="0" max="8760" step="1" className="mt-1 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-normal text-on-surface" value={line.annualOperatingHoursOverride ?? ""} onChange={(event) => updateLine(index, "annualOperatingHoursOverride", event.target.value === "" ? null : Math.max(0, Math.min(8760, numberValue(event.target.value))))} placeholder="Use site default" />
                              </label>
                              <label className="text-xs font-semibold text-on-surface-variant">Proposed control savings (%)
                                <input type="number" min="0" max="100" step="1" className="mt-1 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-normal text-on-surface" value={line.controlSavingsPercent ?? 0} onChange={(event) => updateLine(index, "controlSavingsPercent", Math.max(0, Math.min(100, numberValue(event.target.value))))} />
                              </label>
                            </div>)}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-xl bg-surface-container-low p-4"><span className="text-xs text-on-surface-variant">Annual energy reduction</span><strong className="mt-1 block text-xl">{energy.annualKwhSavings === null ? "—" : `${energy.annualKwhSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`}</strong></div>
                          <div className="rounded-xl bg-surface-container-low p-4"><span className="text-xs text-on-surface-variant">Annual utility-bill savings</span><strong className="mt-1 block text-xl">{energy.annualEnergyCostSavings === null ? "—" : money(energy.annualEnergyCostSavings)}</strong></div>
                          <div className="rounded-xl bg-surface-container-low p-4"><span className="text-xs text-on-surface-variant">Simple payback</span><strong className="mt-1 block text-xl">{energy.simplePaybackYears === null ? "—" : `${energy.simplePaybackYears.toFixed(1)} years`}</strong></div>
                          <div className="rounded-xl bg-surface-container-low p-4"><span className="text-xs text-on-surface-variant">{energy.analysisYears}-year net savings</span><strong className="mt-1 block text-xl">{energy.lifetimeNetSavings === null ? "—" : money(energy.lifetimeNetSavings)}</strong></div>
                        </div>
                        {energy.missingInputs.length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                          <h3 className="font-bold">Add fixture and hours data to calculate kWh</h3>
                          <ul className="mt-2 list-inside list-disc space-y-1">{energy.missingInputs.map((item) => <li key={item}>{item}</li>)}</ul>
                        </div>}
                        {energy.financialMissingInputs.length > 0 && <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low/50 p-4 text-sm text-on-surface-variant">
                          <h3 className="font-bold text-on-surface">Dollar savings and payback are not yet shown</h3>
                          <p className="mt-1">{energy.financialMissingInputs.join(" ")}</p>
                        </div>}
                        {energy.energyReady && <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                          <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant"><tr><th className="px-3 py-3">Line</th><th className="px-3 py-3 text-right">Existing kWh/year</th><th className="px-3 py-3 text-right">Proposed kWh/year</th><th className="px-3 py-3 text-right">Reduction kWh/year</th><th className="px-3 py-3 text-right">Energy bill savings/year</th></tr></thead>
                            <tbody>{energy.lineResults.map((result, index) => <tr key={result.line.id} className="border-t border-outline-variant/15">
                              <td className="px-3 py-3">{result.line.proposedDescription || result.line.existingDescription || `Line ${index + 1}`}</td>
                              <td className="px-3 py-3 text-right">{result.existingAnnualKwh.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td className="px-3 py-3 text-right">{result.proposedAnnualKwh.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td className="px-3 py-3 text-right">{result.annualKwhSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td className="px-3 py-3 text-right">{result.annualEnergyCostSavings === null ? "—" : money(result.annualEnergyCostSavings)}</td>
                            </tr>)}</tbody>
                          </table>
                        </div>}
                        {energy.financialReady && <div className="text-xs leading-relaxed text-on-surface-variant">
                          <p>Annual total savings include {energy.annualDemandCostSavings === null ? "no demand savings (not fully specified)" : `${money(energy.annualDemandCostSavings)} of estimated demand-charge savings`}{energy.annualMaintenanceSavings === null ? " and no maintenance savings." : ` and ${money(energy.annualMaintenanceSavings)} in entered annual maintenance savings.`}</p>
                          {energy.estimatedIncentive !== null && <p className="mt-1">Net investment reflects the entered estimated incentive of {money(energy.estimatedIncentive)}; eligibility and availability must be confirmed.</p>}
                          <p className="mt-1">Payback is a simple estimate using the current quote sell total, less any entered incentive, divided by first-year total savings. Lifetime savings are undiscounted and do not guarantee future rates, operating schedules, rebates, or performance.</p>
                          {energy.annualCarbonReductionTonnes !== null && <p className="mt-1">Estimated net emissions reduction: {energy.annualCarbonReductionTonnes.toFixed(2)} metric tonnes CO₂e/year based on the entered factor; a negative value indicates an increase.</p>}
                        </div>}
                      </section>}
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
