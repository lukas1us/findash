// Runs once before all test suites.
// Applies Prisma migrations to the test database.
//
// Prerequisites: create the test DB manually first:
//   psql -U postgres -c "CREATE DATABASE findash_test;"
//
const { execSync } = require("child_process");
const path = require("path");

require("dotenv").config({ path: path.join(process.cwd(), ".env.test") });

module.exports = async function globalSetup() {
  const testDbUrl = process.env.DATABASE_URL_TEST;
  if (!testDbUrl) {
    throw new Error(
      "DATABASE_URL_TEST is not defined in .env.test — cannot run migrations on test DB"
    );
  }

  // Use `db push` (not `migrate deploy`) so the test DB always matches the
  // current schema — even when new fields have been added to schema.prisma
  // without a corresponding migration file yet.
  console.log("\n[jest] Syncing schema to test database (prisma db push)...");
  execSync("npx prisma db push --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: "inherit",
  });
  console.log("[jest] Schema synced.\n");
};
