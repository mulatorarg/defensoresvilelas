# Propuesta de mejoras — Clubes SaaS

**Fecha:** 2026-07-27
**Contexto:** plataforma multi-tenant de gestión de clubes deportivos, con landing pública (aficionados + store del club), administrador web interno (socios, disciplinas, cuotas/abonos, entradas, ventas) y portales de socio/staff.

Este documento acompaña dos cambios ya realizados:

1. **Backend portado a Python** (`apps/backend`): FastAPI + SQLAlchemy 2, mismo contrato de API (`/api/*`), misma base MariaDB en español. Verificado end-to-end contra la base local (login staff, socios, disciplinas, categorías, inscripciones, asistencias, cuotas, pagos, reportes, portal de socio, escaneo QR).
2. **Librerías actualizadas a última versión** en todo el monorepo (detalle al final).

---

## 1. Bugs y deudas detectados durante el port (prioridad alta)

| # | Problema | Detalle | Estado |
|---|---|---|---|
| 1 | **Portal de socio bloqueado en el backend Nest** | Los endpoints `/api/member-portal/me*` nunca pueden responder: el guard global `RequireTenantGuard` corre **antes** que `MemberAuthGuard` (guard de controlador), y como el token de socio no trae `clubs[]`, lanza 403 "Usuario no autenticado" siempre. | **Corregido en el backend Python.** En Nest habría que registrar `MemberAuthGuard` antes del check de tenant o marcar el controlador con una estrategia propia. |
| 2 | **Número de socio con condición de carrera** | `generateMemberNumber` usa `count + 1`: dos altas concurrentes generan el mismo número y una falla por la unique `[tenantId, memberNumber]`. | Pendiente: usar contador por tenant (tabla `secuencias` con `UPDATE ... LAST_INSERT_ID()`) o reintento ante conflicto. |
| 3 | **Pago + actualización de cuota sin transacción** | En `payments.create` el pago se inserta y luego se recalcula la cuota; si el proceso cae en el medio, queda un pago COMPLETED con la cuota sin actualizar. | En el port Python ambos pasos comparten sesión/commit. En Nest: envolver en `prisma.$transaction`. |
| 4 | **Webhook de Mercado Pago sin idempotencia fuerte** | El "find or create" por `reference` no está protegido contra webhooks concurrentes (MP reintenta): puede duplicar pagos. | Pendiente: unique en DB `(metodo, referencia)` + upsert. |
| 5 | **`fees/generate` puede duplicar bajo concurrencia** | El chequeo de existentes es leer-luego-insertar. Prisma usa `skipDuplicates`, pero no hay unique que lo respalde (`[tenantId, memberId, feeTypeId, categoryId, period]`). | Pendiente: agregar unique compuesta en el schema. |
| 6 | **Login de socio = DNI + fecha de nacimiento** | Ambos datos son semi-públicos (planillas, redes). Cualquiera que los conozca accede a cuotas y datos personales. | Ver §2 Seguridad. |
| 7 | **`GET /attendances` y `GET /transactions` sin paginación** | Con un año de datos devuelven miles de filas por request. | Pendiente: paginar igual que `members`/`fees`. |
| 8 | **Modelos sin API** | `News`, `Event`, `Team`, `Match` existen en el schema pero no tienen endpoints; la landing pública no tiene contenido dinámico que consumir. | Ver §4 Roadmap funcional. |

## 2. Seguridad (backend)

- **Tokens**: hoy el access token dura 7 días y no hay revocación. Proponemos access token corto (15–30 min) + refresh token rotativo persistido (permite cerrar sesión remota y revocar staff dado de baja).
- **Login de socio**: mantener DNI + fecha de nacimiento como primer factor, pero agregar verificación por código a email/WhatsApp registrado (OTP) al primer ingreso por dispositivo. Alternativa mínima: PIN de 4-6 dígitos definido por el club.
- **Rate limiting**: no existe. Agregar límite por IP en `/auth/login`, `/member-portal/login` y el webhook (en FastAPI: `slowapi`; o directamente en Nginx `limit_req`).
- **Bloqueo por intentos fallidos** y auditoría de accesos (tabla `auditoria`: quién, qué, cuándo — clave en un sistema que maneja dinero).
- **Webhook MP**: hacer obligatoria la validación de firma en producción (hoy solo valida si `MERCADO_PAGO_WEBHOOK_SECRET` está definido; sin secret, acepta cualquier POST y consulta a MP igual).
- **CORS**: si `FRONTEND_URL` no está definida, hoy se permite cualquier origen. Falla-cerrado en producción.
- **Headers de seguridad** (CSP, HSTS) en Nginx.
- **Backups**: automatizar dump diario de MariaDB + retención (hoy no está documentado ningún backup).

