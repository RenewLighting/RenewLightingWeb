import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateSync } from "node:zlib";

import * as XLSX from "xlsx";

import { inputWattageEntries, searchInputWattage, wattageReference } from "@/lib/input-wattage";
import { calculateQuote, emptyLine, emptyQuote } from "@/lib/quote";
import { conditionIdentifiers, parseConditionCode, parseWorkCodes, workIdentifiers } from "@/lib/quote-identifiers";
import { createQuoteWorkbook } from "@/lib/quote-workbook";
import { parseQuoteWorkbook } from "@/lib/quote-workbook-import";
import { createQuoteProposalPdf } from "@/lib/quote-proposal-pdf";

test("the supplied wattage reference retains all 173 entries, decimals and zero watts", () => {
  assert.equal(inputWattageEntries.length, 173);
  assert.ok(inputWattageEntries.every((entry) => Number.isFinite(entry.watts) && entry.watts >= 0));
  assert.equal(new Set(inputWattageEntries.map(wattageReference)).size, 173);
  assert.ok(wattageReference(inputWattageEntries[0]).includes("Input Wattage Table.xlsx (workbook modified 2025-04-24)"));
  assert.equal(searchInputWattage("PL-13", "Fluorescent_Lamp_Old")[0].watts, 15.9);
  assert.equal(searchInputWattage("Nuclear")[0].watts, 0);
  assert.equal(searchInputWattage("150W Metal Halide")[0].watts, 190);
  assert.equal(searchInputWattage("no-such-fixture").length, 0);
});

test("the PNG identifiers stay distinct and reject unknown codes", () => {
  assert.equal(workIdentifiers.length, 15);
  assert.equal(conditionIdentifiers.length, 5);
  assert.deepEqual(parseWorkCodes("repl, OCC; repl"), ["REPL", "OCC"]);
  assert.equal(parseConditionCode(" ex-out "), "EX-OUT");
  assert.deepEqual(parseWorkCodes(""), []);
  assert.equal(parseConditionCode(""), "");
  assert.throws(() => parseWorkCodes("EX-GOOD"), /Unknown work identifier/);
  assert.throws(() => parseConditionCode("REPL"), /Unknown existing-condition identifier/);
});

test("identifiers and reference selection do not change existing pricing", () => {
  const quote = emptyQuote();
  quote.lines[0] = { ...quote.lines[0], proposedQty: 4, productCost: 45, laborCost: 20 };
  const original = calculateQuote(quote);
  const annotated = structuredClone(quote);
  annotated.lines[0] = {
    ...annotated.lines[0],
    workCodes: ["REPL", "OCC"],
    conditionCode: "EX-OUT",
    existingWattageReference: wattageReference(inputWattageEntries[0]),
  };
  assert.equal(calculateQuote(annotated).sellTotal, original.sellTotal);
  assert.equal(calculateQuote(annotated).directCost, original.directCost);
});

test("Excel retains identifiers and references, including unpriced audit lines", () => {
  const quote = emptyQuote();
  quote.lines = [{
    ...emptyLine(),
    fixtureId: "F01",
    existingDescription: "150W Metal Halide",
    existingWatts: "190W",
    existingWattageReference: "Metal_Halide_Old / 150W Metal Halide",
    existingQty: 4,
    proposedDescription: "LED fixture",
    proposedWatts: "40W",
    proposedQty: 4,
    productCost: 45,
    laborCost: 20,
    workCodes: ["REPL", "OCC"],
    conditionCode: "EX-OUT",
  }, {
    ...emptyLine(),
    fixtureId: "F02",
    existingDescription: "Unverified fixture",
    conditionCode: "EX-UNK",
  }];
  const bytes = createQuoteWorkbook(quote);
  const workbook = XLSX.read(bytes, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Quote);
  assert.equal(rows[0]["Work Codes"], "REPL, OCC");
  assert.equal(rows[1]["Condition Code"], "EX-UNK");
  assert.equal(rows[0]["Existing Wattage Reference"], quote.lines[0].existingWattageReference);
  const parsed = parseQuoteWorkbook(bytes, "Quote.xlsx");
  assert.ok(parsed.quote);
  assert.equal(parsed.quote.lines.length, 2, "TOTAL must not import as an estimate line");
  assert.deepEqual(parsed.quote.lines[0].workCodes, ["REPL", "OCC"]);
  assert.equal(parsed.quote.lines[0].conditionCode, "EX-OUT");
  assert.equal(parsed.quote.lines[0].existingWattageReference, quote.lines[0].existingWattageReference);
  assert.equal(parsed.quote.lines[0].laborCost, 20, "Import unit labor, not extended labor");
  assert.equal(parsed.quote.lines[0].proposedQty, 4);
  assert.equal(parsed.quote.lines[1].conditionCode, "EX-UNK");
});

test("legacy quote lines without reference fields still export and import", () => {
  const quote = emptyQuote();
  const line = quote.lines[0];
  delete line.workCodes;
  delete line.conditionCode;
  delete line.existingWattageReference;
  line.proposedDescription = "Legacy fixture";
  line.proposedQty = 2;
  line.laborCost = 10;
  const parsed = parseQuoteWorkbook(createQuoteWorkbook(quote), "Legacy.xlsx");
  assert.ok(parsed.quote);
  assert.deepEqual(parsed.quote.lines[0].workCodes, []);
  assert.equal(parsed.quote.lines[0].conditionCode, "");
  assert.equal(parsed.quote.lines[0].existingWattageReference, "");
});

test("customer proposal PDF includes work, condition and existing input watts", async () => {
  const quote = emptyQuote();
  quote.lines[0] = {
    ...quote.lines[0],
    existingDescription: "Metal halide",
    existingWatts: "190W",
    existingWattageReference: "Metal_Halide_Old / 150W Metal Halide",
    proposedDescription: "LED fixture",
    proposedQty: 1,
    laborCost: 20,
    workCodes: ["REPL"],
    conditionCode: "EX-OUT",
  };
  const pdf = await createQuoteProposalPdf(quote, "quote-test@renewlighting.com");
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  const source = pdf.toString("latin1");
  const streams = Array.from(source.matchAll(/<<([^<>]*)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g));
  const text = streams.filter((stream) => /\/FlateDecode/.test(stream[1]) && !/\/Subtype \/Image/.test(stream[1]))
    .map((stream) => inflateSync(Buffer.from(stream[2], "latin1")).toString("latin1"))
    .flatMap((stream) => Array.from(stream.matchAll(/<([0-9a-f]+)>/gi)))
    .map((match) => Buffer.from(match[1], "hex").toString("latin1")).join("");
  assert.ok(text.includes("REPL"));
  assert.ok(text.includes("EX-OUT"));
  assert.ok(text.includes("190W"));
  assert.ok(text.includes("Metal_Halide_Old"));
});
