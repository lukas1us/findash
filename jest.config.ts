import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  globalSetup: "<rootDir>/jest.global-setup.js",
  setupFiles: ["<rootDir>/jest.setup.env.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // Redirect the generated Prisma client to a CJS-compatible shim.
    // The generated client.ts uses import.meta.url which TypeScript does not
    // transform to CJS, causing Jest to fail. The shim imports from the
    // internal generated modules directly (they have no import.meta usage).
    "^@/generated/prisma/client$": "<rootDir>/src/lib/prisma-jest-compat.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    // Prisma v7 ships WASM query-compiler helpers as ESM .mjs files.
    // Babel transforms them to CJS so Jest can load them without ESM mode.
    "^.+\\.mjs$": [
      "babel-jest",
      { presets: [["@babel/preset-env", { targets: { node: "current" } }]] },
    ],
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          module: "CommonJS",
          moduleResolution: "node",
          jsx: "react",
          strict: false,
        },
      },
    ],
  },
  // Allow Jest to transform .mjs files from node_modules (Prisma WASM helpers).
  transformIgnorePatterns: [
    "/node_modules/(?!@prisma/client/runtime/.*\\.mjs$)",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "mjs", "jsx", "json"],
  maxWorkers: 1,
};

export default config;
