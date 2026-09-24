# Propuestas de mejora

Revisión integral del proyecto (backend FastAPI + frontend Next.js) al 2026-09-23. Complementa a `docs/propuesta-mejoras.md` (escrito durante el port desde NestJS): acá se prioriza sobre el código actual y se indica qué ítems de aquel documento siguen vigentes.

Etiquetas de prioridad: `BLOQUEANTE` (resolver antes del próximo deploy), `ALTA`, `MEDIA`, `BAJA`. Estado: `APLICADO`, `PENDIENTE`, `POSPUESTO` (por decisión del proyecto), `BLOQUEADO` (depende de terceros) o `DESCARTADO`.

Estado al 2026-09-24: todas las propuestas están aplicadas salvo 1.1 (pospuesta hasta el dominio definitivo), 5.4 (bloqueada por typescript-eslint) y el deploy por SHA (descartado). Lo que depende del club está en la sección 7.

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
- APLICADO (2026-09-24): captcha opcional con Cloudflare Turnstile. Con `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` en el `.env`, el formulario muestra el widget, el backend valida el token con Cloudflare (si Cloudflare no responde, rechaza) y la CSP habilita su dominio solo en ese caso. Sin las claves todo sigue igual. Probado de punta a punta con las claves de prueba de Cloudflare.
- El socio se sigue creando `ACTIVE` (puede entrar al portal y crear su PIN). Con Mercado Pago real, el pago se registra solo desde el webhook.

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
- APLICADO: "Mi cuenta" (cambio de contraseña y cierre de sesiones) y pantalla de Usuarios (ver sección 4).

### 1.5 Credenciales de Mercado Pago en texto plano - APLICADO

- Cifradas en reposo con Fernet (`crypto.py`, prefijo `enc:`). Clave: `SECRETS_KEY` del `.env`; si no está, se deriva de `JWT_SECRET`. Los valores viejos en texto plano se siguen leyendo y se cifran al volver a guardarlos.
- `GET /api/club/config` las devuelve enmascaradas (`APP_USR-****1234`); un `PATCH` con el valor enmascarado no las modifica.

### 1.6 Webhook de MP sin secreto obligatorio - APLICADO

Sin secreto de webhook configurado (base o `MERCADO_PAGO_WEBHOOK_SECRET`) el webhook responde 401 y no consulta a MP. Al activar Mercado Pago hay que cargar el secreto que da el panel de MP.

### 1.7 CORS permisivo por defecto - APLICADO

CORS solo se habilita para el origen de `FRONTEND_URL` y sin `allow_credentials` (la auth va por header, no por cookies). Sin la variable no se permite ningún origen cruzado. Si algún día la web se compila con `NEXT_PUBLIC_API_URL` apuntando a otro dominio, hay que sumarlo al `connect-src` de la CSP.

### 1.8 Headers de seguridad - APLICADO

