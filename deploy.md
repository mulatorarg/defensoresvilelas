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
CREATE USER 'clubes_user'@'172.%' IDENTIFIED BY 'una-clave-fuerte';
GRANT ALL PRIVILEGES ON clubes_db.* TO 'clubes_user'@'172.%';
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
# Imagen que publica el workflow (ajustar usuario/repo)
DEPLOY_IMAGE=ghcr.io/TU_USUARIO/TU_REPO:latest

# Puerto único de la app en el host (Nginx apunta acá)
PORT=3030

# MariaDB del host, visto desde el contenedor
DATABASE_URL=mysql://clubes_user:una-clave-fuerte@host.docker.internal:3306/clubes_db

# Seguridad — generar con: openssl rand -hex 32
JWT_SECRET=................................
QR_SECRET=................................

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

## 3. Primer deploy y siguientes

```bash
git push origin main        # eso es todo
```

El workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)):

1. Buildea `apps/backend/Dockerfile` (compila el frontend adentro) y pushea `latest` + SHA a GHCR.
2. Copia `docker-compose.prod.yml` al VPS como `docker-compose.yml`.
3. `docker compose pull && up -d` — en el primer arranque `db_init` crea las tablas y `seed` deja la config del club + el admin (idempotentes: nunca pisan datos).

También se puede disparar a mano desde la pestaña Actions (`workflow_dispatch`).

### Verificación post-deploy

```bash
curl https://defensores.yacarestudio.com/health
# → {"status":"ok", ...}
```

Después: entrar a `/login` con `ADMIN_EMAIL` / `ADMIN_PASSWORD` y completar la configuración del club (logo, colores, cuota social, credenciales de Mercado Pago) vía `PATCH /api/club/config`.

## 4. La carpeta `recursos/`

Volumen montado en `/app/recursos` dentro del contenedor y servido por la API en `https://.../recursos/...`. Ahí vive todo lo que debe **sobrevivir a los deploys**: fotos de socios, escudo, documentos. Ejemplo: subir `recursos/socios/00001.jpg` al VPS y asignar `photoUrl: /recursos/socios/00001.jpg` al socio.

## 5. Backups

```bash
# /etc/cron.daily/backup-defensores  (la base vive en el MariaDB del host)
mariadb-dump -u root clubes_db | gzip > /backups/clubes_db_$(date +%F).sql.gz
tar czf /backups/recursos_$(date +%F).tar.gz -C /home/deploy/defensores recursos/
find /backups -mtime +30 -delete
```

Guardar copia fuera del VPS (rclone a storage externo).

## 6. Operación

```bash
cd /home/deploy/defensores
docker compose ps                 # estado
docker compose logs -f app        # logs de la app
docker compose restart app        # reinicio
docker compose pull && docker compose up -d   # actualizar a mano (sin Actions)
```

**Rollback**: `DEPLOY_IMAGE=ghcr.io/usuario/repo:<sha-anterior>` en el `.env` y `docker compose up -d` (cada build también se publica con el SHA del commit).

**Cambios de schema**: `db_init` crea tablas nuevas automáticamente; no altera columnas existentes (para eso, migración manual planificada).

## 7. Desarrollo local (referencia rápida)

```bash
# Con Docker (usa docker-compose.yml del repo; MariaDB en host 3307)
docker compose up --build          # → http://localhost:3001

# Sin Docker
cd apps/backend
.venv\Scripts\python -m app.db_init --reset
.venv\Scripts\python -m app.seed --demo
.venv\Scripts\uvicorn app.main:app --reload --port 3001
cd apps/frontend && npm run dev    # → http://localhost:3000
```

Credenciales demo: `admin@clubes.local / admin123`.
