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

Aplicado el 2026-09-23 (segunda pasada). Verificación: 62 pruebas de humo contra la API sobre una base creada con el esquema anterior y migrada con `db_init` (tokens, PIN, cifrado, webhook, auditoría, CORS, headers, regresiones), `tsc`, `eslint` (0 errores), `next build` y render en Chrome headless sin violaciones de CSP.

Cambios de esquema (los aplica `python -m app.db_init` en el arranque del contenedor, sin SQL manual): `usuarios.version_token`, `socios.hash_pin`, `socios.pin_intentos_fallidos`, `socios.pin_bloqueado_hasta`, `socios.version_token`, tabla `auditoria`, y `configuracion_club.mp_access_token` / `mp_webhook_secret` pasan a `TEXT`. `db_init` ahora agrega columnas e índices faltantes a tablas existentes (`sync_schema`); sigue sin borrar ni renombrar (ver 2.1).

### 1.1 Secretos versionados en git - POSPUESTO

`.env.local.example` tiene valores reales de `JWT_SECRET`, `QR_SECRET` y `ADMIN_PASSWORD`. Se deja así a propósito mientras el repo sea privado y el dominio (`defensores.yacarestudio.com`) sea de pruebas sin datos reales.

OJO, antes de pasar al dominio definitivo o cargar datos reales:

- Rotar `JWT_SECRET`, `QR_SECRET` y la contraseña del admin en el VPS (invalida todas las sesiones, es lo esperado). Rotar `JWT_SECRET` sin `SECRETS_KEY` definido vuelve ilegibles las credenciales de MP guardadas (ver 1.5): definir `SECRETS_KEY` primero o recargarlas después.
- Reemplazar los valores del archivo por placeholders.
- Si el repo pasa a ser público, limpiar el historial (`git filter-repo`) además de rotar.

### 1.2 El alta online marcaba la primera cuota como pagada sin cobrar - APLICADO

- `POST /api/public/register` ya no crea el pago simulado (`simulacion-web`): la cuota queda `PENDING` y se paga en secretaría. El formulario dice "Asociarme" y el mensaje final aclara que la cuota está pendiente.
- Honeypot: campo oculto `website`; si viene completo, 400.
- `nginx.conf`: zona `register_zone` (5 altas por hora por IP, burst 3). Hay que copiar el archivo al VPS (ver deploy.md).
- PENDIENTE: el socio se crea `ACTIVE` y puede entrar al portal. Si aparece spam, pasar a `PENDING_APPROVAL` o sumar un captcha (Cloudflare Turnstile). Con Mercado Pago real: crear la preferencia y registrar el pago solo desde el webhook.

### 1.3 Login del socio con datos semipúblicos - APLICADO

- PIN de 4 a 6 dígitos (bcrypt). En el primer ingreso, DNI + fecha de nacimiento responde `pinSetupRequired` y el portal pide crear el PIN.
- 5 intentos fallidos bloquean el PIN 15 minutos (429), incluso con el PIN correcto.
- El socio lo cambia desde el portal (sección "Cambiar PIN"); secretaría lo blanquea desde Socios (ícono de llave, `POST /api/members/{id}/reset-pin`). Ambos cierran las sesiones abiertas del socio.
- Limitación conocida: quien tenga DNI y fecha de nacimiento de un socio que todavía no creó su PIN puede crearlo primero. Se corrige blanqueando el PIN; la solución de fondo es un código por email/WhatsApp en el primer ingreso.

### 1.4 Tokens de staff sin revocación - APLICADO

- Cada request de staff lee el usuario por PK: si está inactivo, cambió de rol o su `version_token` no coincide con el claim `tv` del JWT, se rechaza al instante. El rol se toma de la base, no del token.
- `POST /api/auth/logout-all` (cierra todas las sesiones propias) y `POST /api/auth/change-password` (cierra las demás y devuelve un token nuevo).
- Los tokens del socio también llevan `tv` y se validan contra la base (socio dado de baja = 401).
- Los tokens emitidos antes de este cambio (sin `tv`) siguen valiendo hasta vencer o hasta el primer `logout-all`.
- PENDIENTE: UI para cambiar la contraseña del staff y ABM de usuarios (ver sección 4).

