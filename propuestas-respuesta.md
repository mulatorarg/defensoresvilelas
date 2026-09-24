Apliqué todo lo que quedaba de propuestas.md, salvo tres puntos que no corresponde tocar ahora (abajo). No commiteé nada: siguen sin commitear también las secciones 3 y 4 de la vez anterior.

Cómo lo probé:
- Backend: los 67 tests pasan con Python 3.13 y con 3.14, y el esquema coincide con las migraciones (hasta la 0004).
- Frontend: tsc y build OK. El lint da 0 errores y 0 advertencias (antes eran 5).
- Navegador: en Chrome sin interfaz pasaron los 27 chequeos, entre ellos 16 pantallas sin errores de JavaScript, red ni CSP.
- Accesibilidad: Tab y Escape en los modales, errores de validación junto a cada campo y vista de celular sin scroll horizontal.
- PWA y captcha: el manifiesto y el service worker del portal funcionan, y probé el alta con el captcha real usando las claves de prueba de Cloudflare.
- Limpieza: las bases de prueba ya están borradas.

Sección 5 (UI/UX)
- Datos: todas las pantallas cargan con TanStack Query. Después de guardar se refresca solo lo afectado (un pago actualiza cuotas, morosidad, caja, dashboard y reportes). Quedó prohibido por lint volver a cargar datos con fetch dentro de useEffect.
- Pantallas consistentes: mismo kit en todas, con esqueletos de carga, error con "Reintentar" y paginador. No queda ningún alert() ni "Cargando...".
- Íconos: todo con lucide-react; no quedan emojis de interfaz.
- Formularios: react-hook-form + zod en todos, con el error junto a cada campo. El pago no deja cobrar más que el saldo. El socio ya no recibe un perfil deportivo vacío. Solo se ofrecen tipos y categorías activos.
- Accesibilidad:
  - Los modales retienen el foco y lo devuelven al cerrar.
  - Las etiquetas son visibles, incluidos el portal y el alta.
  - En celular, socios, cuotas y reportes se ven como tarjetas.
- PWA del portal: se puede instalar y abre el carnet aunque haya mala señal. La API nunca se guarda en caché.

Sección 6 e infraestructura
- Contenedor: la imagen pasa a python:3.14-slim y corre sin root. El deploy ajusta solo n necesidad de sudo en el VPS.
- Dependabot: agregado. Como el CI corre solo desde el deploy, antes de mergear sus PRs hay que probar localmente.
- Nginx: manda el X-Request-ID, así el mismo id aparece en sus logs y en los de la app.

Pendientes sueltos de las secciones anteriores, ya resueltos
- CSP: ya no permite scripts inline arbitrarios; cada página lleva los hashes de sus pro
- Captcha opcional (Turnstile) en el alta online: se activa cargando dos claves en el .env; sin ellas, todo sigue igual.
- Pantallas nuevas: auditoría, y en el portal los pagos del socio con su recibo.
- Fotos propias: portada de la web en Configuración y una foto por disciplina en Disciplinas.

Lo que no apliqué:
- Secretos (1.1): pospuesto hasta el dominio definitivo, como acordamos.
- TypeScript 7 (5.4): sigue bloqueado porque typescript-eslint todavía no lo soporta; Dependabot lo tiene ignorado.
- Deploy por tag SHA: lo descarté, porque usás :latest a propósito. El tag SHA se sigue publicando para poder hacer rollback.

Lo que queda en manos del club está en la nueva sección 7 de propuestas.md:
- Cargar las fotos propias.
- Probar Mercado Pago con credenciales de prueba.
- Copiar nginx.conf al VPS.
- Programar el cron de backups y configurar rclone.