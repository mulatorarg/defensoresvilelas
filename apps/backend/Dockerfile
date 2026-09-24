# Imagen de la app completa: API FastAPI + frontend estático de Next.js
# Build context: raíz del monorepo (ver docker-compose.yml)

# --- Etapa 1: build del frontend (export estático) ---
FROM node:25-alpine AS frontend
WORKDIR /build
COPY apps/frontend ./
RUN npm ci
# Vacío = URLs relativas: la web llama a la API en su misma origin (dominio del club)
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# SHA del commit (lo pasa el workflow) para mostrar la versión en la web
ARG GIT_SHA=""
ENV NEXT_PUBLIC_BUILD_SHA=$GIT_SHA
RUN npm run build

# --- Etapa 2: runtime Python ---
# 3.14: todas las dependencias tienen wheels y la suite pasa (verificado 2026-09-24)
FROM python:3.14-slim
WORKDIR /app

# Usuario sin privilegios (UID 1000, el del usuario deploy del VPS): si alguien
# encuentra una falla en la app, no es root dentro del contenedor
ARG APP_UID=1000
RUN useradd --uid ${APP_UID} --user-group --no-create-home --shell /usr/sbin/nologin app

COPY apps/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/backend/app ./app
COPY --from=frontend /build/dist ./frontend-dist
RUN mkdir -p /app/recursos && chown app:app /app/recursos

ENV FRONTEND_DIST_PATH=/app/frontend-dist
# El proceso corre en UTC (se guarda todo en UTC); la hora del club se aplica
# solo al calcular cortes y al mostrar (CLUB_TIMEZONE, ver app/clock.py)
ENV TZ=UTC
EXPOSE 3001
USER app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]
