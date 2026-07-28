# Roadmap y tareas pendientes

## Estado actual del MVP

- ✅ Monorepo con NestJS + Next.js + Docker single-image
- ✅ Schema Prisma multi-tenant
- ✅ Auth JWT + login
- ✅ Módulo de socios (CRUD + perfil deportivo)
- ✅ Módulo de disciplinas y categorías
- ✅ Inscripciones de socios a categorías
- ✅ Tipos de cuota
- ✅ Generación de cuotas
- ✅ Pagos presenciales
- ✅ Integración con Mercado Pago (preferencias + webhook)
- ✅ Reportes básicos (dashboard, socios, cuotas, ingresos/egresos)
- ✅ Documentación de setup de base de datos

## Tareas pendientes

### Corto plazo

- [x] Resolver permisos de shadow database para `prisma migrate dev`
- [x] Crear endpoint y frontend para control de asistencia
  - Backend: `AttendanceModule` con CRUD
  - Frontend: pantalla de asistencia por categoría y fecha
- [x] Agregar ABM de egresos/ingresos manuales (transacciones de caja)
- [x] Cierre de caja diario

### Mediano plazo

- [x] Endurecimiento de seguridad y autorización
  - Validación de pertenencia al tenant en cada request
  - Control de roles (`ADMIN`, `OPERATOR`, `TEACHER`, `STAFF`)
  - `JWT_SECRET` obligatorio y validado al arrancar
  - Login con validación de `class-validator`
- [x] Mercado Pago robusto
  - `notification_url` apunta al backend (`API_PUBLIC_URL`)
  - Validación de firma del webhook (`MERCADO_PAGO_WEBHOOK_SECRET`)
  - Manejo de estados `pending`, `approved`, `rejected`
- [x] Backend para app móvil del socio (`member-portal`)
  - Login por DNI + fecha de nacimiento
  - Ver cuotas pendientes
  - Pagar con Mercado Pago
  - Credencial digital con QR
- [x] Backend para app móvil interna del personal (`staff-portal`)
  - Escanear QR de socio
  - Ver datos del socio
  - Registrar asistencia
- [x] Mejoras en frontend web
  - Protección de rutas `/admin/*`
  - Selector de club en login
  - Navegación con `Link` de Next.js
- [ ] App móvil del socio (React Native + Expo) — frontend nativo pendiente
- [ ] App móvil interna para personal del club (React Native + Expo) — frontend nativo pendiente

### Largo plazo / Escalabilidad

- [ ] Facturación electrónica (AFIP Argentina)
- [ ] Notificaciones push y WhatsApp
- [ ] White-label por club (dominio, colores, logo)
- [ ] Planes y precios SaaS
- [ ] API pública / webhooks para integraciones

## Notas

- Mercado Pago requiere `MERCADO_PAGO_ACCESS_TOKEN` en `.env` y una URL pública para webhooks.
- Docker Compose de producción usa una sola imagen para backend + frontend.
