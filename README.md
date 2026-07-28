# Clubes — Sistema de gestión para clubes

Plataforma de gestión integral para clubes deportivos de barrio. **Cada club corre su propia instancia** (misma imagen Docker, base de datos y `.env` propios): landing pública con la identidad del club, registro online de socios, portal del socio con carnet QR y panel de administración.

## Stack

- **Backend:** Python · FastAPI · SQLAlchemy 2 · MariaDB — sirve la API (`/api/*`), la web estática y los archivos del club (`/recursos/*`) en **un solo puerto**
- **Frontend:** Next.js (App Router, export estático) · React 19 · Tailwind CSS 4
- **Deploy:** imagen única en GHCR + Docker Compose en el VPS, detrás de Nginx
- **Mobile (próximamente):** app para socios y administración, consumiendo esta misma API (JWT)

## Estructura

```
.
├── apps/
│   ├── backend/            # API FastAPI (sirve también la web compilada)
│   │   ├── app/            #   routers, models, seed, db_init
│   │   └── Dockerfile      #   imagen única (frontend build + backend)
│   └── frontend/           # Next.js: landing, /socio, /login, /admin
├── recursos/               # Archivos persistentes del club (fotos, docs) — volumen en Docker
├── .github/workflows/deploy.yml   # CI/CD: build a GHCR + deploy al VPS
├── docker-compose.yml      # Stack local completo (MariaDB + app)
├── docker-compose.prod.yml # Compose que el workflow instala en el VPS
├── nginx.conf              # Proxy para defensores.yacarestudio.com
├── deploy.md               # Guía de deploy completa
└── docs/                   # Propuesta de mejoras, roadmap
```

## Desarrollo local

Requisitos: Python 3.12+, Node 20+, MariaDB (ej. Laragon) o Docker.

```bash
# 1. Variables de entorno
cp .env.example .env        # completar DATABASE_URL, JWT_SECRET (≥32 chars), etc.

# 2. Backend (puerto 3001)
cd apps/backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
python -m app.db_init            # crea la base y las tablas
python -m app.seed --demo        # club demo + admin + socios/cuotas de ejemplo
uvicorn app.main:app --reload --port 3001

# 3. Frontend en modo dev (puerto 3000, con hot reload)
cd apps/frontend
npm install
npm run dev
```

O todo junto con Docker: `docker compose up --build` → http://localhost:3001.

## URLs

| Ruta | Qué es |
|---|---|
| `/` | Landing pública del club (branding dinámico desde la API) |
| `/#asociate` | Registro online de socios con pago de la primera cuota |
| `/socio` | Portal del socio: login DNI + fecha de nacimiento, cuotas, carnet QR |
| `/login` → `/admin` | Panel de administración (staff) |
| `/api/docs` | Documentación interactiva de la API (OpenAPI) |
| `/recursos/*` | Archivos del club (fotos de socios, etc.) |

Credenciales demo: `admin@clubes.local / admin123` · Socio demo: DNI `30111222`, nac. `1990-03-01`.

## API para terceros (web + futura app móvil)

La API es independiente del frontend: cualquier cliente puede consumirla.

- **Staff:** `POST /api/auth/login` → JWT con claim `role` → `Authorization: Bearer <token>`
- **Socios:** `POST /api/member-portal/login` (DNI + fecha de nacimiento) → JWT `scope: member`
- **Público:** `/api/club`, `/api/public/*` (disciplinas, noticias, eventos, registro)

Contrato completo en `/api/docs`.

## Deploy

Push a `main` → GitHub Actions buildea la imagen, la publica en **GHCR** y actualiza el VPS por SSH (`/home/deploy/defensores`). Guía completa, secrets y primer arranque: **[deploy.md](deploy.md)**.
