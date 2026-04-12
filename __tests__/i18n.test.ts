import { translations } from "@/lib/i18n/translations";

function getLeafKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, val]) =>
    getLeafKeys(val, prefix ? `${prefix}.${key}` : key)
  );
}

describe("i18n translations key parity", () => {
  it("cs and en have identical leaf key sets", () => {
    const csKeys = getLeafKeys(translations.cs).sort();
    const enKeys = getLeafKeys(translations.en).sort();

    const missingInEn = csKeys.filter((k) => !enKeys.includes(k));
    const missingInCs = enKeys.filter((k) => !csKeys.includes(k));

    expect(missingInEn).toEqual([]);
    expect(missingInCs).toEqual([]);
  });
});
