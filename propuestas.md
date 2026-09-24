# Propuestas de mejora

Revisión integral del proyecto (backend FastAPI + frontend Next.js) al 2026-09-23. Complementa a `docs/propuesta-mejoras.md` (escrito durante el port desde NestJS): acá se prioriza sobre el código actual y se indica qué ítems de aquel documento siguen vigentes.

Etiquetas de prioridad: `BLOQUEANTE` (resolver antes del próximo deploy), `ALTA`, `MEDIA`, `BAJA`. Estado: `APLICADO` (hecho en esta revisión) o `PENDIENTE`.

## 0. Aplicado en esta revisión

### Actualización de librerías

| Paquete | Antes | Ahora | Nota |
|---|---|---|---|
| fastapi | 0.140.7 | 0.141.1 | |
| uvicorn[standard] | 0.51.0 | 0.53.0 | |
| SQLAlchemy | 2.0.51 | 2.0.54 | |
| PyMySQL | 1.2.0 | 1.2.3 | |
| cryptography | 49.0.0 | 50.0.1 | |
| python-dotenv | 1.2.2 | 1.2.3 | |
| PyJWT | 2.13.0 | 2.15.0 | |
| mercadopago | 3.3.1 | 3.6.0 | |
| email-validator, bcrypt, cuid2 | - | sin cambios | ya en la última versión |
| next | 16.2.x | 16.3.6 | |
| react / react-dom | 19.2.x | 19.3.0 | |
| @types/node, @types/react, @types/react-dom, postcss, tailwindcss, @tailwindcss/postcss | - | últimas | |
| typescript | 6.0.3 | 6.0.3 | TS 7.0.2 compila con Next, pero typescript-eslint todavía no lo soporta (ver 5.4) |
| eslint + eslint-config-next | no estaban | 10.11.0 / 16.3.6 | `next lint` fue eliminado en Next 16: `npm run lint` estaba roto |
| Imagen Docker de build del frontend | node:22-alpine | node:24-alpine | Node 24 es la LTS actual y la versión local |
| GitHub Actions del deploy | checkout v4, buildx v3, login v3, metadata v5, build-push v6, scp v0.1.7, ssh v1.0.3 | checkout v7, buildx v4, login v4, metadata v6, build-push v7, scp v1.0.0, ssh v1.2.5 | OJO: el workflow no se pudo ejecutar localmente; validar en el próximo deploy |

`npm audit`: 0 vulnerabilidades. `pip check`: sin conflictos.

### Bugs corregidos

