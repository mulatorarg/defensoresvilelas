# Deploy — Club Defensores de Vilelas

Deploy **automático**: push a `main` → GitHub Actions buildea la imagen (frontend + backend, un solo puerto), la publica en **GHCR** y actualiza el VPS por SSH.

El VPS ya tiene **MariaDB y Nginx instalados a nivel de sistema operativo**: el contenedor solo corre la app y se conecta a la base del host.

```
push a main ──► GitHub Actions ──► ghcr.io/<usuario>/<repo>:latest
                                        │
                                        ▼ (SSH)
Internet ──► Nginx del host (defensores.yacarestudio.com, TLS)
                 │ proxy_pass 127.0.0.1:${PORT} (3030)
                 ▼
        /home/deploy/defensores
        ├── .env                  ← identidad del club (manual, una vez)
        ├── docker-compose.yml    ← lo copia el workflow en cada deploy
        └── recursos/             ← volumen persistente (fotos de socios, docs)
                 │
                 ▼
        contenedor app (uvicorn :3001) ──► MariaDB del host (host.docker.internal:3306)
```

La imagen expone **un único puerto**: la API sirve también la web estática (`/`) y los archivos del club (`/recursos/*`). La misma API queda lista para la futura **app móvil** (JWT, contrato en `/api/docs`).

---

## 1. Secrets del repositorio (GitHub → Settings → Secrets → Actions)

| Secret | Ejemplo | Descripción |
|---|---|---|
| `VPS_HOST` | `200.58.x.x` | IP o dominio del VPS |
| `VPS_USER` | `deploy` | Usuario SSH |
| `VPS_PORT` | `22` | Puerto SSH |
| `VPS_SSH_PRIVATE_KEY` | `-----BEGIN OPENSSH...` | Clave privada; su `.pub` va en `~/.ssh/authorized_keys` del VPS |

> `GITHUB_TOKEN` lo provee Actions automáticamente (push a GHCR y `docker login` en el VPS).

## 2. Preparación del VPS (una sola vez)

MariaDB y Nginx ya están instalados a nivel OS; solo falta Docker y la carpeta:

```bash
# Docker + usuario deploy con permisos
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

# Carpeta del proyecto
mkdir -p /home/deploy/defensores/recursos
```

### Base de datos en el MariaDB del host

El contenedor llega al host vía `host.docker.internal` (IP del bridge de Docker, normalmente `172.17.0.1`), así que el usuario de la base debe aceptar conexiones desde esa red:

```sql
CREATE DATABASE clubes_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'clubes_user'@'localhost' IDENTIFIED BY 'clubes_pass';
CREATE USER 'clubes_user'@'%' IDENTIFIED BY 'clubes_pass';
GRANT ALL PRIVILEGES ON clubes_db.* TO 'clubes_user'@'localhost';
GRANT ALL PRIVILEGES ON clubes_db.* TO 'clubes_user'@'%';
FLUSH PRIVILEGES;
```

Y MariaDB debe escuchar más allá de localhost. En `/etc/mysql/mariadb.conf.d/50-server.cnf`:

```ini
# Escuchar en localhost + bridge de Docker (o usar 0.0.0.0 + firewall que
# bloquee el 3306 desde afuera)
bind-address = 0.0.0.0
```

```bash
sudo systemctl restart mariadb
# Firewall: el 3306 NUNCA expuesto a internet
sudo ufw deny 3306
```

### `/home/deploy/defensores/.env`

```env
# Puerto único de la app en el host (Nginx apunta acá)
PORT=3030

# MariaDB del host, visto desde el contenedor
DATABASE_URL=mysql://clubes_user:una-clave-fuerte@host.docker.internal:3306/clubes_db

# Seguridad - generar con: openssl rand -hex 32
JWT_SECRET=................................
QR_SECRET=................................
# Opcional: clave Fernet para cifrar las credenciales de Mercado Pago en la base
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# SECRETS_KEY=................................
# Opcional: 1 para ver /api/docs en producción (por defecto apagado)
# ENABLE_DOCS=0
# Opcional: captcha del alta online (Cloudflare Turnstile, gratis). Sin las dos claves no se usa.
# TURNSTILE_SITE_KEY=................................
# TURNSTILE_SECRET_KEY=................................

# URLs públicas
FRONTEND_URL=https://defensores.yacarestudio.com
API_PUBLIC_URL=https://defensores.yacarestudio.com/api/payments/mercado-pago/webhook

# Primer arranque (seed): club + admin
CLUB_NAME=Club Atlético Defensores de Vilelas
ADMIN_EMAIL=admin@defensores.com
ADMIN_PASSWORD=clave-inicial-fuerte
```

### Nginx + TLS (ya instalado — solo agregar el sitio)

