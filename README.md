# FinDash — Osobní Finance & Investice

Webová aplikace pro sledování osobních financí a investičního portfolia.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes
- **ORM**: Prisma 7
- **DB**: PostgreSQL
- **Charts**: Recharts
- **Docker**: docker-compose
- **Testy**: Jest + ts-jest

---

## Rychlý start (Docker)

### 1. Zkopíruj environment soubor
```bash
cp .env.example .env
```

### 2. Spusť databázi
```bash
docker-compose up postgres -d
```

### 3. Nainstaluj závislosti (generuje Prisma client automaticky přes postinstall)
```bash
npm install
```

### 4. Migruj databázi
```bash
npm run db:migrate
```

> **Poznámka (Prisma 7):** `prisma migrate dev` nespouští seed automaticky. Seed je třeba spustit ručně (krok 5).

### 5. Seed – ukázkových data
```bash
npm run db:seed
```

### 6. Spusť aplikaci
```bash
npm run dev
```

Aplikace běží na [http://localhost:3000](http://localhost:3000)

---

## Celý stack v Dockeru

```bash
# Build & spuštění
docker-compose up --build

# Migrace uvnitř kontejneru
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx tsx prisma/seed.ts
```

---

## Databázové příkazy

| Příkaz | Popis |
|--------|-------|
| `npm run db:generate` | Generuj Prisma client |
| `npm run db:migrate` | Spusť migrace (dev) |
| `npm run db:push` | Push schématu bez migrace |
| `npm run db:seed` | Naplň DB ukázkovými daty |
| `npm run db:studio` | Otevři Prisma Studio |
| `npm run db:reset` | Reset DB + seed |

---

## Moduly

### Finance (`/finance`)
- **Přehled** — souhrn příjmů/výdajů, grafy cash flow a výdajů dle kategorie
- **Transakce** — filtrování dle měsíce/kategorie/typu, CRUD
- **Rozpočty** — měsíční limity dle kategorie s progress bary
- **Účty** — běžný/spořicí/hotovost, CRUD

### Investice (`/investments`)
- **Přehled** — hodnota portfolia, P&L, alokační koláč
- **Aktiva** — CRUD aktiv (Krypto, Nemovitosti, Zlato/Stříbro)
- **Nákupy** — CRUD nákupů per aktivum
- **Ceny** — manuální update + auto-fetch z CoinGecko (krypto)

---

## Seed data

Realistická česká data:
- 3 účty (Běžný, Spořicí, Hotovost)
- 10 kategorií (Nájem, Jídlo, Doprava, Investice, …)
- ~6 měsíců transakcí
- Rozpočty pro aktuální měsíc
- Investice: BTC, ADA, Zlato, Stříbro, Byt Praha 3

---

## Testování

Testy volají Next.js route handlery přímo (bez HTTP serveru). Používají separátní PostgreSQL databázi, aby dev databáze zůstala nedotčená.

### Nastavení

**1. Vytvoř testovací databázi:**
```bash
psql -U postgres -c "CREATE DATABASE findash_test;"
```

**2. Vytvoř `.env.test`:**
```bash
cp .env.test.example .env.test
# Uprav přihlašovací údaje dle potřeby
```

**3. Spusť testy** (migrace se aplikují automaticky před prvním spuštěním):
```bash
npm test
```

### Příkazy

| Příkaz | Popis |
|--------|-------|
| `npm test` | Spustí všechny testy |
| `npm run test:watch` | Sleduje změny a opakuje testy |
| `npm run test:coverage` | Testy s reportem pokrytí |
| `npm run lint` | Spustí ESLint nad `src/` |

### Spuštění konkrétní sady

```bash
npx jest --testPathPattern=accounts
npx jest --testPathPattern=transactions
npx jest --testPathPattern=investments/stats
```

### Struktura testů

```
__tests__/
  helpers/
    db.ts          # sdílený Prisma client + helpers pro čištění tabulek
    factories.ts   # createTestAccount(), createTestAsset(), …
  api/
    finance/
      accounts.test.ts
      categories.test.ts
      transactions.test.ts
      budgets.test.ts
      stats.test.ts
    investments/
      assets.test.ts
      purchases.test.ts
      prices.test.ts
      stats.test.ts
```

Volání externích API (CoinGecko) jsou mockována pomocí `jest.spyOn(global, 'fetch')` — v testech nedochází k žádným síťovým požadavkům.

---

## Environment Variables

| Proměnná | Výchozí | Popis |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/findash` | Připojení k PostgreSQL |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | URL aplikace |
| `DATABASE_URL_TEST` | `postgresql://postgres:password@localhost:5432/findash_test` | Testovací DB (`.env.test`) |
