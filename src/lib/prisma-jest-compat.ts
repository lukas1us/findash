// @ts-nocheck
/**
 * Jest/CJS compatibility shim for @/generated/prisma/client.
 *
 * The generated client.ts sets globalThis.__dirname via import.meta.url,
 * which TypeScript does not transform when targeting CommonJS, causing Jest
 * to fail with "Cannot use 'import.meta' outside a module".
 *
 * This shim provides identical exports by importing from the internal
 * generated modules directly (they contain no import.meta usage).
 *
 * Mapped via moduleNameMapper in jest.config.ts — production code always
 * uses @/generated/prisma/client directly.
 */

// In CommonJS, __dirname is already in scope — no import.meta needed.
if (typeof globalThis["__dirname"] === "undefined") {
  globalThis["__dirname"] = __dirname;
}

export * from "@/generated/prisma/enums";
export * as $Enums from "@/generated/prisma/enums";

import * as $Class from "@/generated/prisma/internal/class";
import * as Prisma from "@/generated/prisma/internal/prismaNamespace";

export const PrismaClient = $Class.getPrismaClientClass();
export { Prisma };
