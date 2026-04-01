# CLAUDE.md — FinDash Development Guidelines

## Project overview
FinDash is a personal finance and investment tracker built with Next.js 14, Prisma, PostgreSQL, and Tailwind CSS. This file defines rules Claude Code must follow in every development session.

---

## Mandatory workflow — after EVERY change

### 1. Run tests
After every code change, run:
```bash
npm test
```

Rules:
- If all tests pass → proceed and confirm the task as done
- If any test fails → fix the failure before marking the task complete
- Do not ask for permission to fix failing tests — just fix them
- Do not mark a task as done if any test is failing
- If a fix introduces new failures, fix those too before proceeding

### 2. Update README.md
After every change, open README.md and ask:
- Does this change affect setup steps?
- Does this change affect environment variables?
- Does this change affect available scripts?
- Does this change affect APIs?
- Does this change affect Docker setup?

If yes to any → update README.md before confirming the task as done.

---

## Git workflow

### Commit after every completed task
After tests pass and README is reviewed, always commit:
```bash
git add -A
git commit -m "<type>: <short description>"
```

Commit message types:
- feat: new feature
- fix: bug fix
- refactor: code change without behavior change
- test: adding or updating tests
- chore: dependencies, config, tooling
- docs: documentation only

Examples:
```
feat: add CSV import for Air Bank
fix: correct account balance recalculation on transaction delete
test: add API tests for investments/purchases
docs: update README with ECB API setup
```

---

## Code rules

### API routes

Every route validates input with Zod before touching the DB.
Import schemas from `src/lib/validators/`. Never use `request.json()` directly without parsing through a Zod schema.

**Mandatory pattern:**
\```typescript
import { mySchema } from "@/lib/validators/my-validator";

const body = await request.json();
const parsed = mySchema.safeParse(body);
if (!parsed.success) {
  const field = parsed.error.errors[0]?.path[0]?.toString();
  return NextResponse.json(
    { error: parsed.error.errors[0]?.message ?? "Invalid input", field },
    { status: 400 }
  );
}
// Use parsed.data from here
\```

### Database
- Never write raw SQL — use Prisma client
- Every schema change requires a new migration: `npx prisma migrate dev --name description`
- Never edit existing migrations — always create new ones
- After schema change, regenerate client: `npx prisma generate`

### Environment variables
- Never hardcode URLs, secrets, or API keys
- All new env vars must be added to `.env.example` with a placeholder value and a comment explaining what it is

---

## External APIs

### CoinGecko (crypto prices)
- Base URL: https://api.coingecko.com/api/v3
- No API key required for free tier
- Rate limit: 30 req/min — always cache results in ExchangeRate table
- In tests: always mock, never call real API

### ECB (exchange rates)
- Base URL: https://data-api.ecb.europa.eu/service/data/EXR
- No API key required
- If date not found (weekend/holiday) → retry up to 3 previous days
- Cache in ExchangeRate table (currency + date = unique)
- In tests: always mock, never call real API

---

## Adding a new import parser

Follow these steps every time you add support for a new CSV or PDF export format.
Do not skip steps — each one is required for the feature to work end-to-end.

### Before writing any code — gather inputs

Ask the user to provide:
1. A real header line from the file
2. At least 2–5 example data rows (including edge cases: missing fields, zero amounts, fees)
3. Whether this is a finance CSV, crypto CSV, or bank PDF

Do not proceed without these inputs.

### Implementation checklist

- [ ] **1. Create the parser module**
  - Finance CSV → `src/lib/csv-parsers/<bank-name>.ts`
  - Crypto CSV → `src/lib/crypto-parsers/<exchange-name>.ts`
  - Bank PDF → `src/lib/pdf-parsers/<bank-name>.ts`
  - Output rows must match the existing preve (including `rowIndex` and `parseError`)

- [ ] **2. Update format detection**
  - Finance CSV → `src/lib/csv-parsers/detect.ts`
  - Crypto CSV → `src/lib/crypto-parsers/detect.ts`
  - Add a condition that uniquely identifies the new format (prefer header signature over filename)

- [ ] **3. Update barrel exports**
  - Finance CSV → `src/lib/csv-parsers/index.ts`
  - Crypto CSV → `src/lib/crypto-parsers/index.ts`

- [ ] **4. Add fixture and tests**
  - Drop a fixture file in `mock_csvs/<bank-or-exchange-name>/` using the example rows provided by the user
  - Add test cases in `__tests__/csv/parsing.test.ts`:
    - Happy path: all fields present
    - Edge cases from the provided examples (missing fields, fees, zero amounts)
    - Unknown format: file that should NOT match this parser

- [ ] **5. Verify preview/confirm routing**
  - Check `src/app/api/import/preview/route.ts` and `src/app/api/import/confirm/route.ts`
  - If the new format requires different field mapping or transaction type logic, ue route
  - Do the same for crypto import routes if applicable

- [ ] **6. Run tests and confirm**
  - `npm test` must pass before marking the task done
  - Commit with: `feat: add <format-name> import parser`

---

## Definition of done
A task is complete when:
- [ ] Feature works as described
- [ ] All tests pass (`npm test`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] README.md reviewed and updated if needed
- [ ] Changes committed with descriptive commit message
