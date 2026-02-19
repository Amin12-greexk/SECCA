# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

SECCA is a feather production management system for tracking raw material intake, grading, lot processing, work orders, and payroll. The application uses Indonesian terminology throughout (baku = raw material, pecah bon = lot splitting, mitra = partner workers, koreksi = QC/corrections).

## Monorepo Structure

- **apps/api** — NestJS backend using Fastify adapter, Prisma ORM, PostgreSQL
- **apps/web** — Next.js 16 frontend (App Router) with Tailwind CSS 4 and Radix UI
- **apps/desktop** — Electron wrapper for Windows desktop deployment

## Development Commands

```powershell
# Install dependencies (uses pnpm workspaces)
pnpm install

# Start local PostgreSQL + Redis containers
pnpm db:up

# Run Prisma migrations
pnpm prisma:migrate

# Generate Prisma client
pnpm prisma:generate

# Seed database (use SEED_RESET=true to wipe data first)
pnpm seed

# Start API in watch mode (port 3001)
pnpm api:dev

# Start web frontend (port 3000)
pnpm web:dev

# Start desktop Electron app
pnpm desktop:dev

# Run all linters
pnpm lint
```

## Testing

```powershell
# API unit tests
pnpm --filter api test

# Single test file
pnpm --filter api test -- baku.service.spec.ts

# E2E tests
pnpm --filter api test:e2e

# Coverage
pnpm --filter api test:cov
```

## Database

- Local: PostgreSQL 17 via Docker on port 5433, database `secca_local`
- Connection: `DATABASE_URL` env var, see `.env.prod.example`
- Browse data: `pnpm prisma:studio`
- Schema: `apps/api/prisma/schema.prisma`

## Authentication

- JWT-based, token returned from `POST /api/auth/login`
- Demo accounts (all use password `password`):
  - `manager@secca.com` (MANAGER role)
  - `baku@secca.com` (BAKU role)
  - `mitra@secca.com` (MITRA role)
  - `koreksi@secca.com` (KOREKSI role)
- Most endpoints require `Authorization: Bearer <token>`

## Architecture

### API (NestJS)

Modules follow controller → service → Prisma pattern in `apps/api/src/modules/`:

- **baku** — Raw batch intake, pecah bon (lot splitting), batch management
- **grading** — Grade stock assignment on raw batches
- **lots** — Production lot creation, auto-split, movement between racks
- **work-orders** — Kanban-style workflow: NEXT_DAY → IN_PROGRESS → READY_TO_SUBMIT
- **work-items** — Individual lot items within work orders
- **finish** — Receipt recording, susut (shrinkage) calculation, payroll entry creation
- **payroll** — Worker payment calculations based on grade tariffs
- **traceability** — Lot source tracking back to supplier/batch
- **analytics** — Manager dashboard metrics (grade usage, capacity)
- **rules** — Grade tariffs, moisture rules, pecah bon presets

Shared services in `apps/api/src/common/`:
- `NumberingService` — Sequential ID generation (e.g. `K0001/SECCA/26`, `LP000001/26`)
- `InventoryMovementService` — Lot location tracking

Response wrapper: All responses use `ResponseInterceptor` producing `{ data: T, meta: { timestamp } }`.

### Web (Next.js App Router)

Routes in `apps/web/app/` map to user roles:
- `/baku` — Raw material intake
- `/mitra` — Worker kanban board
- `/koreksi` — QC review
- `/admin` — User/worker/settings management
- `/dashboard` — Manager analytics

Key patterns:
- API client functions in `apps/web/lib/api.ts`
- Auth context in `apps/web/lib/context/AuthContext.tsx`
- UI components use Radix primitives in `apps/web/components/ui/`
- Forms use `react-hook-form` with Zod validation

## Domain Flow

1. **Receive** — Raw batch arrives from supplier (`RawBatch`)
2. **Pecah Bon** — Split batch into graded lots (`PecahBonEntry` → `ProductionLot`)
3. **Assign** — Send lots to worker via work order (`WorkOrder`, `WorkOrderItem`)
4. **Process** — Worker moves items through lanes (NEXT_DAY → IN_PROGRESS → READY_TO_SUBMIT)
5. **Finish** — Record output weight, calculate shrinkage, generate payroll (`FinishReceipt`, `PayrollEntry`)

## Key Enums

- `UserRole`: BAKU, MITRA, KOREKSI, MANAGER, TRAINER
- `LotStatus`: AVAILABLE, IN_PROGRESS, COMPLETED
- `WorkLane`: NEXT_DAY, IN_PROGRESS, READY_TO_SUBMIT
- `GradeType`: BULU (feather), WARNA (color), BENTUK (shape)
- `RackType`: PRE_SALE, MITRA_ORDER, FINISHED, WORKER

## API Documentation

Swagger UI available at `http://localhost:3001/docs` when API is running.
API flow examples in `docs/api-flow.md`.
