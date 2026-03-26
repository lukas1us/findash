import { z } from "zod";

export const getPricesSchema = z.object({
  assetId: z.string().optional(),
  limit: z.coerce.number().optional().default(50),
  page: z.coerce.number().optional().default(1),
});

export const postPriceSchema = z.object({
  assetId: z.string(),
  price: z.number().positive(),
  date: z.string().datetime(),
  source: z.string().optional(),
});

export const patchPriceSchema = z.object({
  id: z.string(),
  price: z.number().positive(),
});

export const deletePriceSchema = z.object({
  id: z.string(),
});