El archivo [`nginx.conf`](nginx.conf) del repo ya está armado para `defensores.yacarestudio.com`:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/defensores
sudo ln -s /etc/nginx/sites-available/defensores /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d defensores.yacarestudio.com
```

(DNS: registro A de `defensores.yacarestudio.com` → IP del VPS.)

Cuando cambia `nginx.conf` en el repo (por ejemplo, el rate limit del alta online o el `X-Request-ID`), volver a copiarlo y recargar. Si certbot ya agregó el bloque 443, conviene editar el archivo de `sites-available` a mano con los cambios en lugar de pisarlo. Los headers de seguridad (CSP, HSTS, etc.) los pone la app: si el archivo del VPS todavía tiene `add_header X-Frame-Options ...`, sacarlo.

## 3. Primer deploy y siguientes

```bash
git push origin main        # eso es todo
```

El workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)):

1. Corre el CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)): tests del backend contra MariaDB, `alembic check`, lint y build del frontend. Si falla, no sigue.
2. Buildea `apps/backend/Dockerfile` (compila el frontend adentro) y pushea `latest` + SHA a GHCR.
3. Copia `docker-compose.prod.yml` al VPS como `docker-compose.yml` (inyectándole la imagen `ghcr.io/<repo>:latest`; cada build publica además el tag `<sha>` para rollbacks) y `scripts/backup.sh`.
4. `docker compose pull && up -d`: al arrancar, `db_init` aplica las migraciones de Alembic y `seed` deja la config del club + el admin (idempotentes: nunca pisan datos).
   Antes de levantar corre `chown` sobre `recursos/` con la propia imagen como root: la app corre con un usuario sin privilegios (`app`, UID 1000) y tiene que poder escribir las fotos que se suben. No hace falta sudo en el VPS.

También se puede disparar a mano desde la pestaña Actions (`workflow_dispatch`).

### Verificación post-deploy

```bash
curl https://defensores.yacarestudio.com/health
# → {"status":"ok","database":"ok", ...}   (503 si la base no responde)
docker compose ps                 # el servicio app debe figurar "healthy"
docker compose logs app | grep "Base '"   # migración aplicada, p. ej. "(migración 0002)"
```

Si una migración falla (por ejemplo, por datos duplicados que impiden crear un unique), el contenedor no arranca y el log dice qué resolver. Después de corregirlo, `docker compose up -d` retoma desde el paso que faltaba.

Después: entrar a `/login` con `ADMIN_EMAIL` / `ADMIN_PASSWORD` y completar la configuración del club (logo, colores, cuota social, credenciales de Mercado Pago) vía `PATCH /api/club/config`.

## 4. La carpeta `recursos/`

Las imágenes subidas desde el admin se guardan como WEBP en `recursos/socios/`, `recursos/club/` (logo, portada de la web y fotos de disciplinas) y `recursos/noticias/`. Entran en el backup de `scripts/backup.sh`.

Volumen montado en `/app/recursos` dentro del contenedor y servido por la API en `https://.../recursos/...`. Ahí vive todo lo que debe **sobrevivir a los deploys**: fotos de socios, escudo, documentos. Ejemplo: subir `recursos/socios/00001.jpg` al VPS y asignar `photoUrl: /recursos/socios/00001.jpg` al socio.

## 5. Backups

[`scripts/backup.sh`](scripts/backup.sh) (el deploy lo copia a `/home/deploy/defensores/scripts/`) hace el dump de la base del club + un tar de `recursos/`, borra lo que tenga más de 14 días y, si hay remoto de rclone configurado, copia todo fuera del VPS. Lee `DATABASE_URL` del `.env` del club.

Programarlo una vez con `crontab -e` (usuario `deploy`):

```bash
15 4 * * * /home/deploy/defensores/scripts/backup.sh /home/deploy/defensores >> /home/deploy/defensores/backups/backup.log 2>&1
```

Opcional en el `.env`: `BACKUP_DIR`, `BACKUP_RETENTION_DAYS` y `BACKUP_RCLONE_REMOTE` (p. ej. `b2:clubes-backups/defensores`, después de `rclone config`). Un backup que vive solo en el VPS no protege de perder el VPS: configurar el remoto.

Restaurar:

```bash
gunzip -c backups/db-clubes_db-AAAAMMDD-HHMMSS.sql.gz | mariadb -u clubes_user -p clubes_db
tar -xzf backups/recursos-AAAAMMDD-HHMMSS.tar.gz -C /home/deploy/defensores
docker compose restart app
```

## 6. Operación

```bash
cd /home/deploy/defensores
docker compose ps                 # estado
docker compose logs -f app        # logs de la app
docker compose restart app        # reinicio
docker compose pull && docker compose up -d   # actualizar a mano (sin Actions)
```

**Rollback**: dos opciones - re-ejecutar el workflow desde el commit anterior (pestaña Actions → Re-run), o en el VPS editar la línea `image:` del `docker-compose.yml` con el SHA anterior y `docker compose up -d`. OJO: la imagen vieja no deshace migraciones. Las migraciones aditivas (columnas o tablas nuevas) no molestan a una versión anterior; si el rollback cruza una que no lo es, primero hacer un backup y bajar la base con la imagen nueva: `docker compose run --rm app python -m app.db_init --downgrade <revisión>`.

**Cambios de schema**: van por migraciones de Alembic en el repo; se aplican solas en el arranque (`db_init`).

**Errores**: con `SENTRY_DSN` en el `.env` los errores no manejados llegan a Sentry o GlitchTip. Cada respuesta trae `X-Request-ID`, que aparece en las líneas de `docker compose logs app` de ese request.

## 7. Desarrollo local (referencia rápida)

```bash
# Con Docker (usa docker-compose.yml del repo; MariaDB en host 3307)
docker compose up --build          # → http://localhost:3001

# Sin Docker
cd apps/backend
.venv\Scripts\python -m app.db_init --reset
.venv\Scripts\python -m app.seed --demo
.venv\Scripts\uvicorn app.main:app --reload --port 3001
.venv\Scripts\pytest              # tests (base clubes_test, se recrea en cada corrida)
cd apps/frontend && npm run dev    # → http://localhost:3000
```


En el VPS, desde la carpeta del proyecto:

```sh
cd /home/deploy/defensores
docker compose exec app python -m app.seed           # config del club + admin
docker compose exec app python -m app.seed --demo    # + contenido de ejemplo
```

Credenciales demo: `admin@clubes.local / admin123`.
