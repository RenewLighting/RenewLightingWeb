export const fixtureTypes = [
  "2x2 troffer",
  "2x4 troffer",
  "1x4 troffer",
  "Flat panel",
  "Linear strip",
  "Wraparound",
  "High bay",
  "Low bay",
  "Downlight / recessed can",
  "Track light",
  "Wall sconce",
  "Vanity light",
  "Undercabinet",
  "Area / pole light",
  "Flood / security light",
  "Wall pack",
  "Canopy / garage",
  "Bollard / pathway",
  "Landscape",
  "Roadway / street",
  "Parking garage",
  "Sports lighting",
  "Tunnel",
  "Hazardous location",
  "Vaportight",
  "Pool / spa",
  "Exit sign",
  "Emergency lighting",
  "Sign lighting",
  "Lamp / retrofit kit",
  "Multifamily",
  "Other / custom",
] as const;

const fixtureDescriptionTypePatterns: Array<[RegExp, (description: string) => string]> = [
  [/\b2\s*[x×]\s*2\b/, () => "2x2 troffer"],
  [/\b2\s*[x×]\s*4\b/, () => "2x4 troffer"],
  [/\b1\s*[x×]\s*4\b/, () => "1x4 troffer"],
  [/\bflat\s*panel\b|\bpanel\s*light\b/, () => "Flat panel"],
  [/\bhigh[\s-]*bay\b/, () => "High bay"],
  [/\blow[\s-]*bay\b/, () => "Low bay"],
  [/\b(troffer|lay[\s-]*in)\b/, () => "2x4 troffer"],
  [/\b(strip|linear)\b/, () => "Linear strip"],
  [/\bwrap[\s-]*around\b/, () => "Wraparound"],
  [/\b(downlight|recessed|can light)\b/, () => "Downlight / recessed can"],
  [/\btrack\b/, () => "Track light"],
  [/\bsconce\b/, () => "Wall sconce"],
  [/\bvanity\b/, () => "Vanity light"],
  [/\bunder[\s-]*cabinet\b/, () => "Undercabinet"],
  [/\b(area light|pole light)\b/, () => "Area / pole light"],
  [/\b(flood|security light)\b/, () => "Flood / security light"],
  [/\bwall[\s-]*pack\b/, () => "Wall pack"],
  [/\b(canopy|garage)\b/, () => "Canopy / garage"],
  [/\b(bollard|pathway)\b/, () => "Bollard / pathway"],
  [/\blandscape\b/, () => "Landscape"],
  [/\b(roadway|streetlight|street light)\b/, () => "Roadway / street"],
  [/\bparking garage\b/, () => "Parking garage"],
  [/\bsports lighting\b/, () => "Sports lighting"],
  [/\btunnel\b/, () => "Tunnel"],
  [/\bhazardous\b/, () => "Hazardous location"],
  [/\bvaportight\b/, () => "Vaportight"],
  [/\b(pool|spa)\b/, () => "Pool / spa"],
  [/\bexit sign\b/, () => "Exit sign"],
  [/\bemergency\b/, () => "Emergency lighting"],
  [/\bsign\b/, () => "Sign lighting"],
  [/\b(lamp|retrofit|retrofit kit)\b/, () => "Lamp / retrofit kit"],
  [/\bmultifamily\b/, () => "Multifamily"],
];

export function inferFixtureType(description: string) {
  const normalized = description.toLocaleLowerCase().replace(/[_/]+/g, " ");
  return fixtureDescriptionTypePatterns.find(([pattern]) => pattern.test(normalized))?.[1](description) ?? "";
}

const fixtureTypeFamilies: Record<string, string> = {
  "2x2 troffer": "troffer",
  "2x4 troffer": "troffer",
  "1x4 troffer": "troffer",
  "Flat panel": "troffer",
  "Linear strip": "linear",
  "Wraparound": "linear",
  "High bay": "bay",
  "Low bay": "bay",
  "Downlight / recessed can": "downlight",
  "Track light": "track",
  "Wall sconce": "interior",
  "Vanity light": "interior",
  Undercabinet: "interior",
  "Area / pole light": "site",
  "Flood / security light": "site",
  "Wall pack": "site",
  "Canopy / garage": "site",
  "Bollard / pathway": "site",
  Landscape: "site",
  "Roadway / street": "site",
  "Parking garage": "site",
  "Sports lighting": "site",
  Tunnel: "site",
  "Hazardous location": "specialty",
  Vaportight: "specialty",
  "Pool / spa": "specialty",
  "Exit sign": "life-safety",
  "Emergency lighting": "life-safety",
  "Sign lighting": "sign",
  "Lamp / retrofit kit": "retrofit",
  Multifamily: "interior",
};