## 3. Arquitectura y calidad

### Backend

- **Migraciones versionadas en lugar de `db push`**: `db push` no deja historial y puede destruir datos en cambios ambiguos. Con el backend Python, el camino natural es **Alembic** (autogenerate + revisiones). Si se mantiene Prisma como dueño del schema, usar `prisma migrate` con shadow DB.
- **Decimal end-to-end**: los reportes convierten montos a `float`/`Number` (riesgo clásico de centavos). Mantener `Decimal` hasta la serialización y devolver strings.
- **Zona horaria**: los cortes de mes/día del dashboard y cierre de caja usan hora del servidor. Definir TZ del club (campo en `Tenant.settings`) y calcular períodos con ella.
- **Tests**: el port Python quedó verificado con un smoke test manual; convertirlo en suite `pytest` (con DB de test) e incorporar tests de contrato (mismo JSON que esperaba el frontend). En Nest solo hay 3 specs unitarios.
- **Estandarizar borrado**: hoy conviven baja lógica (`socios`, `disciplinas`, `categorias`, `tipos_cuota`) y borrado físico (`asistencias`, `transacciones`). Documentar el criterio; para `transacciones` (dinero) conviene anulación con motivo, no delete.
- **Observabilidad**: logging estructurado (JSON) + request-id, y un `/health` que verifique conexión a DB. Sentry (o similar) para errores.

### Frontend

- **Capa de datos**: `lib/api.ts` con `fetch` manual; adoptar **TanStack Query** (cache, reintentos, invalidación tras mutaciones, estados de carga consistentes).
- **Validación de formularios**: hoy la validación vive solo en el backend. Agregar **react-hook-form + zod**, compartiendo los schemas zod como fuente única de tipos (reemplaza a mano `lib/types.ts`).
- **Token en localStorage**: vulnerable a XSS. Ideal: cookie `httpOnly` + endpoint de refresh (requiere CSRF token). Mínimo: mantener localStorage pero con expiración corta + refresh.
- **Componentes UI**: sistema de componentes (shadcn/ui sobre Tailwind 4 encaja con el stack) para tablas, modales, toasts y estados vacíos consistentes.
- **Accesibilidad e i18n**: labels/aria en formularios; los textos ya están en español, pero centralizarlos permite multi-idioma futuro.

## 4. Roadmap funcional (visión de producto)

### Fase 1 — Landing pública por club (base ya modelada)

- Endpoints públicos (sin JWT, con tenant por subdominio): `GET /api/public/news`, `/events`, `/matches`, `/disciplines`.
- Frontend: home del club con colores/logo del tenant (ya están en `Tenant`), noticias, fixture y resultados, calendario de eventos, formulario de contacto/pre-inscripción.
- Admin: CRUD de noticias (editor rich-text), eventos, equipos y partidos con carga de resultados.
- SEO: al ser export estático hoy no hay SSR por tenant; evaluar pasar el frontend a **modo servidor (Next standalone)** para meta tags dinámicos por club, o pre-render por tenant.

### Fase 2 — Store del club

- Modelos nuevos: `Producto` (variantes talle/color, stock, fotos), `Pedido`, `PedidoItem`, `Cupon`.
- Checkout con Mercado Pago (la integración de preferencias + webhook ya existe y se reutiliza): carrito → preferencia → webhook confirma → descuento de stock.
- Retiro en sede / envío como opciones de fulfillment.
- Admin: gestión de catálogo, stock y pedidos (estados: pendiente de pago → pagado → entregado).

### Fase 3 — Entradas y abonos

- `Evento`/`Partido` con entradas: tipos de entrada (general, platea, socio con descuento), cupo, precio.
- Emisión de **entrada con QR firmado** — la infraestructura ya existe (carnet de socio usa JWT firmado con `QR_SECRET` + escaneo staff). Reutilizar `staff-portal/scan` generalizándolo a "credencial": socio, entrada, abono.
- **Abonos de temporada**: modelo `Abono` vinculado a socio o comprador externo, con validez por rango de fechas; el scanner valida abono vigente.
- Control de acceso offline-first para el día de partido (cache local de QRs válidos en el dispositivo del staff).

