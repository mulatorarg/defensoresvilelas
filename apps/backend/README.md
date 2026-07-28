# Backend — API del club (FastAPI)

API REST del sistema de gestión, en Python (FastAPI + SQLAlchemy 2 sobre MariaDB). En producción es **el único proceso**: sirve la API (`/api/*`), el build estático del frontend (`/`) y los archivos del club (`/recursos/*`) en un solo puerto.

## Desarrollo

```bash
python -m venv .venv
.venv\Scripts\activate               # Windows (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt

python -m app.db_init                # crea la base y las tablas (aditivo)
python -m app.db_init --reset        # borra TODAS las tablas y las recrea
python -m app.seed                   # config del club + usuario admin
python -m app.seed --demo            # + disciplinas, socios, cuotas, caja de ejemplo

uvicorn app.main:app --reload --port 3001
```

Docs interactivas: http://localhost:3001/api/docs

Variables (del `.env` en la raíz del monorepo): `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `QR_SECRET`, `FRONTEND_URL`, `RECURSOS_DIR`, y para el seed `CLUB_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Arquitectura

| Módulo | Qué hace |
|---|---|
| `app/main.py` | FastAPI, CORS, formato de errores, estáticos (web + recursos) |
| `app/models.py` | Modelos SQLAlchemy — **dueño del schema** (tablas en español) |
| `app/deps.py` | Auth staff (JWT + rol), auth socio, `get_club_config` |
| `app/routers/` | Un módulo por recurso (ver tabla de endpoints) |
| `app/mp.py` | Mercado Pago (credenciales desde la DB, fallback env) |
| `app/db_init.py` / `app/seed.py` | Creación de schema / datos iniciales |

### Endpoints principales

| Prefijo | Auth | Qué expone |
|---|---|---|
| `/api/auth` | — | Login de staff (JWT con `role`) |
| `/api/club` | público / ADMIN | Identidad del club (`GET /api/club`) y configuración completa (`/config`, incluye credenciales MP y cuota social) |
| `/api/public/*` | — | Landing: disciplinas, noticias, eventos, partidos y **registro online de socios** (`POST /register`, crea socio + cuota + pago simulado) |
| `/api/members`, `/api/disciplines`, `/api/categories`, `/api/enrollments`, `/api/attendances`, `/api/fee-types`, `/api/fees`, `/api/payments`, `/api/transactions`, `/api/reports` | staff por rol | Gestión interna |
| `/api/member-portal/*` | socio (`scope: member`) | Login DNI + nacimiento, perfil, cuotas, carnet con QR firmado (5 min) |
| `/api/staff-portal/*` | staff | Escaneo de QR y registro de asistencia |
| `/api/payments/mercado-pago/webhook` | firma MP | Webhook de pagos |

La misma API sirve a la web y a la **futura app móvil** (los JWT y el contrato JSON son independientes del cliente).

## Cambios de schema

Editar `app/models.py` y correr `python -m app.db_init` (crea tablas nuevas; **no** altera columnas existentes — para eso, migración manual o `--reset` en dev).

## Imagen Docker

`Dockerfile` (multi-stage): compila el frontend con Node y lo empaqueta junto al backend en `python:slim`. Un solo puerto (3001 interno). Se buildea desde la **raíz del monorepo**:

```bash
docker build -f apps/backend/Dockerfile -t ghcr.io/usuario/repo:latest .
```