| # | Problema | Corrección |
|---|---|---|
| 1 | Alta/edición de socio sin email fallaba con 400: el formulario manda `email: ""` y el patrón de email lo rechazaba. | Los campos opcionales vacíos se interpretan como `null` (`OptionalEmail` en `schemas.py`). |
| 2 | Firma del webhook de Mercado Pago mal calculada: el manifest no seguía el formato de MP (`id:...;request-id:...;ts:...;`), así que con `mpWebhookSecret` configurado todos los webhooks legítimos se rechazaban. | `_validate_signature` usa el manifest oficial, el header `x-request-id` y el `data.id` de la query string. |
| 3 | El webhook registraba siempre `fee.amount` como monto cobrado, aunque la preferencia del portal del socio cobra solo el saldo pendiente. Los reintegros no recalculaban la cuota. | Se usa `transaction_amount` del pago en MP y el estado de la cuota se recalcula siempre. |
| 4 | Montos no numéricos (`"abc"`), negativos, métodos de pago o tipos de movimiento inexistentes terminaban en 500 o se guardaban. `page=abc` daba 500. | Validación en los DTOs (`Amount`, `PaymentMethod`, `TransactionType`, `MemberStatus`, `Gender`, `Period`), `page`/`limit` tipados como `int` y handler de `InvalidOperation` como red de seguridad. |
| 5 | Mercado Pago sin configurar respondía 500 genérico. | Responde 400 con mensaje claro. |
| 6 | Número de socio con `count() + 1`: choca con el unique si falta algún número. | `next_member_number` usa el máximo actual + 1. |
| 7 | Fechas corridas un día: el frontend mostraba `"2026-09-23T00:00:00Z"` con `new Date()` (en UTC-3 queda 22/09) y usaba `toISOString()` para "hoy" (después de las 21 h daba el día siguiente). Afectaba caja, asistencia, pagos y reportes. | `lib/dates.ts` (`todayLocal`, `formatDateOnly`). |
| 8 | La toma de asistencia pedía `getMembers({ limit: 1000 })`, pero la API limita a 100: en clubes con más de 100 socios, los que quedaban afuera no aparecían para marcar asistencia. | `AttendanceTaker` carga los inscriptos de la categoría con `GET /api/categories/{id}`. |
| 9 | `fee.feeType.name` rompía la tabla de cuotas y el reporte si una cuota no tenía tipo. | Acceso opcional y tipo `feeType: ... \| null`. |
| 10 | El login del staff venía precargado con `admin@clubes.local / admin123` también en producción. | Solo se precarga en `next dev`. |
| 11 | Redirección abierta: `/login/?returnTo=https://sitio-externo` redirigía fuera del sitio tras el login. | `returnTo` solo acepta rutas `/admin...`. |
| 12 | Token vencido: las pantallas del admin mostraban errores sueltos en lugar de volver al login. | `apiFetch` limpia la sesión y redirige ante 401. |
| 13 | `isTokenValid` decodificaba el JWT con `atob` sin normalizar base64url: con ciertos payloads fallaba y echaba al usuario. | Normalización `-`/`_` antes de `atob`. |
| 14 | Error de hidratación en el layout y el dashboard del admin (leían `localStorage` durante el render). | Hook `useStoredUser` con `useSyncExternalStore`. |
| 15 | Mensajes de validación en array se mostraban como texto concatenado sin separador. | `errorMessage()` en `lib/api.ts`. |
| 16 | El QR del carnet vencía a los 5 minutos y había que tocar "Actualizar" a mano. | Se renueva solo cada 4 minutos; si la sesión venció, vuelve al login. |
| 17 | El alta online mostraba la cuota social aunque la categoría elegida tuviera otra cuota (y se cobraba la de la categoría). | `/api/public/disciplines` expone `feeAmount` y el formulario muestra el monto real. |
| 18 | N+1 queries: el listado de socios hacía ~4 consultas por socio y el de cuotas ~5 por cuota. | `selectinload` en socios, cuotas y reportes. |
| 19 | El dashboard calculaba el mes con la hora local del servidor y el resto del sistema con UTC. | Se unificó en UTC (ver 2.3 para la solución de fondo). |

Verificación: 47 pruebas de humo contra la API con MariaDB (base `clubes_test`, seed demo), `tsc --noEmit`, `eslint` (0 errores) y `next build` OK.

## 1. Seguridad

### 1.1 Secretos reales versionados en git - BLOQUEANTE, PENDIENTE

`.env.local.example` está commiteado con valores que parecen los de producción: `JWT_SECRET`, `QR_SECRET` y `ADMIN_PASSWORD`. Cualquiera con acceso al repo (o a un fork o clon viejo) puede firmar tokens de ADMIN.

- Rotar `JWT_SECRET`, `QR_SECRET` y la contraseña del admin en el VPS (invalida todas las sesiones, es lo esperado).
- Reemplazar los valores del archivo por placeholders.
- Si el repo es o fue público, considerar limpiar el historial (`git filter-repo`) además de rotar: rotar es lo que realmente protege.

### 1.2 El alta online marca la primera cuota como pagada sin cobrar - ALTA, PENDIENTE

`POST /api/public/register` crea un pago `COMPLETED` (`simulacion-web`) sin ningún cobro real, y el endpoint es público y sin límite. Cualquiera puede generar socios "al día" y ensuciar la caja y los reportes (el pago suma en el cierre de caja y en el dashboard).

- Hasta integrar Mercado Pago: crear la cuota como `PENDING` sin pago, o dejar el socio en estado `PENDING_APPROVAL` para que secretaría lo confirme.
- Con MP: crear la preferencia y registrar el pago solo desde el webhook.
- Agregar rate limit al endpoint en Nginx (hoy solo están los logins) y un captcha liviano (Cloudflare Turnstile o hCaptcha).

### 1.3 Login del socio con datos semipúblicos - ALTA, PENDIENTE

DNI + fecha de nacimiento siguen siendo el único factor (ítem 6 y §2 de `docs/propuesta-mejoras.md`). Con esos dos datos se ve el perfil y se genera el QR de acceso al club. Propuesta mínima: PIN de 4-6 dígitos que el socio define en el primer ingreso; ideal: código por email/WhatsApp.

### 1.4 Tokens de staff sin revocación - ALTA, PENDIENTE

El JWT dura 7 días y no se consulta la base: un usuario desactivado o al que se le baja el rol sigue operando hasta que vence el token. Opciones, de menor a mayor esfuerzo:

