import type { Category } from "@/generated/prisma/client";

type KeywordRule = {
  keywords: string[];
  hints: string[]; // partial category name matches (case-insensitive)
};

const KEYWORD_RULES: KeywordRule[] = [
  {
    keywords: ["albert", "billa", "lidl", "kaufland", "penny", "tesco", "globus", "coop"],
    hints: ["jídlo", "potraviny", "food", "groceries", "supermarket", "nákup"],
  },
  {
    keywords: ["čez", "eon", "e.on", "plyn", "energie", "innogy", "pražská energetika", "prazska energetika"],
    hints: ["bydlení", "energie", "nájem", "utilities", "nájemné"],
  },
  {
    keywords: ["spotify", "netflix", "apple", "google play", "hbo", "disney", "youtube"],
    hints: ["ostatní", "entertainment", "zábava", "předplatné", "subscription", "volný čas"],
  },
  {
    keywords: ["benzin", "benzín", "shell", "omv", "čepro", "mol", "tank", "nafta"],
    hints: ["doprava", "transport", "pohonné hmoty", "auto", "cestování"],
  },
];

/**
 * Suggests a categoryId from the user's categories based on keyword matching
 * in the transaction description. Returns undefined if no match is found.
 */
export function suggestCategory(
  description: string,
  categories: Category[]
): string | undefined {
  const desc = description.toLowerCase();

  for (const rule of KEYWORD_RULES) {
    if (!rule.keywords.some((kw) => desc.includes(kw))) continue;

    for (const hint of rule.hints) {
      const match = categories.find((c) => c.name.toLowerCase().includes(hint));
      if (match) return match.id;
    }
  }

  return undefined;
}