La app pone los headers en todas las respuestas (así valen con o sin Nginx): `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y `Strict-Transport-Security` cuando la request llega por HTTPS (`X-Forwarded-Proto`). Se sacaron de `nginx.conf` para no duplicarlos.

APLICADO (2026-09-24): la CSP ya no permite `'unsafe-inline'` en scripts. Cada página HTML se sirve con los hashes SHA-256 de sus propios scripts inline (`csp.py`, calculados al servirla y cacheados por archivo); un script inyectado por un XSS no coincide con ningún hash. Los estilos siguen con `'unsafe-inline'` (atributos `style` de React; no ejecutan código). Las páginas HTML se sirven con `Cache-Control: no-cache` para que después de un deploy lleguen con sus hashes nuevos. Verificado en Chrome sin violaciones en las 16 pantallas.

### 1.9 Documentación de la API pública en producción - APLICADO

`ENABLE_DOCS=0` apaga `/api/docs` y `/api/openapi.json`. El compose de producción lo pone en 0 por defecto (se prende con `ENABLE_DOCS=1` en el `.env` del VPS).

### 1.10 Auditoría - APLICADO

- `Transaction.createdBy` y `Attendance.createdBy` se completan con el usuario.
- Tabla `auditoria` (`audit.py`): pagos manuales, webhooks de MP, generación de cuotas, altas y bajas de movimientos de caja, edición y baja de socios, blanqueo de PIN, cambios de configuración del club (solo los nombres de campo, nunca los valores de las credenciales), cambio de contraseña y cierre de sesiones.
- `GET /api/audit` (ADMIN, paginado, filtros `entity`, `entityId`, `userId`, `action`) y pantalla `/admin/auditoria` con filtros y detalle de cada registro.

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
- APLICADO: Nginx manda su `$request_id` como `X-Request-ID`: el mismo id aparece en el log de Nginx, en los de la app y en la respuesta.

### 2.9 Backups - APLICADO

- `scripts/backup.sh`: `mariadb-dump --single-transaction` comprimido + `tar` de `recursos/`, retención de 14 días (`BACKUP_RETENTION_DAYS`) y copia opcional fuera del VPS con rclone (`BACKUP_RCLONE_REMOTE`). Lee `DATABASE_URL` del `.env` del club y pasa las credenciales en un archivo temporal, no en la línea de comandos.
- El workflow de deploy copia el script al VPS. Falta programar el cron (una vez, ver deploy.md §5) y configurar el remoto de rclone.
- Probado localmente: dump, tar, retención y restauración completa en una base nueva.

## 3. Rendimiento y velocidad

Aplicado el 2026-09-24. Verificación: 58 tests de backend, migración 0003 probada con upgrade, downgrade y `alembic check`, `tsc`, `eslint` (0 errores, 5 advertencias preexistentes, antes 8), `next build` y una prueba de punta a punta en Chrome headless (13 pantallas del admin, recibo, portal del socio y landing sin errores de JavaScript, CSP ni red, más la subida de una imagen real desde la UI).

### 3.1 Índices faltantes - APLICADO

Migración `0003`: `socios (apellido, nombre)`, `cuotas (periodo)`, `cuotas (creado_en)`, `cuotas (estado, fecha_vencimiento)` para morosidad, `pagos (estado, pagado_en)` para dashboard y cierre de caja, `asistencias (fecha)`. `asistencias (socio_id)` no hacía falta: InnoDB ya creó ese índice para la clave foránea.

### 3.2 Búsqueda de socios - APLICADO

- Solo números: DNI o número de socio por prefijo, que usa los índices únicos.
- Texto: cada palabra debe aparecer en nombre, apellido o email ("juan per" encuentra a Juan Pérez), lo que además mejora la búsqueda.
- El texto sigue con `LIKE '%...%'`: alcanza para algunos miles de socios. `FULLTEXT` no se agregó a propósito: el tokenizador de InnoDB ignora palabras de menos de 3 letras y las stopwords, lo que empeoraría la búsqueda de apellidos cortos; se revisa si el padrón crece mucho.

### 3.3 Endpoints sin paginar - APLICADO

- `/api/reports/members`, `/api/reports/fees` y `/api/reports/income-expense` paginan (`page`, `limit` hasta 200) y calculan los totales sobre todo el filtro en la base, no sobre la página.
- Exportación CSV con todas las filas: `/api/reports/members.csv`, `fees.csv`, `cash.csv` (movimientos de caja y pagos de cuotas del rango) y `delinquency.csv`. Usan `;`, BOM UTF-8 y coma decimal para Excel en español, y protegen contra inyección de fórmulas.
- `/api/transactions` y `/api/attendances` tienen tope (`limit`, 500 por defecto, máximo 2000). Las pantallas siempre filtran por día.

### 3.4 `db.refresh` innecesarios - APLICADO

Se quitaron los 23. Los valores generados en Python (ids, fechas, `onupdate`) ya quedan en el objeto, y las relaciones se cargan al usarlas. La suite cubre las respuestas de escritura.

### 3.5 Workers y pool - APLICADO

Pool configurable con `DB_POOL_SIZE` y `DB_MAX_OVERFLOW` (5 + 5 por worker). Con 2 workers son 20 conexiones como máximo por club, lejos del `max_connections` por defecto de MariaDB (151) aunque haya varios clubes en el VPS.

### 3.6 Frontend - APLICADO

- Landing: las fotos pasan de fondo CSS a `<img>` con `srcset` (de 400 a 1800 px según la pantalla), carga diferida en las tarjetas y prioridad alta en la foto principal. APLICADO (2026-09-24): foto de portada (Configuración) y foto por disciplina (Disciplinas) subidas por el club; la web las usa en lugar de las genéricas (migración `0004`). Falta que el club cargue las suyas.
- Catálogos (disciplinas y tipos de cuota) con cache en memoria de 5 minutos, asociada al token e invalidada al modificarlos: Socios, Cuotas y Asistencia ya no los piden en cada visita o cambio de filtro.
- Cuotas separa la carga de catálogos (una vez) de la del listado (por filtro y página).
- Bug corregido: el router de Next 16 hace los prefetch con `HEAD` y la ruta que sirve la web solo aceptaba `GET` (respondía 405). El prefetch fallaba y cada navegación entre pantallas era una carga completa.

## 4. Funcionales

| Estado | Propuesta | Qué se hizo |
|---|---|---|
| APLICADO | Pantalla de configuración del club | `/admin/configuracion` (solo ADMIN): nombre, logo (subida), colores, cuota social, datos de contacto y credenciales de Mercado Pago (enmascaradas: solo se envían si se cambian). |
| APLICADO | Mercado Pago en el portal del socio | Botón "Pagar" en cada cuota pendiente (visible solo si el club tiene access token y secreto de webhook: `onlinePayments` en `/api/club`) y aviso del resultado al volver (`/socio/?status=success\|pending\|failure`). En Cuotas del admin, "Link MP" copia el link para mandarlo al socio. OJO: no se probó contra Mercado Pago real; probar con credenciales de prueba antes de habilitarlo. |
| APLICADO | Gestión de usuarios del staff | `/admin/usuarios` (solo ADMIN): alta, edición, rol, desactivación y contraseña nueva. Cambiar el rol, desactivar o blanquear la contraseña cierra las sesiones de ese usuario. No se puede quitar el último administrador activo ni quitarse el rol a uno mismo. "Mi cuenta" (clic en el usuario del menú): cambio de contraseña propia y cierre de sesión en todos los dispositivos. |
| APLICADO | Asistencia: editar la del día | Al tomar asistencia de una categoría y fecha ya cargadas se precargan presentes, ausentes y notas (antes arrancaba todo en "presente" y pisaba lo guardado). |
| APLICADO | Asistencia: elegir fecha en el listado | Selector de fecha con conteo de presentes y ausentes; "Tomar asistencia" abre con esa fecha. |
| APLICADO | Morosidad | `/admin/morosidad`: socios activos con cuotas vencidas (por fecha de vencimiento o, sin ella, período anterior al mes actual), total adeudado, detalle por cuota, búsqueda, CSV y botón de WhatsApp con el mensaje armado (normaliza teléfonos locales: 0, 15, +54). |
| APLICADO | Exportación | CSV de socios, cuotas y caja desde Reportes, y de morosidad desde su pantalla (ver 3.3). |
| APLICADO | Fotos de socios | Subida con recorte cuadrado y compresión en el navegador. El servidor valida con Pillow, vuelve a codificar como WEBP sin metadatos (EXIF y GPS) y la guarda en `recursos/socios/`. Al reemplazarla, la anterior se borra. Mismo mecanismo para el logo (`recursos/club/`) y las noticias (`recursos/noticias/`). Se ve en la tabla de socios y en el carnet del portal. |
| APLICADO | Noticias y eventos | `/admin/noticias`: noticias (borrador o publicada, imagen, slug único automático) y agenda de eventos (fecha y hora en hora del club, público o privado). |
| APLICADO | Recibo de pago | `/admin/recibo/?id=...` desde cada pago en Cuotas: datos del club, del socio y de la cuota con saldo, número de recibo, "Imprimir o guardar PDF" (al imprimir se oculta el menú) y "Enviar por WhatsApp". |
| APLICADO | Anulación de cuotas | "Anular" con motivo en cuotas sin pagos (`POST /api/fees/{id}/cancel`, queda en la auditoría). Las anuladas no suman en totales ni en morosidad, y no aceptan pagos. |

Los pendientes que surgieron (pantalla de auditoría, recibo desde el portal del socio y fotos propias en la web) quedaron aplicados el 2026-09-24.

## 5. UI/UX

Aplicado el 2026-09-24. Verificación: `tsc`, `eslint` con 0 errores y 0 advertencias (la regla `react-hooks/set-state-in-effect` pasó de advertencia a error), `next build` y una prueba de punta a punta en Chrome headless: 16 pantallas sin errores de JavaScript, de red ni de CSP; trampa de foco y Escape en modales; errores de validación junto a cada campo; vista de celular en tarjetas sin scroll horizontal; manifiesto y service worker del portal; alta online con captcha real (claves de prueba de Cloudflare).

### 5.1 Capa de datos en el frontend - APLICADO

TanStack Query en todas las pantallas del admin, el portal del socio y la landing (`lib/queries.ts`: claves por recurso, catálogos compartidos con 5 minutos de vigencia, sin reintentos ante errores 4xx). Las mutaciones invalidan lo que corresponde (un pago refresca cuotas, morosidad, caja, dashboard y reportes). Los listados paginados mantienen los datos anteriores mientras cargan la página siguiente. Al cerrar sesión se vacía la cache. Reemplaza a la cache casera de catálogos de la sección 3. Ninguna pantalla carga datos con `fetch` + `setState` dentro de `useEffect`.

### 5.2 Consistencia entre pantallas - APLICADO

Todas las pantallas usan el mismo kit: `PageHeader`, toasts, `confirmAction`, esqueletos de carga (`SkeletonRows`), estado de error con "Reintentar" (`ErrorState`), `Pagination` y `formatMoney` único (`lib/money.ts`). No queda ningún `alert()`, `confirm()` ni "Cargando..." en texto plano en el admin.

### 5.3 Íconos - APLICADO

`lucide-react` en el menú, el dashboard, las acciones de las tablas, los modales, los estados vacíos, la landing, el portal y el recibo. No quedan emojis de interfaz (los que se muestran son datos: el ícono que el club elige para cada disciplina).

### 5.4 TypeScript 7 - BLOQUEADO (externo)

typescript-eslint 8.70 sigue pidiendo `typescript <6.1`. Dependabot tiene ignorada la actualización mayor de TypeScript hasta que lo soporte.

### 5.5 Formularios - APLICADO

- react-hook-form + zod (`lib/validation.ts`) en todos los formularios: socio, disciplina, categoría, tipo de cuota, generador de cuotas, pago (no deja cobrar más que el saldo ni con fecha futura), movimiento de caja, inscripción, usuarios, noticias, eventos, configuración, portal del socio y alta online. Los errores aparecen junto a cada campo, con `aria-invalid` y `aria-describedby`.
- `MemberForm` manda el perfil deportivo solo si tiene algún dato (o si ya existía).
- Períodos con `<input type="month">`.
- El generador de cuotas, la inscripción y la toma de asistencia ofrecen solo tipos de cuota, disciplinas y categorías activas.

### 5.6 Accesibilidad - APLICADO

- Modales y confirmaciones: foco atrapado (Tab y Shift+Tab), Escape cierra, el foco vuelve al botón que los abrió, `aria-modal` y título asociado (`lib/useFocusTrap.ts`).
- Etiquetas visibles y asociadas (`htmlFor`) en todos los campos, incluidos el portal del socio y el alta online (antes solo `placeholder`).
- Botones de solo ícono con `aria-label`; los de las categorías se ven también con teclado y en celular (antes solo al pasar el mouse).
- Toasts anunciados a lectores de pantalla (`aria-live`).
- Socios y cuotas se ven como tarjetas en pantallas chicas; los reportes usan `DataList` (tabla en escritorio, tarjetas en celular). En celular, los modales se abren desde abajo.

### 5.7 Portal del socio como PWA - APLICADO

- Manifiesto dinámico (`/socio/manifest.webmanifest`, con el nombre y color del club) e íconos (192, 512 y maskable).
- Service worker (`/sw.js`, scope `/socio/`): páginas del portal con red primero y copia sin conexión, recursos de Next con cache primero, la API nunca se cachea (lleva el token y datos personales).
- "Instalar" desde el navegador abre directo el carnet. Sin señal, abre la última versión del portal y avisa que el QR se actualiza al volver la conexión (el QR vence a los 5 minutos, así que no se puede guardar).
- Además: el socio ve sus últimos pagos y abre o descarga el recibo de cada uno (`/socio/recibo/`).

## 6. Infraestructura

| Estado | Propuesta |
|---|---|
| APLICADO | CI con tests y lint antes del build de la imagen (ver 2.7). Corre desde el workflow de deploy. |
| DESCARTADO | Deploy por tag SHA en lugar de `:latest`: el deploy usa `:latest` por decisión del proyecto (queda igual que el resto de los servicios del VPS). El workflow publica también el tag SHA, así que el rollback sigue siendo posible editando la línea `image:` (ver deploy.md). |
| APLICADO | Contenedor sin privilegios: usuario `app` (UID 1000, configurable con `APP_UID`). El deploy corrige el dueño de `recursos/` con la propia imagen antes de levantarla (el VPS no necesita sudo). |
| APLICADO | `python:3.14-slim`: todas las dependencias tienen wheels para 3.14 y la suite pasa con Python 3.14.7 tratando las advertencias de deprecación como errores. El CI también usa 3.14. |
| SIN CAMBIOS | `.dockerignore` excluye `*.md`: ningún Markdown forma parte del build. |
| APLICADO | Dependabot (`.github/dependabot.yml`): pip, npm, GitHub Actions y la imagen de Docker, semanal y con las versiones menores agrupadas. Como el CI corre solo desde el deploy, antes de mergear un PR hay que correr `pytest` y el build localmente. |

## 7. Pendientes que dependen del club

- Rotar los secretos y limpiar `.env.local.example` al pasar al dominio definitivo (1.1).
- Cargar las fotos propias: portada en Configuración y una por disciplina en Disciplinas (la web ya las usa en lugar de las genéricas).
- Mercado Pago: probar con credenciales de prueba antes de cargar las reales.
- Captcha: si aparece spam en el alta online, cargar las claves de Cloudflare Turnstile en el `.env` (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`).
- Operación del VPS: copiar `nginx.conf` (rate limit del alta y `X-Request-ID`), programar el cron de `scripts/backup.sh` y configurar el remoto de rclone.