### Fase 4 — Cobranza y comunicación

- Recordatorios automáticos de cuotas vencidas (email/WhatsApp Business API) con link de pago MP.
- Débito recurrente (MP Suscripciones) para cuota mensual.
- Reporte de morosidad por disciplina/categoría, aging de deuda (30/60/90 días).
- Notificaciones al socio: vencimiento de pase médico (`medicalPassDue` ya existe), citaciones a partidos.

### Fase 5 — Portal del socio como PWA

- El portal (`/member`) como PWA instalable: carnet QR offline, cuotas, historial de pagos, calendario de su categoría y asistencias.
- Push notifications (web push) para avisos del club.

## 5. Infraestructura y DevOps

- **CI/CD** (GitHub Actions): lint + tests + build en cada PR; deploy al VPS por SSH con release atómica y rollback.
- **Staging**: un tenant `staging` o instancia separada para probar antes de producción.
- **PM2 → systemd o Docker Compose** para el backend Python (`uvicorn --workers N`); Nginx ya está como reverse proxy.
- **Monitoreo**: Uptime Kuma o similar contra `/health`; alertas si el webhook MP falla repetidamente.
- **Backups** automatizados de MariaDB (mysqldump diario + copia fuera del VPS).

## 6. Actualización de librerías (realizada)

### Node (monorepo)

Todo actualizado a última versión estable y verificado con `npm run build` (backend + frontend) y `npm test` (11/11 tests OK):

- Prisma `7.8.0 → 7.9.1` (client, adapter-mariadb, driver-adapter-utils, CLI). *Nota: 7.9 quitó `mode: 'insensitive'` para MySQL; se corrigió `members.service.ts` (MariaDB ya compara case-insensitive por collation).*
- NestJS `11.1.27 → 11.1.28`, `@nestjs/cli 11.0.24`.
- Next.js `16.2.9 → 16.2.12`, React `19.2.7 → 19.2.8`, Tailwind `4.3.1 → 4.3.3`, PostCSS `8.5.23`.
- `dotenv 16 → 17`, `mercadopago 3.1 → 3.2.1`, `turbo 2.10.7`, `tsx 4.23.1`, `ts-jest 29.4.12`, `@types/node 26.1.2`.
- **TypeScript se mantiene en 6.0.3 (a propósito)**: TS 7.0 es la reescritura en Go y todavía no expone la API programática del compilador que necesitan Nest CLI y Next.js (vuelve en 7.1). Reintentar la migración a TS 7 cuando salga 7.1, o antes en el frontend activando `experimental.useTypeScriptCli` en `next.config`.

### Python (`apps/backend`)

Creado directamente con las últimas versiones estables, fijadas en `requirements.txt`: FastAPI 0.140.7, SQLAlchemy 2.0.51, Uvicorn 0.51.0, Pydantic 2.13.4, PyJWT 2.13.0, bcrypt 5.0.0, PyMySQL 1.2.0, mercadopago 3.3.1, cryptography 49.0.0.

## 7. Plan de adopción del backend Python

1. **Convivencia**: ambos backends comparten DB y contrato; se puede correr el Python en otro puerto y apuntar Nginx por ruta o por porcentaje de tráfico.
2. **Paridad verificada**: rutas, formato de errores NestJS (`{statusCode, message, error}`), JWT compatibles en ambos sentidos (mismo secret/HS256), serialización camelCase idéntica.
3. **Pendientes antes de apagar Nest**: suite pytest formal, migraciones Alembic (mientras tanto, el schema sigue siendo de Prisma: `npm run db:push`), y decisión sobre el seed (hoy `prisma/seed.ts` con tsx sigue funcionando).
4. **Deploy**: `uvicorn app.main:app --host 0.0.0.0 --port 3001 --workers 2` bajo PM2/systemd; sirve también el build estático del frontend, igual que Nest.

---

## Resumen ejecutivo

- **Hecho**: backend replicado en Python (FastAPI) y verificado contra la base real; todas las librerías npm/Python al día; corregidos de paso un bug de agregación y la incompatibilidad Prisma 7.9; detectado y documentado un bug bloqueante del portal de socio en Nest (resuelto en el port).
- **Siguiente paso recomendado (2 semanas)**: cerrar los ítems de la tabla §1 (unicidades + transacciones + paginación), rate limiting y backups.
- **Siguiente hito de producto**: Fase 1 (landing pública dinámica), que desbloquea el valor para aficionados con modelos que ya existen en la base.
