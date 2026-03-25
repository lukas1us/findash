// Runs after Jest is installed but before each test file.

// Reset the Prisma global singleton so each test file gets a fresh client
// pointed at the test DB (DATABASE_URL already overridden in jest.setup.env.ts).
const g = globalThis as Record<string, unknown>;
g.prisma = undefined;

// Disconnect the Prisma client (and its underlying pg Pool) after each test
// file completes — prevents Jest from hanging on open handles.
afterAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
});