- En `get_staff_context`, verificar `usuarios.activo` y tomar el rol desde la base (una consulta por request por PK, costo despreciable).
- Agregar `token_version` al usuario y rechazar tokens con versión vieja (permite "cerrar todas las sesiones").
- Access token corto + refresh token rotativo.

### 1.5 Credenciales de Mercado Pago en texto plano - MEDIA, PENDIENTE

`mp_access_token` y `mp_webhook_secret` se guardan en claro en `configuracion_club` y `GET /api/club/config` los devuelve completos. Cifrarlos en reposo (Fernet con una clave del `.env`; `cryptography` ya es dependencia) y devolverlos enmascarados (`APP_USR-****1234`), aceptando el valor completo solo al escribir.

### 1.6 Webhook de MP sin secreto obligatorio - MEDIA, PENDIENTE

Si no hay `mpWebhookSecret`, el webhook acepta cualquier POST y consulta a MP. No permite falsificar pagos (el estado se lee de la API de MP), pero sí disparar llamadas a MP a voluntad. En producción, exigir el secreto cuando hay access token configurado.

### 1.7 CORS permisivo por defecto - MEDIA, PENDIENTE

Sin `FRONTEND_URL`, CORS queda en `*` con `allow_credentials=True`. En producción la web y la API comparten origen, así que CORS podría directamente desactivarse; si se mantiene, fallar cerrado cuando falta la variable.

### 1.8 Headers de seguridad - MEDIA, PENDIENTE

`nginx.conf` ya tiene `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`. Faltan `Strict-Transport-Security` (después de certbot) y una `Content-Security-Policy`. Con el token en `localStorage`, la CSP es la principal defensa contra XSS. Ojo: la landing usa imágenes de `images.unsplash.com` y fuentes de Google (self-hosted por `next/font`, no requieren excepción).

### 1.9 Documentación de la API pública en producción - BAJA, PENDIENTE

`/api/docs` y `/api/openapi.json` están expuestos en producción. Deshabilitarlos con una variable (`ENABLE_DOCS=0`) o protegerlos en Nginx.

### 1.10 Auditoría - MEDIA, PENDIENTE

No queda registro de quién registró un pago, borró un movimiento de caja o dio de baja un socio (`Attendance.createdBy` y `Transaction.createdBy` existen pero nunca se completan). Completar `creado_por` con `ctx.user["sub"]` y agregar una tabla `auditoria` para operaciones de dinero.

## 2. Estabilidad y consistencia de datos

### 2.1 Migraciones versionadas - ALTA, PENDIENTE

`db_init` usa `create_all`, que crea tablas nuevas pero no agrega columnas ni índices a tablas existentes. El próximo cambio de modelo en producción va a requerir SQL a mano. Adoptar Alembic (autogenerate) y correr `alembic upgrade head` en el `command` del compose en lugar de `db_init`.

### 2.2 Uniques que respalden la lógica - ALTA, PENDIENTE

Siguen pendientes los ítems 4 y 5 de `docs/propuesta-mejoras.md`:

- `pagos (metodo, referencia)` unique: MP reintenta webhooks y dos entregas concurrentes pueden duplicar el pago.
- `cuotas (socio_id, tipo_cuota_id, categoria_id, periodo)` unique: dos clics en "Generar cuotas" pueden duplicar el período.
- `Enrollment [socio_id, categoria_id, estado]` como unique impide inscribir, dar de baja y volver a inscribir dos veces (la segunda baja choca con la primera `INACTIVE`). Cambiar por un unique solo sobre inscripciones activas (columna generada `activa = IF(estado='ACTIVE', 1, NULL)`).

### 2.3 Zona horaria del club - ALTA, PENDIENTE

Todo se guarda en UTC naive, pero los cortes (cierre de caja del día, mes del dashboard, período de la cuota del alta online) se calculan en UTC: un pago cobrado a las 22 h en Argentina cae en el cierre de caja del día siguiente. Agregar `zona_horaria` a `configuracion_club` (default `America/Argentina/Buenos_Aires`) y calcular los rangos con `zoneinfo`.

### 2.4 Montos como float en reportes - MEDIA, PENDIENTE

Los reportes y el cierre de caja devuelven `float` (`_num`, `float(total)`). Mantener `Decimal` y serializar como string, igual que el resto del contrato.

### 2.5 Borrado físico de movimientos de caja - MEDIA, PENDIENTE

`DELETE /api/transactions/{id}` borra el registro. Para dinero conviene anulación con motivo (estado `VOIDED` + usuario + fecha), así el cierre de caja de días pasados no cambia sin rastro.

