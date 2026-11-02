export const workIdentifiers = [
  { code: "REPL", description: "Complete fixture replacement", treatment: "Remove existing fixture and install new fixture; include disposal and connections as applicable." },
  { code: "RETRO", description: "Fixture retrofit", treatment: "Retain housing where permitted; replace internal components/lamps; confirm listing and compatibility." },
  { code: "RELAMP", description: "Lamp-only replacement", treatment: "Replace lamps only; include ballast compatibility or bypass labor where applicable." },
  { code: "ADD", description: "Add new fixture", treatment: "New fixture location; include wiring, raceway, circuiting and controls as applicable." },
  { code: "REMOVE", description: "Remove fixture", treatment: "Remove and make safe; identify whether opening is patched or blanked." },
  { code: "RELOC", description: "Relocate fixture", treatment: "Disconnect, relocate and reconnect; include wiring/raceway and patching as applicable." },
  { code: "REPAIR", description: "Repair existing fixture", treatment: "Repair driver, ballast, socket, wiring or other identified component." },
  { code: "CTRL", description: "Lighting controls", treatment: "Controls scope separately itemized; verify applicable code requirements." },
  { code: "PHOT", description: "Photocell", treatment: "Photocell installation/replacement; verify control zoning and compatibility." },
  { code: "OCC", description: "Occupancy/vacancy sensor", treatment: "Sensor installation; verify coverage, timeout and control requirements." },
  { code: "TIME", description: "Time clock / astronomical time switch", treatment: "Schedule-based control; verify programming and backup requirements." },
  { code: "DIM", description: "Dimming control", treatment: "Include compatible dimmable driver and control device." },
  { code: "WIR", description: "Wiring modification", treatment: "New/modified branch wiring; quantify separately." },
  { code: "CIR", description: "New circuit", treatment: "Include panel capacity, breaker, homerun and permit considerations." },
  { code: "DISC", description: "Disconnect/reconnect", treatment: "Electrical disconnect/reconnect associated with equipment or fixture." },
] as const;

export const conditionIdentifiers = [
  { code: "EX-GOOD", description: "Existing - operational", treatment: "Observed operating during audit." },
  { code: "EX-OUT", description: "Existing - non-operational", treatment: "Failed at time of audit; distinguish lamp/driver/ballast/circuit failure." },
  { code: "EX-DMG", description: "Existing - damaged", treatment: "Physical damage; document photos and replacement need." },
  { code: "EX-MISS", description: "Existing - missing", treatment: "Fixture absent from expected location; confirm plans and scope." },
  { code: "EX-UNK", description: "Existing - unverified", treatment: "Unable to test or access; exclude or qualify pending verification." },
] as const;

export type WorkCode = typeof workIdentifiers[number]["code"];
export type ConditionCode = typeof conditionIdentifiers[number]["code"];

export function isWorkCode(value: unknown): value is WorkCode {
  return workIdentifiers.some((item) => item.code === value);
}

export function isConditionCode(value: unknown): value is ConditionCode {
  return conditionIdentifiers.some((item) => item.code === value);
}

export function parseWorkCodes(value: string): WorkCode[] {
  const codes = value.toUpperCase().split(/[,;\s]+/).filter(Boolean);
  return Array.from(new Set(codes.map((code) => {
    if (!isWorkCode(code)) throw new Error(`Unknown work identifier: ${code}`);
    return code;
  })));
}

export function parseConditionCode(value: string): ConditionCode | "" {
  const code = value.trim().toUpperCase();
  if (!code) return "";
  if (!isConditionCode(code)) throw new Error(`Unknown existing-condition identifier: ${code}`);
  return code;
}

export function describeWorkCodes(codes: readonly WorkCode[] = []) {
  return codes.map((code) => {
    const item = workIdentifiers.find((identifier) => identifier.code === code);
    return item ? `${item.code} - ${item.description}` : code;
  }).join("; ");
}

export function describeCondition(code: ConditionCode | "" = "") {
  const item = conditionIdentifiers.find((identifier) => identifier.code === code);
  return item ? `${item.code} - ${item.description}` : code;
}
