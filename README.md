# FinDash — Osobní Finance & Investice

Webová aplikace pro sledování osobních financí a investičního portfolia.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes
- **ORM**: Prisma
- **DB**: PostgreSQL
- **Charts**: Recharts
- **Docker**: docker-compose

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

### 3. Nainstaluj závislosti
```bash
npm install
```

### 4. Migruj databázi a vygeneruj Prisma client
```bash
npm run db:generate
npm run db:migrate
```

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

## Environment Variables

| Proměnná | Výchozí | Popis |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/findash` | Připojení k PostgreSQL |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | URL aplikace |
