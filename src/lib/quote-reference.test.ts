import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateSync } from "node:zlib";

import * as XLSX from "xlsx";

import { inputWattageEntries, searchInputWattage, wattageReference } from "@/lib/input-wattage";
import { calculateEnergySavings, calculateQuote, emptyLine, emptyQuote } from "@/lib/quote";
import { fixtureDescriptionExamples, fixtureTypes, matchesFixtureCategory, matchFixtureDescriptionExamples, relatedFixtureTypes } from "@/lib/quote-fixture-options";
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

test("fixture description autocomplete provides searchable, editable fixture examples", () => {
  assert.ok(fixtureDescriptionExamples.length >= 30);
  assert.ok(fixtureTypes.length >= 30);
  assert.ok(matchFixtureDescriptionExamples("").length > 0);
  assert.ok(matchFixtureDescriptionExamples("2x4").includes("2x4 troffer"));
  assert.ok(matchFixtureDescriptionExamples("LED high bay").includes("LED high-bay fixture"));
  assert.deepEqual(matchFixtureDescriptionExamples("fixture-does-not-exist"), []);
});

test("fixture categories narrow proposed types and suggestions to matching fixture families", () => {
  assert.deepEqual(relatedFixtureTypes("2x4 troffer"), ["2x2 troffer", "2x4 troffer", "1x4 troffer", "Flat panel"]);
  assert.ok(matchesFixtureCategory("LED flat panel", "2x4 troffer"));
  assert.ok(!matchesFixtureCategory("LED high-bay fixture", "2x4 troffer"));
  assert.ok(matchesFixtureCategory("LED high-bay fixture", "High bay"));
  assert.ok(matchesFixtureCategory("LED fixture replacement product", "2x4 troffer"));
  assert.equal(relatedFixtureTypes("Custom existing fixture").length, fixtureTypes.length);
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

test("energy savings require watts and hours, then calculate energy, demand, payback and lifetime transparently", () => {
  const quote = emptyQuote();
  quote.lines = [{
    ...emptyLine(),
    existingDescription: "Existing HID high bay",
    existingWatts: "100W",
    existingQty: 10,
    proposedDescription: "LED high bay",
    proposedWatts: "40W",
    proposedQty: 10,
    productCost: 100,
    laborCost: 20,
  }];
  quote.energyAnalysis = {
    annualOperatingHours: 4000,
    electricityRatePerKwh: 0.15,
    demandChargePerKwMonth: 10,
    demandCoincidencePercent: 50,
    annualMaintenanceSavings: 100,
    estimatedIncentive: null,
    analysisYears: 10,
    electricityEscalationPercent: 0,
    carbonEmissionKgPerKwh: 0.4,
  };
  const energy = calculateEnergySavings(quote);
  assert.equal(energy.energyReady, true);
  assert.equal(energy.financialReady, true);
  assert.equal(energy.annualKwhSavings, 2400);
  assert.equal(energy.annualEnergyCostSavings, 360);
  assert.equal(energy.demandReductionKw, 0.6);
  assert.equal(energy.annualDemandCostSavings, 36);
  assert.equal(energy.annualTotalCostSavings, 496);
  assert.equal(energy.lifetimeCostSavings, 4960);
  assert.equal(energy.annualCarbonReductionTonnes, 0.96);
  assert.equal(energy.simplePaybackYears, calculateQuote(quote).sellTotal / 496);
});

test("energy analysis keeps kWh separate from utility-rate and complete-hours requirements", () => {
  const quote = emptyQuote();
  quote.lines = [{
    ...emptyLine(),
    existingDescription: "Existing fixture",
    existingWatts: "2x32W",
    existingQty: 1,
    proposedDescription: "LED fixture",
    proposedWatts: "20W",
    proposedQty: 1,
  }];
  quote.energyAnalysis.annualOperatingHours = 2000;
  const withoutRate = calculateEnergySavings(quote);
  assert.equal(withoutRate.energyReady, true);
  assert.equal(withoutRate.annualKwhSavings, 88);
  assert.equal(withoutRate.annualEnergyCostSavings, null);
  assert.match(withoutRate.financialMissingInputs.join(" "), /electricity rate/i);

  quote.energyAnalysis.electricityRatePerKwh = 0;
  const withZeroRate = calculateEnergySavings(quote);
  assert.equal(withZeroRate.financialReady, true);
  assert.equal(withZeroRate.annualEnergyCostSavings, 0);

  quote.lines[0].annualOperatingHoursOverride = 1000;
  const withLineOverride = calculateEnergySavings(quote);
  assert.equal(withLineOverride.annualKwhSavings, 44);

  quote.energyAnalysis.electricityRatePerKwh = null;
  quote.lines[0].annualOperatingHoursOverride = null;
  quote.energyAnalysis.annualOperatingHours = null;
  const withoutHours = calculateEnergySavings(quote);
  assert.equal(withoutHours.annualKwhSavings, null);
  assert.match(withoutHours.missingInputs.join(" "), /operating hours/i);
});

test("Excel retains identifiers and references, including unpriced audit lines", () => {
  const quote = emptyQuote();
  quote.lines = [{
    ...emptyLine(),
    fixtureId: "F01",
    existingDescription: "150W Metal Halide",
    existingFixtureType: "High bay",
    existingWatts: "190W",
    existingWattageReference: "Metal_Halide_Old / 150W Metal Halide",
    existingQty: 4,
    annualOperatingHoursOverride: 3500,
    proposedDescription: "LED fixture",
    proposedFixtureType: "High bay",
    proposedWatts: "40W",
    technology: "LED",
    mountingType: "Suspended",
    voltage: "120-277V",
    colorTemperature: "4000K",
    dimming: "0-10V",
    controlType: "Occupancy sensor",
    controlSavingsPercent: 20,
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
  quote.energyAnalysis.annualOperatingHours = 3500;
  quote.energyAnalysis.electricityRatePerKwh = 0.14;
  const bytes = createQuoteWorkbook(quote);
  const workbook = XLSX.read(bytes, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Quote);
  const energyRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Energy Savings"], { header: 1 });
  assert.equal(rows[0]["Work Codes"], "REPL, OCC");
  assert.equal(rows[1]["Condition Code"], "EX-UNK");
  assert.equal(rows[0]["Existing Wattage Reference"], quote.lines[0].existingWattageReference);
  assert.equal(rows[0]["Existing Fixture Type"], "High bay");
  assert.equal(rows[0]["Proposed Fixture Type"], "High bay");
  assert.equal(energyRows[1][1], 3500);
  assert.equal(energyRows[2][1], 0.14);
  const parsed = parseQuoteWorkbook(bytes, "Quote.xlsx");
  assert.ok(parsed.quote);
  assert.equal(parsed.quote.lines.length, 2, "TOTAL must not import as an estimate line");
  assert.deepEqual(parsed.quote.lines[0].workCodes, ["REPL", "OCC"]);
  assert.equal(parsed.quote.lines[0].conditionCode, "EX-OUT");
  assert.equal(parsed.quote.lines[0].existingWattageReference, quote.lines[0].existingWattageReference);
  assert.equal(parsed.quote.energyAnalysis.annualOperatingHours, 3500);
  assert.equal(parsed.quote.energyAnalysis.electricityRatePerKwh, 0.14);
  assert.equal(parsed.quote.lines[0].proposedFixtureType, "High bay");
  assert.equal(parsed.quote.lines[0].annualOperatingHoursOverride, 3500);
  assert.equal(parsed.quote.lines[0].controlSavingsPercent, 20);
  assert.equal(parsed.quote.lines[0].controlType, "Occupancy sensor");
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
    existingFixtureType: "High bay",
    existingDescription: "Metal halide",
    existingWatts: "190W",
    existingQty: 1,
    existingWattageReference: "Metal_Halide_Old / 150W Metal Halide",
    proposedDescription: "LED fixture",
    proposedFixtureType: "High bay",
    technology: "LED",
    mountingType: "Suspended",
    proposedQty: 1,
    proposedWatts: "40W",
    controlSavingsPercent: 10,
    laborCost: 20,
    workCodes: ["REPL"],
    conditionCode: "EX-OUT",
  };
  quote.energyAnalysis.annualOperatingHours = 4000;
  quote.energyAnalysis.electricityRatePerKwh = 0.145;
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
  assert.ok(text.includes("High bay"));
  assert.ok(text.includes("Technology: LED"));
  assert.ok(text.includes("Estimated control savings: 10%"));
  assert.ok(text.includes("Energy savings analysis"));
  assert.ok(text.includes("616"));
});