const fixtureDescriptionFamilyTerms: Record<string, string[]> = {
  troffer: ["troffer", "panel"],
  linear: ["linear", "strip", "wraparound"],
  bay: ["high bay", "high-bay", "low bay", "low-bay"],
  downlight: ["downlight", "recessed", "can light"],
  track: ["track"],
  interior: ["sconce", "vanity", "undercabinet", "multifamily", "common-area"],
  site: ["area light", "pole light", "floodlight", "flood light", "security light", "wall pack", "canopy", "bollard", "pathway", "landscape", "roadway", "streetlight", "parking garage", "sports lighting", "tunnel"],
  specialty: ["hazardous", "vaportight", "pool", "spa"],
  "life-safety": ["exit sign", "emergency"],
  sign: ["sign light"],
  retrofit: ["lamp", "retrofit"],
};

export function fixtureCategoryFamily(value: string) {
  const normalized = value.trim().toLocaleLowerCase();
  const matchedType = fixtureTypes.find((type) => type.toLocaleLowerCase() === normalized);
  if (matchedType) return fixtureTypeFamilies[matchedType] ?? null;

  for (const [family, terms] of Object.entries(fixtureDescriptionFamilyTerms)) {
    if (terms.some((term) => normalized.includes(term))) return family;
  }
  return null;
}

export function relatedFixtureTypes(category: string) {
  const family = fixtureCategoryFamily(category);
  return family
    ? fixtureTypes.filter((type) => fixtureTypeFamilies[type] === family)
    : fixtureTypes;
}

export function matchesFixtureCategory(candidate: string, category: string) {
  const family = fixtureCategoryFamily(category);
  const candidateFamily = fixtureCategoryFamily(candidate);
  return !family || !candidateFamily || candidateFamily === family;
}

export const fixtureDescriptionExamples = [
  "1x4 troffer",
  "2x2 troffer",
  "2x4 troffer",
  "LED flat panel",
  "Fluorescent troffer",
  "Linear strip fixture",
  "LED wraparound fixture",
  "LED high-bay fixture",
  "Metal-halide high-bay fixture",
  "Low-bay fixture",
  "Recessed LED downlight",
  "Track lighting fixture",
  "Wall sconce",
  "Vanity fixture",
  "Undercabinet light",
  "LED area light",
  "Metal-halide area light",
  "LED floodlight",
  "Wall pack",
  "Canopy light",
  "Bollard light",
  "Landscape light",
  "Roadway / streetlight",
  "Parking garage fixture",
  "Sports lighting fixture",
  "Tunnel light",
  "Hazardous-location fixture",
  "Vaportight fixture",
  "Pool / spa light",
  "Exit sign",
  "Emergency light",
  "Sign light",
  "Fluorescent lamp",
  "LED retrofit kit",
  "Multifamily common-area fixture",
  "Lighting control / occupancy sensor",
] as const;

export function matchFixtureDescriptionExamples(query: string, limit = 8) {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const matches = fixtureDescriptionExamples.filter((description) => {
    const normalized = description.toLowerCase();
    return terms.every((term) => normalized.includes(term));
  });
  return (matches.length ? matches : query.trim() ? [] : [...fixtureDescriptionExamples]).slice(0, limit);
}

export const lightingTechnologies = [
  "LED",
  "Fluorescent",
  "Metal halide",
  "High-pressure sodium",
  "Mercury vapor",
  "Incandescent / halogen",
  "Induction",
  "Other / custom",
] as const;

export const mountingTypes = [
  "Recessed",
  "Surface",
  "Suspended",
  "Pendant",
  "Wall-mounted",
  "Pole-mounted",
  "Canopy-mounted",
  "Retrofit existing housing",
  "In-ground",
  "Landscape stake",
  "Other / custom",
] as const;

export const lightDistributions = [
  "Type I",
  "Type II",
  "Type III",
  "Type IV",
  "Type V",
  "Narrow",
  "Medium",
  "Wide",
  "Symmetric",
  "Asymmetric",
  "Wall wash",
  "Flood",
  "Spot",
  "Other / custom",
] as const;

export const voltageOptions = [
  "120V",
  "120-277V",
  "208V",
  "240V",
  "277V",
  "347V",
  "480V",
  "12/24V",
  "Other / custom",
] as const;

export const colorTemperatureOptions = [
  "2700K",
  "3000K",
  "3500K",
  "4000K",
  "5000K",
  "5700K",
  "6500K",
  "Tunable white",
  "Other / custom",
] as const;

export const dimmingOptions = [
  "Non-dimming",
  "0-10V",
  "Phase dimming",
  "DALI",
  "Step dimming",
  "Wireless / networked",
  "Other / custom",
] as const;

export const controlOptions = [
  "None",
  "Occupancy sensor",
  "Vacancy sensor",
  "Daylight / photocell",
  "Time clock",
  "Astronomical time clock",
  "Bi-level control",
  "Networked lighting controls",
  "Other / custom",
] as const;
