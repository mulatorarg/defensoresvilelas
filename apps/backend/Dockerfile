# Imagen de la app completa: API FastAPI + frontend estático de Next.js
# Build context: raíz del monorepo (ver docker-compose.yml)

# --- Etapa 1: build del frontend (export estático) ---
FROM node:22-alpine AS frontend
WORKDIR /build
COPY apps/frontend ./
RUN npm ci
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# --- Etapa 2: runtime Python ---
FROM python:3.13-slim
WORKDIR /app

COPY apps/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/backend/app ./app
COPY --from=frontend /build/dist ./frontend-dist

ENV FRONTEND_DIST_PATH=/app/frontend-dist
EXPOSE 3001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]
