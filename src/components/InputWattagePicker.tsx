"use client";

import { useState } from "react";

import {
  inputWattageEntries,
  inputWattageSource,
  searchInputWattage,
  wattageCategoryLabel,
  type InputWattageEntry,
} from "@/lib/input-wattage";

const categories = Array.from(new Set(inputWattageEntries.map((entry) => entry.category)));

export default function InputWattagePicker({
  onSelect,
}: {
  onSelect: (entry: InputWattageEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState(false);
  const matches = searchInputWattage(query, category);

  return (
    <details
      className="mt-3 rounded-xl border border-outline-variant/20 bg-white p-3"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-xs font-bold text-primary">
        Look up existing input wattage
      </summary>
      {open && <>
      <p className="mt-2 text-xs text-on-surface-variant">
        {inputWattageEntries.length} entries from the supplied {inputWattageSource.name}
        {" "}(workbook modified {inputWattageSource.workbookModified}). Reference
        values only; verify the installed lamp/ballast system or measured input.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold">
          Search wattage reference
          <input
            type="search"
            className="mt-1 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. 4 lamp T8, 400W metal halide"
          />
        </label>
        <label className="text-xs font-semibold">
          Fixture category
          <select
            className="mt-1 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>{wattageCategoryLabel(value)}</option>
            ))}
          </select>
        </label>
      </div>
      <p role="status" className="my-2 text-xs text-on-surface-variant">
        {matches.length} matching reference{matches.length === 1 ? "" : "s"}.
        Select one to replace this line&apos;s existing description and watts.
      </p>
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {matches.map((entry) => (
          <button
            key={`${entry.category}/${entry.description}`}
            type="button"
            className="flex w-full items-start justify-between gap-3 rounded-lg border border-outline-variant/20 p-2 text-left text-xs hover:bg-primary/[0.05]"
            onClick={() => onSelect(entry)}
          >
            <span>
              <span className="block font-semibold">{entry.description}</span>
              <span className="text-on-surface-variant">{wattageCategoryLabel(entry.category)}</span>
            </span>
            <strong className="shrink-0 text-primary">{entry.watts} W input</strong>
          </button>
        ))}
        {matches.length === 0 && (
          <p className="py-2 text-xs text-on-surface-variant">
            No reference matches. Try fewer search terms or enter verified watts manually.
          </p>
        )}
      </div>
      </>}
    </details>
  );
}