### 2.6 Pagos que exceden la cuota - BAJA, PENDIENTE

Se puede registrar un pago mayor al saldo o sobre una cuota ya `PAID`. Validar contra el saldo (o permitirlo explícitamente como "saldo a favor").

### 2.7 Tests automatizados - ALTA, PENDIENTE

No hay tests. La prueba de humo usada en esta revisión (login, CRUD, validaciones, pagos, portal del socio, QR, firma de MP) es una buena base para una suite `pytest` con base de test, más un job de CI (`pytest`, `npm run lint`, `npm run build`) que corra en cada push, antes del deploy.

### 2.8 Observabilidad - MEDIA, PENDIENTE

- `/health` no verifica la base: agregar un `SELECT 1` para que el healthcheck del compose y Nginx detecten una caída real.
- Agregar `healthcheck` al servicio `app` en `docker-compose.prod.yml`.
- Logging estructurado con request-id y Sentry (o GlitchTip self-hosted) para errores.

### 2.9 Backups - ALTA, PENDIENTE

No hay backup documentado de MariaDB ni de `recursos/`. Un `mariadb-dump` diario por cron con retención de 14 días y copia fuera del VPS (Backblaze B2, rclone) cubre el caso típico.

## 3. Rendimiento y velocidad

### 3.1 Índices faltantes - MEDIA, PENDIENTE

- `socios (apellido, nombre)`: el listado ordena por apellido.
- `cuotas (periodo)` y `cuotas (creado_en)`: filtros y orden del listado de cuotas.
- `pagos (pagado_en)`: dashboard y cierre de caja suman por rango de fecha.
- `inscripciones (socio_id)` ya lo cubre el unique; `asistencias (socio_id)` no tiene índice propio.

### 3.2 Búsqueda de socios - MEDIA, PENDIENTE

`LIKE '%texto%'` sobre nombre, apellido, DNI y email no usa índices. Con pocos miles de socios alcanza; si crece, un índice `FULLTEXT` sobre nombre y apellido, y búsqueda por prefijo (`LIKE 'texto%'`) en DNI.

### 3.3 Endpoints sin paginar - MEDIA, PENDIENTE

`/api/attendances`, `/api/transactions`, `/api/reports/members` y `/api/reports/fees` devuelven todo. Los reportes con un año de datos serializan miles de filas con relaciones. Paginar o, para reportes, devolver solo agregados más exportación CSV.

### 3.4 `db.refresh` innecesarios - BAJA, PENDIENTE

Con `expire_on_commit=False`, el `db.refresh()` después de cada `commit()` agrega un round-trip por request de escritura. Se puede quitar donde no hay valores generados por la base.

### 3.5 Workers y pool - BAJA, PENDIENTE

Producción corre `--workers 2` con el pool por defecto de SQLAlchemy (5 + 10 overflow por worker). Está bien para un club; si se agregan instancias en el mismo VPS, dimensionar `pool_size` y `max_connections` de MariaDB en conjunto.

### 3.6 Frontend - MEDIA, PENDIENTE

- La landing carga fotos de Unsplash a 1800 px sin `srcset`: usar fotos propias en `recursos/` en varios tamaños y `loading="lazy"` fuera del primer pantallazo.
- Socios, Cuotas y Asistencia vuelven a pedir `getDisciplines()` en cada visita (y Cuotas lo repite en cada cambio de filtro o página): con una capa de cache (ver 5.1) se pide una vez por sesión.
- Cuotas pide también `getFeeTypes()` en cada cambio de filtro: separar la carga de catálogos de la del listado.

## 4. Funcionales

| Prioridad | Propuesta | Detalle |
|---|---|---|
| ALTA | Pantalla de configuración del club | `PATCH /api/club/config` existe pero no hay UI: hoy nombre, colores, cuota social y credenciales de MP solo se cambian por API. |
| ALTA | Mercado Pago real en el portal del socio | El endpoint `/me/fees/{id}/mp-preference` ya existe; falta el botón "Pagar" y las páginas de retorno (`/member/payment/*` en `mp.member_back_urls` no existen en el frontend, deberían apuntar a `/socio/?status=...`). |
| ALTA | Gestión de usuarios del staff | No hay ABM de usuarios ni cambio de contraseña: el único usuario es el del seed. |
| MEDIA | Asistencia: editar la del día | Al abrir "Tomar asistencia" para una fecha ya cargada, precargar los presentes/ausentes existentes (hoy arranca todo en "presente" y pisa lo guardado). |
| MEDIA | Asistencia: elegir fecha en el listado | La pantalla solo muestra la asistencia de hoy. |
| MEDIA | Morosidad | Vista de socios con cuotas vencidas (por `fecha_vencimiento`), con total adeudado y contacto rápido por WhatsApp. |
| MEDIA | Exportación | CSV/Excel de socios, cuotas y caja desde Reportes. |
| MEDIA | Fotos de socios | Subida de foto (hoy es un campo de URL) guardando en `recursos/`, con recorte y compresión. |
| MEDIA | Noticias y eventos | Los modelos y la landing existen, pero no hay ABM en el admin (solo el seed los carga). |
| BAJA | Recibo de pago | PDF o imagen con los datos del pago para enviar al socio. |
| BAJA | Anulación de cuotas | Estado `CANCELLED` existe en el frontend pero no hay forma de usarlo. |

