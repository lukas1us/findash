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

### Branch naming
```
feature/short-description     # new features
fix/short-description         # bug fixes
refactor/short-description    # refactoring without behavior change
chore/short-description       # deps, config, tooling
```

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

### Never commit
- Failing tests
- .env files (check .gitignore)
- node_modules
- Build artifacts (.next/)

---

## Code rules

### TypeScript
- No implicit any — always type function parameters and return values
- Use Prisma generated types — do not redefine DB model types manually
- Use zod for all API input validation

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

## Project structure conventions
```
app/
  api/              # API routes only — no business logic
  (pages)/          # Next.js pages
lib/
  prisma.ts         # Prisma client singleton
  validators/       # Zod schemas
  services/         # Business logic (balance recalculation, price fetching etc.)
  utils/            # Pure utility functions
__tests__/
  api/              # API route tests mirroring app/api/ structure
```

Rules:
- API routes call services — they do not contain business logic directly
- Services are pure functions where possible — easier to test
- Utils have no side effects and no DB access

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

## Docker
- Development: `docker-compose up`
- DB only: `docker-compose up postgres`
- After pulling changes: `docker-compose down && docker-compose up --build`
- Never run `docker-compose down -v` without explicit user confirmation — it deletes DB data

---

## Definition of done
A task is complete when:
- [ ] Feature works as described
- [ ] All tests pass (`npm test`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] README.md reviewed and updated if needed
- [ ] Changes committed with descriptive commit message
