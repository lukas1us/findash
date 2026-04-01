---
name: new-api-endpoint
description: >
  This skill should be used when the user asks to "add a new API endpoint",
  "scaffold a route", "create a new resource endpoint", "add a [resource] API",
  or "create a route for [something]". Use it for any new Next.js API route
  in the FinDash project.
version: 0.1.0
---

# Scaffold a new API endpoint (FinDash conventions)

## Step 1 — Gather inputs

Before writing any code, ask the user for:

1. **Domain** — which area does this belong to?
   - `finance` (accounts, transactions, categories, budgets)
   - `investments` (assets, purchases, prices)
   - `net-worth`
   - other (specify)
2. **Resource name** — singular, lowercase (e.g. `tag`, `goal`, `note`)
3. **HTTP methods needed** — which of: GET (list), POST (create), GET by ID, PUT (update), DELETE
4. **Prisma model name** — the exact model name in `prisma/schema.prisma` (e.g. `Tag`)
5. **Fields** — list required and optional fields with their types

Do not proceed without these inputs.

---

## Step 2 — Create Zod validator

**File:** `src/lib/validators/[domain]/[resource].ts`

Reference: `src/lib/validators/investments/prices.ts`

```ts
import { z } from "zod";

// For GET with query params
export const get[Resource]Schema = z.object({
  // use .coerce.number() for numeric query params
  // use .optional() and .default() for optional fields
});

// For POST body
export const post[Resource]Schema = z.object({
  // required fields without .optional()
  // optional fields with .optional()
});

// For PATCH/PUT body
export const patch[Resource]Schema = z.object({
  id: z.string(),
  // updatable fields
});

// For DELETE (query param)
export const delete[Resource]Schema = z.object({
  id: z.string(),
});
```

Rules:
- Query param numbers: `z.coerce.number()`
- Optional with default: `.optional().default(value)`
- Positive numbers: `.positive()`
- ISO dates: `.datetime()`

---

## Step 3 — Create route file

**File:** `src/app/api/[domain]/[resource]/route.ts`

```ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  get[Resource]Schema,
  post[Resource]Schema,
} from "@/lib/validators/[domain]/[resource]";

// Always include this helper when using Zod
function validationError(error: ZodError) {
  const first = error.issues[0];
  const field = first?.path[0]?.toString();
  return NextResponse.json(
    { error: first?.message ?? "Validation error", ...(field ? { field } : {}) },
    { status: 400 }
  );
}

// Include this helper when using PUT or DELETE
function isNotFound(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025"
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = Object.fromEntries(searchParams.entries());
  const result = get[Resource]Schema.safeParse(raw);
  if (!result.success) return validationError(result.error);

  const items = await prisma.[model].findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const result = post[Resource]Schema.safeParse(body);
  if (!result.success) return validationError(result.error);

  const created = await prisma.[model].create({ data: result.data });
  return NextResponse.json(created, { status: 201 });
}
```

Response code rules:
- GET list → 200
- POST (created) → 201
- PUT (updated) → 200
- DELETE → 204 via `new NextResponse(null, { status: 204 })`
- Not found → 404
- Validation error → 400

---

## Step 4 — Create `[id]/route.ts` (when GET by ID / PUT / DELETE are needed)

**File:** `src/app/api/[domain]/[resource]/[id]/route.ts`

```ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

function isNotFound(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025"
  );
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await prisma.[model].findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  try {
    const updated = await prisma.[model].update({ where: { id }, data: { ...body } });
    return NextResponse.json(updated);
  } catch (err) {
    if (isNotFound(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.[model].delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (isNotFound(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
```

---

## Step 5 — Create test file

**File:** `__tests__/api/[domain]/[resource].test.ts`

```ts
import { clearFinance, testDb } from "../../helpers/db";
// use clearInvestments() for investments domain
import { createTestXxx } from "../../helpers/factories";
import { GET, POST } from "@/app/api/[domain]/[resource]/route";
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from "@/app/api/[domain]/[resource]/[id]/route";

const BASE = "http://localhost:3000";

function req(path: string, init?: RequestInit) {
  return new Request(`${BASE}${path}`, init);
}

function jsonReq(path: string, method: string, body: unknown) {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await clearFinance(); // or clearInvestments()
});

describe("GET /api/[domain]/[resource]", () => {
  it("returns empty array when nothing exists", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns list with correct fields", async () => {
    await createTestXxx({ name: "Test" });
    const res = await GET();
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: expect.any(String), name: "Test" });
  });
});

describe("POST /api/[domain]/[resource]", () => {
  it("creates with valid data → 201", async () => {
    const res = await POST(
      jsonReq("/api/[domain]/[resource]", "POST", { name: "New Item" })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toMatchObject({ id: expect.any(String), name: "New Item" });
  });

  it("fails without required field → 400", async () => {
    const res = await POST(
      jsonReq("/api/[domain]/[resource]", "POST", {})
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/[domain]/[resource]/[id]", () => {
  it("returns item by id", async () => {
    const item = await createTestXxx({ name: "By ID" });
    const res = await GET_BY_ID(req(`/api/[domain]/[resource]/${item.id}`), {
      params: { id: item.id },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(item.id);
  });

  it("returns 404 for unknown id", async () => {
    const res = await GET_BY_ID(req("/api/[domain]/[resource]/nope"), {
      params: { id: "nope" },
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/[domain]/[resource]/[id]", () => {
  it("deletes → 204", async () => {
    const item = await createTestXxx();
    const res = await DELETE(
      req(`/api/[domain]/[resource]/${item.id}`, { method: "DELETE" }),
      { params: { id: item.id } }
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 for unknown id", async () => {
    const res = await DELETE(
      req("/api/[domain]/[resource]/nope", { method: "DELETE" }),
      { params: { id: "nope" } }
    );
    expect(res.status).toBe(404);
  });
});
```

Test helper imports available in `__tests__/helpers/`:
- `db.ts` → `testDb`, `clearFinance()`, `clearInvestments()`, `clearAll()`
- `factories.ts` → `createTestAccount`, `createTestCategory`, `createTestTransaction`, `createTestAsset`, `createTestPurchase`, `createTestPrice`, `createTestCryptoTransaction`

If no suitable factory exists, create the record directly via `testDb.[model].create()`.

---

## Step 6 — Run tests and fix failures

```bash
npm test
```

Do not mark the task done until all tests pass. Fix any failures before proceeding.

---

## Step 7 — Commit

```bash
git add -A
git commit -m "feat: add [resource] API endpoint"
```
