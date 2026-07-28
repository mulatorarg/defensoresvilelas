# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clubes** is a single-club management platform: each club runs its own instance (same Docker/GHCR image, own MariaDB database, own `.env`). There is NO multi-tenancy — no tenant table, no `club_id` columns. Club identity (name, colors, logo, contact info, Mercado Pago credentials) lives in the single-row `configuracion_club` table, editable via the admin API. The monorepo has two apps:

- `apps/backend` — Python REST API (FastAPI + SQLAlchemy 2 over MariaDB)
- `apps/frontend` — Next.js static frontend (App Router, `output: 'export'`)

## Commands

There is no root `package.json` — each app manages its own dependencies.

### Frontend (`apps/frontend`)

```bash
npm install          # Install deps (lockfile lives here)
npm run dev          # next dev on port 3000
npm run build        # Static export to apps/frontend/dist
npm run lint         # next lint
```

### Backend Python (`apps/backend`)

```bash
python -m venv .venv
.venv\Scripts\activate               # Windows
pip install -r requirements.txt

uvicorn app.main:app --reload --port 3001   # dev server
python -m app.db_init                       # create DB + all tables (additive)
python -m app.db_init --reset               # drop ALL tables & recreate
python -m app.seed                          # club config + admin user (env: CLUB_NAME, ADMIN_EMAIL, ADMIN_PASSWORD)
python -m app.seed --demo                   # + demo disciplines/news/events
```

Interactive API docs: http://localhost:3001/api/docs

### Docker (local full stack)

```bash
docker compose up --build   # MariaDB (host port 3307) + app on http://localhost:3001
```

## Architecture

### Club configuration

`GET /api/club` (public, for the landing) returns name/colors/logo/contact/`monthlyFee` (cuota social). `GET|PATCH /api/club/config` (ADMIN) manages the full config including `mpAccessToken`/`mpWebhookSecret` (Mercado Pago credentials read from DB with env-var fallback). Helper: `app/deps.py: get_club_config` (creates the row on first access).

### Request pipeline (FastAPI dependencies)

- Staff endpoints use `Depends(require_roles("ADMIN", ...))` → `StaffContext` (JWT payload + `role` claim).
- Member-portal endpoints use `MemberDep` (JWT with `scope: 'member'`).
- Public endpoints (login, /api/club, /api/public/*, MP webhook) skip auth deps. `POST /api/public/register` is the online member sign-up: creates member + optional enrollment + current-month fee + simulated COMPLETED payment (reference `simulacion-web`; real MP checkout pending).

### Authentication

Two separate flows:
1. **Staff login** (`POST /api/auth/login`) — email + password (bcrypt) → JWT (HS256, 7d) with a `role` claim (`ADMIN`, `OPERATOR`, `TEACHER`, `STAFF`). Role lives directly on the `usuarios` table.
2. **Member login** (`POST /api/member-portal/login`) — DNI + birth date → JWT with `scope: 'member'`. Member card QR is a short-lived JWT (5 min) signed with `QR_SECRET`, scope `member-qr`, validated by `POST /api/staff-portal/scan`.

`JWT_SECRET` must be ≥ 32 characters; the app raises on startup otherwise.

### Backend layout (`apps/backend/app/`)

| File / dir | Responsibility |
|---|---|
| `main.py` | FastAPI app, CORS, NestJS-style error format handlers, static frontend serving with SPA fallback |
| `config.py` | Loads `.env` from monorepo root; all env access |
| `database.py` | SQLAlchemy engine/session (`mysql+pymysql`), `get_db` |
| `models.py` | SQLAlchemy models mapped to Spanish table/column names; English attribute names (same as old Prisma fields) |
| `schemas.py` | Pydantic input DTOs |
| `serializers.py` | Response dicts — camelCase keys, ISO `...Z` dates, decimals as strings (same JSON contract the frontend expects) |
| `deps.py` | Auth/roles dependencies + `get_club_config` |
| `security.py` | PyJWT sign/verify, bcrypt |
| `mp.py` | Mercado Pago SDK (lazy — API works without `MERCADO_PAGO_ACCESS_TOKEN`), fee status recalculation |
| `errors.py` | HTTPException helpers with `{statusCode, message, error}` body |
| `db_init.py` / `seed.py` | Schema creation / demo data (run with `python -m app.db_init` / `python -m app.seed`) |
| `routers/` | One module per resource: auth, club, members, disciplines, categories, enrollments, attendances, fee_types, fees, payments, transactions, reports, member_portal, staff_portal |

### Frontend (`apps/frontend/app/`)

Next.js App Router with static export (`output: 'export'`, `distDir: 'dist'`). The Python backend serves `dist/` at `/` with SPA fallback (excluding `/api/*`).

- `/` — public landing page (club branding from `/api/club`, sign-up form in #asociate)
- `/socio` — member portal: DNI+birthdate login, pending fees, QR card (`qrcode` package; token in localStorage `memberToken`)
- `/login` — staff login form
- `/admin/*` — protected by `AuthGuard`; dark branded sidebar layout
- `lib/api.ts` — all HTTP calls to the backend
- `lib/auth.ts` — JWT token read/write (localStorage)
- `lib/types.ts` — shared TypeScript interfaces

### Database (MariaDB, Spanish schema)

Schema is owned by SQLAlchemy models (`app/models.py`). Table/column names are Spanish; Python attribute names are English. Key mappings:

- Tables: `ClubConfig→configuracion_club` (single row, id='club'), `Member→socios`, `User→usuarios`, `Discipline→disciplinas`, `Category→categorias`, `Enrollment→inscripciones`, `FeeType→tipos_cuota`, `Fee→cuotas`, `Payment→pagos`, `Attendance→asistencias`, `Transaction→transacciones`, `News→noticias`, `Event→eventos`, `Team→equipos`, `Match→partidos`
- Common columns: `createdAt→creado_en`, `updatedAt→actualizado_en`, `isActive→activo`, `firstName→nombre`, `lastName→apellido`

Key uniques: `Member.dni`, `Member.numero_socio`, `News.slug`, `Enrollment [socio_id, categoria_id, estado]`, `Attendance [categoria_id, socio_id, fecha]`.

IDs are cuid-style strings generated in Python (`app/ids.py`). Enums are stored as plain strings (`ACTIVE`, `PENDING`, `MERCADO_PAGO`, ...). `DATABASE_URL` format: `mysql://user:password@host:3306/database`.

After changing `models.py` on a dev DB, re-run `python -m app.db_init` (additive) or `--reset` (destructive).

### Production deployment (VPS Debian, Nginx + MariaDB at OS level)

```
Internet → Nginx (80/443) → Uvicorn (port 3001) → MariaDB (localhost:3306)
```

Full instructions in `deploy.md` (root): GHCR image + Docker Compose per club (recommended), or bare-metal with systemd. Uvicorn serves both `/api/*` and the static frontend.

## Environment Variables

Copy `.env.example` to `.env` (root). Required: `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `NEXT_PUBLIC_API_URL`, `FRONTEND_URL` (CORS). Optional: `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `QR_SECRET`.

## Demo Credentials

After `python -m app.seed`:
- Email: `admin@clubes.local` / Password: `admin123` (role ADMIN)
- Club config row (Club Atlético Defensores de Vilelas, green #08a757, monthlyFee 12000, /escudo.svg)
- Demo content (only if DB empty): 4 disciplines × M/F categories, 3 news, 2 events, 12 members with enrollments, 2 weeks of attendance, current-month fees (paid/partial/pending) and cash transactions
