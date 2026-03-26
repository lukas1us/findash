# Scaffold a new API endpoint

Use this command when adding a new endpoint to the project.
Before starting, ask the user for:
1. The endpoint path (e.g. `investments/portfolios`)
2. Which HTTP methods are needed (GET / POST / PATCH / DELETE)
3. The Prisma model name this endpoint operates on
4. The shape of request inputs (query params for GET/DELETE, body fields for POST/PATCH)

Do not generate any files until you have all four answers.

---

## Files to create

### 1. `src/lib/validators/<path>.ts`

Create this file first. One named Zod schema per method following this pattern:
```typescript
import { z } from "zod";

export const get<Model>Schema z.object({
  // query params — use z.coerce.number() for numeric params
});

export const post<Model>Schema = z.object({
  // required body fields
});

export const patch<Model>Schema = z.object({
  id: z.string().min(1, "id is required"),
  // updatable fields
});

export const delete<Model>Schema = z.object({
  id: z.string().min(1, "id is required"),
});
```

### 2. `src/app/api/<path>/route.ts`

Use this exact structure for every handler:
```typescript
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { get<Model>Schema, post<Model>Schema, patch<Model>Schema, delete<Model>Schema } from "@/lib/validators/<path>";

function validationError(error: ZodError) {
  const first = error.issues[0];
  const field = first?.path[0]?.toString();
  return NextResponse.json(
    { error: first?.message ?? "Validation error", ...(field ? { field } : {}) },
  { status: 400 }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = get<Model>Schema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!result.success) return validationError(result.error);
  try {
    // prisma query here
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch <model>" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const result = post<Model>Schema.safeParse(body);
  if (!result.success) return validationError(result.error);
  try {
    const created = await prisma.<model>.create({ data: result.data });
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      return NextResponse.json({ error: "<Model> already exists" }, { status: 409 });
    return NextResponse.json({ error: "Failed to create <model>" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const result = patch<Model>Schema.safeParse(body);
  if (!result.success) return validationError(result.error);
  try {
    const updated = await prisma.<model>.update({ where: { id: result.data.id }, data: result.data });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
      return NextResponse.json({ error: "<Model> not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to update <model>" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = delete<Model>Schema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!result.success) return validationError(result.error);
  try {
    await prisma.<model>.delete({ where: { id: result.data.id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
      return NextResponse.json({ error: "<Model> not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to delete <model>" }, { status: 500 });
  }
}
```

### 3. `__tests__/helpers/factories.ts` — add factory function

Add a `create<Model>` factory following the existing pattern in the file.

### 4. `__tests__/api/<path>.test.ts`

Use this structure:
```typescript
import { clearInvestments, testDb } from "../../helpers/db"; // adjust path
import { create<Model> } from "../../helpers/factories";
import { GET, POST, PATCH, DELETE } from "@/app/api/<path>/route";

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

beforeAll(async () => { /* seed required relations */ });
beforeEach(async () => { /* clear the model's table */ });

describe("GET /api/<path>", () => {
  it("returns empty array when no records exist", ...);
  it("returns records", ...);
  // invalid query params → 400
});

describe("POST /api/<path>", () => {
  it("creates record → 201", ...);
  it("fails on missing required field → 400 with field: <fieldName>", ...);
  // one test per required field
});

describe("PATCH /api/<path>", () => {
  it("updates record → 200", ...);
  it("fails without id → 400 with field: id", ...);
  it("returns 404 for unknown id", ...);
});

describe("DELETE /api/<path>", () => {
  it("deletes record → 200", ...);
  it("fails with ...);
  it("returns 404 for unknown id", ...);
});
```

---

## After generating all files

1. Run `npm test` — fix any failures before finishing
2. Commit: `feat: add <path> endpoint`