### 1.5 Credenciales de Mercado Pago en texto plano - APLICADO

- Cifradas en reposo con Fernet (`crypto.py`, prefijo `enc:`). Clave: `SECRETS_KEY` del `.env`; si no está, se deriva de `JWT_SECRET`. Los valores viejos en texto plano se siguen leyendo y se cifran al volver a guardarlos.
- `GET /api/club/config` las devuelve enmascaradas (`APP_USR-****1234`); un `PATCH` con el valor enmascarado no las modifica.

### 1.6 Webhook de MP sin secreto obligatorio - APLICADO

Sin secreto de webhook configurado (base o `MERCADO_PAGO_WEBHOOK_SECRET`) el webhook responde 401 y no consulta a MP. Al activar Mercado Pago hay que cargar el secreto que da el panel de MP.

### 1.7 CORS permisivo por defecto - APLICADO

CORS solo se habilita para el origen de `FRONTEND_URL` y sin `allow_credentials` (la auth va por header, no por cookies). Sin la variable no se permite ningún origen cruzado. Si algún día la web se compila con `NEXT_PUBLIC_API_URL` apuntando a otro dominio, hay que sumarlo al `connect-src` de la CSP.

### 1.8 Headers de seguridad - APLICADO

La app pone los headers en todas las respuestas (así valen con o sin Nginx): `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y `Strict-Transport-Security` cuando la request llega por HTTPS (`X-Forwarded-Proto`). Se sacaron de `nginx.conf` para no duplicarlos.

La CSP permite `'unsafe-inline'` en scripts y estilos porque el export estático de Next los emite inline. Aun así bloquea scripts externos, envío de datos a otros dominios (`connect-src`, `form-action`) y el embebido en iframes. PENDIENTE (BAJA): CSP con hashes de los scripts inline generados en el build, para poder quitar `'unsafe-inline'`.

### 1.9 Documentación de la API pública en producción - APLICADO

`ENABLE_DOCS=0` apaga `/api/docs` y `/api/openapi.json`. El compose de producción lo pone en 0 por defecto (se prende con `ENABLE_DOCS=1` en el `.env` del VPS).

### 1.10 Auditoría - APLICADO

- `Transaction.createdBy` y `Attendance.createdBy` se completan con el usuario.
- Tabla `auditoria` (`audit.py`): pagos manuales, webhooks de MP, generación de cuotas, altas y bajas de movimientos de caja, edición y baja de socios, blanqueo de PIN, cambios de configuración del club (solo los nombres de campo, nunca los valores de las credenciales), cambio de contraseña y cierre de sesiones.
- `GET /api/audit` (ADMIN, paginado, filtros `entity`, `entityId`, `userId`). PENDIENTE: pantalla en el admin.

## 2. Estabilidad y consistencia de datos

Aplicado el 2026-09-23 (tercera pasada). Verificación: suite `pytest` nueva (40 tests contra MariaDB, base creada con las migraciones reales), migraciones probadas sobre base vacía, sobre una base con el esquema de producción (commit `5f4dde3`) y retomando tras un fallo a mitad de camino; `alembic check` sin diferencias entre modelos y base; downgrade/upgrade; backup y restauración completa en una base nueva; `tsc`, `eslint` (0 errores) y `next build`.

### 2.1 Migraciones versionadas - APLICADO

- Alembic (`app/migrations/`). `python -m app.db_init` corre `alembic upgrade head` (sigue siendo el `command` del compose, así que cada deploy migra solo). `--reset` borra todo y migra desde cero.
- `0001_esquema_base`: el esquema completo. También adopta las bases creadas antes con `create_all` (producción y desarrollo): crea solo las tablas que faltan y agrega las columnas de la sección 1. No hace falta `alembic stamp` a mano.
- `0002_consistencia_datos`: los cambios de esta sección. Como el DDL de MariaDB no es transaccional, cada paso verifica si ya se aplicó: si falla a mitad (p. ej. por duplicados), se corrige y se vuelve a correr.
- Cambios de modelo nuevos: `alembic revision --autogenerate -m "..."` desde `apps/backend` (usa `alembic.ini` y `DATABASE_URL`), revisar el archivo generado y commitearlo. El CI corre `alembic check` y falla si `models.py` cambió sin migración.
- Se quitó `sync_schema` de `db_init` (lo reemplaza la 0001).

### 2.2 Uniques que respalden la lógica - APLICADO

MariaDB no considera iguales los `NULL` en un unique, por eso los tres usan columnas generadas (`STORED`):

- `pagos.referencia_mp` = `referencia` solo si `metodo = 'MERCADO_PAGO'`, unique. Los pagos manuales pueden repetir referencia; un pago de MP no se registra dos veces. El webhook atrapa el choque de dos entregas simultáneas y responde OK.
- `cuotas (socio_id, periodo, tipo_clave, categoria_clave)` unique, con `COALESCE(..., '')` para que valga también en la cuota social (sin categoría). Si dos "Generar cuotas" corren a la vez, el segundo responde 409.
- `inscripciones.activa` = 1 si `estado = 'ACTIVE'`, si no `NULL`; unique `(socio_id, categoria_id, activa)`. Reemplaza al unique con `estado`: ahora se puede inscribir y dar de baja las veces que haga falta.
- Si la base ya tiene duplicados, la migración se detiene y los lista; no borra datos.

### 2.3 Zona horaria del club - APLICADO

- Criterio único: la base guarda todo en UTC, sin depender de la configuración del VPS ni de MariaDB (la sesión se fija en `time_zone = '+00:00'` al abrir cada conexión y el contenedor corre con `TZ=UTC`). La hora del club es `CLUB_TIMEZONE` en el `.env` (default `America/Argentina/Buenos_Aires`, validada al arrancar): es una constante del proceso, sin consultas a la base. Se agregó `tzdata` para Windows y la imagen slim.
- El frontend muestra siempre la hora del club, sin importar la zona del navegador (`lib/dates.ts`: `todayLocal`, `currentPeriod`, `formatDate`, `formatDateTime` en 24 h, `formatDateOnly` para fechas de calendario). Probado con MariaDB en `+09:00` y con el navegador simulado en UTC.
- `clock.py`: "hoy", el mes corriente y el rango UTC de un día local. Lo usan el dashboard, el cierre de caja, el período de la cuota del alta online, la fecha por defecto de los movimientos y el seed demo.
- Bug corregido de paso: el pago manual manda solo la fecha (`2026-09-23`), que se guardaba como 00:00 UTC (21:00 del día anterior en Argentina) y no aparecía en el cierre de caja del día. Ahora una fecha sin hora es un día local (hora actual si es hoy, mediodía si es otro día).
- Bug corregido: `parse_datetime` convertía fechas con zona a la hora local del servidor en lugar de UTC.

### 2.4 Montos como float en reportes - APLICADO

Dashboard, reporte de cuotas, ingresos/egresos y cierre de caja devuelven strings decimales, como el resto de la API. El dashboard suma `balanceThisMonth` en el backend. En el frontend, `lib/money.ts` (`formatMoney`, `toNumber`) evita concatenar strings al sumar.

### 2.5 Borrado físico de movimientos de caja - APLICADO

`DELETE /api/transactions/{id}` ya no existe. `POST /api/transactions/{id}/void` con `reason` (obligatorio) marca `estado = VOIDED` con usuario, fecha y motivo, y queda en la auditoría. Los anulados no suman en caja ni reportes, pero siguen en el listado (`includeVoided=false` para ocultarlos). En Caja, el botón pasa a "Anular" con un modal que pide el motivo; los anulados se ven tachados con su motivo.

### 2.6 Pagos que exceden la cuota - APLICADO

`POST /api/payments` rechaza (400) un monto mayor al saldo o un pago sobre una cuota `PAID`/`CANCELLED`. El webhook de MP no se valida (registra lo que MP efectivamente cobró). La preferencia de MP del admin cobra el saldo, igual que la del portal. El "saldo a favor" queda fuera de alcance.

### 2.7 Tests automatizados - APLICADO

- `apps/backend/tests/` (pytest + TestClient): auth y revocación, PIN del socio, alta online, credenciales de MP, webhook, CORS, headers, health, auditoría, uniques, zona horaria, decimales, anulación, saldo y listados. Usa `TEST_DATABASE_URL` (default `mysql://root@localhost:3306/clubes_test`; el nombre debe contener `test`) y la recrea en cada corrida.
- `pip install -r requirements-dev.txt` y `pytest` desde `apps/backend`.
- `.github/workflows/ci.yml`: en cada push y PR, backend (MariaDB 11 como servicio, `db_init` + `alembic check` + `pytest`) y frontend (`npm ci`, lint, `tsc`, build). El workflow de deploy lo llama antes de construir la imagen: si falla, no se deploya. OJO: no se pudo ejecutar localmente; validar en la primera corrida en GitHub.

