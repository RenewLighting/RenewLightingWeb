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
