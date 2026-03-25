// Runs after Jest is installed but before each test file.
// Reset the Prisma global singleton so each test file gets a fresh client
// pointed at the test DB (DATABASE_URL already overridden in jest.setup.env.ts).
const g = globalThis as Record<string, unknown>;
g.prisma = undefined;