### 2.8 Observabilidad - APLICADO

- `/health` hace `SELECT 1` y responde 503 si la base no contesta.
- `healthcheck` del servicio `app` en ambos compose (`docker compose ps` muestra `healthy`/`unhealthy`).
- `observability.py`: request-id por request (respeta `X-Request-ID` entrante y lo devuelve), en todas las líneas de log, más una línea por request a `/api/*` con estado y duración.
- Sentry o GlitchTip opcional con `SENTRY_DSN` (`sentry-sdk`, sin datos personales). Sin DSN no hace nada.
- PENDIENTE (BAJA): que Nginx genere el `X-Request-ID` (`proxy_set_header X-Request-ID $request_id;`) para correlacionar con sus logs.

### 2.9 Backups - APLICADO

- `scripts/backup.sh`: `mariadb-dump --single-transaction` comprimido + `tar` de `recursos/`, retención de 14 días (`BACKUP_RETENTION_DAYS`) y copia opcional fuera del VPS con rclone (`BACKUP_RCLONE_REMOTE`). Lee `DATABASE_URL` del `.env` del club y pasa las credenciales en un archivo temporal, no en la línea de comandos.
- El workflow de deploy copia el script al VPS. Falta programar el cron (una vez, ver deploy.md §5) y configurar el remoto de rclone.
- Probado localmente: dump, tar, retención y restauración completa en una base nueva.

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
| ALTA | Mercado Pago real en el portal del socio | El endpoint `/me/fees/{id}/mp-preference` ya existe; falta el botón "Pagar" y mostrar el resultado en `/socio/?status=...` (las URLs de retorno ya apuntan ahí). |
| ALTA | Gestión de usuarios del staff | No hay ABM de usuarios; el cambio de contraseña ya tiene endpoint (`POST /api/auth/change-password`) pero no pantalla. |
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
| APLICADO | CI con tests y lint antes del build de la imagen (ver 2.7). |
| MEDIA | Deploy por tag SHA en lugar de `:latest` (el workflow ya publica ambos): permite rollback con un `sed` y deja claro qué versión corre. |
| MEDIA | Correr el contenedor con un usuario sin privilegios (`USER app` en el Dockerfile). |
| MEDIA | `python:3.14-slim`: verificar compatibilidad de dependencias con Python 3.14 en local antes de cambiar la imagen. |
| BAJA | `.dockerignore` excluye `*.md`: correcto hoy, pero si algún README pasa a ser parte del build conviene listarlo explícitamente. |
| BAJA | Dependabot o Renovate para mantener dependencias y GitHub Actions actualizadas con PRs automáticos. |
