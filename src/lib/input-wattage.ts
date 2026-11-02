import entries from "@/lib/input-wattage-data.json";

export type InputWattageEntry = {
  category: string;
  description: string;
  watts: number;
};

export const inputWattageEntries: readonly InputWattageEntry[] = entries;
export const inputWattageSource = {
  name: "Input Wattage Table.xlsx",
  workbookModified: "2025-04-24",
  imported: "2026-11-02",
};

export function wattageReference(entry: InputWattageEntry) {
  return `${inputWattageSource.name} (workbook modified ${inputWattageSource.workbookModified}) / ${entry.category} / ${entry.description}`;
}

export function wattageCategoryLabel(category: string) {
  return category.replace(/_Old$/, "").replaceAll("_", " ");
}

export function searchInputWattage(query: string, category = "") {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return inputWattageEntries.filter((entry) => {
    if (category && entry.category !== category) return false;
    const text = `${entry.category.replaceAll("_", " ")} ${entry.description} ${entry.watts}W`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
