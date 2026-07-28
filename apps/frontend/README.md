# Frontend — Web del club (Next.js)

Sitio del club en Next.js (App Router) con **export estático**: el build (`dist/`) lo sirve el backend FastAPI, así toda la app vive en un solo puerto. En desarrollo corre con hot reload en el 3000 contra la API del 3001.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000 (requiere el backend en 3001)
npm run build    # export estático a dist/
npm run lint
```

`.env.development` ya apunta la API a `http://localhost:3001`. En el build de producción la URL se define con el build-arg `NEXT_PUBLIC_API_URL` (Dockerfile del backend).

## Rutas

| Ruta | Qué es |
|---|---|
| `/` | Landing pública: branding del club desde `/api/club` (colores como CSS vars, escudo, cuota), disciplinas, agenda, noticias, tienda (teaser) y **registro online de socios** con pago simulado |
| `/socio` | Portal del socio: login DNI + fecha de nacimiento, cuotas pendientes, actividades y **carnet digital con QR** (librería `qrcode`) |
| `/login` | Login del staff |
| `/admin/*` | Panel de administración (protegido por `AuthGuard`): dashboard, socios, disciplinas, cuotas, asistencia, caja, reportes |

## Estructura

```
app/
├── page.tsx            # Landing (+ RegistroSocio.tsx)
├── socio/              # Portal del socio
├── login/              # Login staff
├── admin/              # Panel (layout con sidebar oscura del club)
├── layout.tsx          # Fuentes (Bricolage Grotesque + Manrope)
└── globals.css         # Tema (colores del club como CSS vars) y animaciones
lib/
├── api.ts              # Todas las llamadas HTTP (staff, socio y públicas)
├── auth.ts             # Sesión del staff (localStorage)
└── types.ts            # Tipos compartidos
public/                 # escudo.svg / escudo.png (favicon en app/icon.png)
```

## Identidad por club

Los colores (`--color-primary` / `--color-secondary`), el nombre, el escudo y la cuota social vienen de `GET /api/club` y se aplican en runtime: la misma web compilada sirve para cualquier club sin recompilar.