## 5. UI/UX

### 5.1 Capa de datos en el frontend - MEDIA, PENDIENTE

Todas las páginas cargan datos con `fetch` dentro de `useEffect`, lo que la nueva regla `react-hooks/set-state-in-effect` marca como advertencia (quedó en `warn` en `eslint.config.mjs`). Migrar a TanStack Query resuelve eso y además agrega cache, reintentos, invalidación tras mutaciones y estados de carga consistentes.

### 5.2 Consistencia entre pantallas - MEDIA, PENDIENTE

Socios y Disciplinas ya usan el kit nuevo (toasts, `confirmAction`, `PageHeader`, `EmptyState`, skeletons). Cuotas, Caja, Asistencia y Reportes siguen con `alert()`/`confirm()` del navegador, "Cargando..." en texto plano y montos sin formato (`$12000.00` en lugar de `$ 12.000`). Llevarlas al mismo kit y usar un único `formatMoney`.

### 5.3 Íconos - BAJA, PENDIENTE

El admin usa emojis como íconos (dashboard, acciones rápidas, estados vacíos, confirmaciones) y paths SVG copiados a mano en el layout. Reemplazar por `lucide-react`.

### 5.4 TypeScript 7 - BAJA, PENDIENTE

TypeScript 7.0.2 (compilador nativo) ya compila el proyecto con Next 16.3, pero typescript-eslint todavía no soporta su API. Cuando lo haga, subir `typescript` a `^7`. Mientras tanto, la alternativa oficial (alias `typescript` -> `@typescript/typescript6` y `@typescript/native` para `tsc`) no aporta velocidad al build de Next, que seguiría usando la API de TS 6.

### 5.5 Formularios - MEDIA, PENDIENTE

- Validación en el cliente (react-hook-form + zod) con errores junto a cada campo; hoy el error de la API aparece como toast genérico.
- `MemberForm` siempre envía `playerProfile` con campos vacíos, lo que crea un perfil de jugador para cada socio aunque no juegue. Enviarlo solo si algún campo tiene valor.
- El período de cuotas se escribe a mano (`AAAA-MM`): usar `<input type="month">`.
- `FeeGenerator` y la toma de asistencia ofrecen tipos de cuota y categorías inactivos: filtrarlos.

### 5.6 Accesibilidad - BAJA, PENDIENTE

- Los modales no atrapan el foco ni lo devuelven al cerrar.
- Los inputs del portal del socio y del alta online usan solo `placeholder` como etiqueta.
- Las tablas de socios, cuotas y reportes no tienen versión mobile (scroll horizontal): usar tarjetas en pantallas chicas.

### 5.7 Portal del socio como PWA - MEDIA, PENDIENTE

El carnet con QR es el caso de uso más frecuente del socio. Un `manifest.webmanifest` y un service worker mínimo permiten "instalar" el portal y abrir el carnet más rápido en la puerta del club.

## 6. Infraestructura

| Prioridad | Propuesta |
|---|---|
| ALTA | CI con tests y lint antes del build de la imagen (hoy el deploy es solo `workflow_dispatch` sin verificación). |
| MEDIA | Deploy por tag SHA en lugar de `:latest` (el workflow ya publica ambos): permite rollback con un `sed` y deja claro qué versión corre. |
| MEDIA | Correr el contenedor con un usuario sin privilegios (`USER app` en el Dockerfile). |
| MEDIA | `python:3.14-slim`: verificar compatibilidad de dependencias con Python 3.14 en local antes de cambiar la imagen. |
| BAJA | `.dockerignore` excluye `*.md`: correcto hoy, pero si algún README pasa a ser parte del build conviene listarlo explícitamente. |
| BAJA | Dependabot o Renovate para mantener dependencias y GitHub Actions actualizadas con PRs automáticos. |
