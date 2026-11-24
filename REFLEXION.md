# Reflexión del proyecto

**TaskBoard empresarial** · Diego Alejandro López Castellanos · Julián Andrés Peñuela Alfonso · David Alejandro García Lozano

## Dificultades encontradas y cómo se resolvieron

**1. La API se suspende en el plan gratuito de Render.** Tras unos minutos sin uso, el Web Service se apaga y la primera petición tarda cerca de un minuto. Al principio parecía que la aplicación estaba caída. Se agregó la ruta `/api/health`, configurada como Health Check en Render. Además, el frontend muestra un mensaje que explica que el servidor puede estar despertando y pide reintentar.

**2. CORS entre dos dominios distintos.** El frontend (Static Site) y el backend (Web Service) quedan en URL diferentes, así que el navegador bloqueaba las peticiones. Al agregar el dominio propio `taskboard.rosariumpos.com` el problema volvió. Se resolvió con la variable `FRONTEND_URL`, que acepta varios orígenes separados por coma y sin barra final.

**3. Render bloquea el SMTP en el plan gratuito.** Los correos de tarea asignada, recuperación de contraseña e invitación no salían por SMTP. Se cambió a la API HTTPS de Zoho Mail, que sale por el puerto 443. Se autentica con un *refresh token* OAuth y renueva el token de acceso cada hora. Los envíos se hacen en segundo plano: si Zoho falla, la operación se completa igual y el error queda en los logs.

**4. Cambiar el modelo de datos con la base ya desplegada.** El proyecto empezó como una lista simple de tareas y pasó al modelo empresarial: usuarios, roles, departamentos, proyectos, responsables, subtareas e historial. Cada cambio de esquema exigía ejecutar scripts a mano contra la base de Render. Se volvió idempotente `schema.sql` (`IF NOT EXISTS`, `ON CONFLICT`) y el servidor lo aplica al arrancar, así que cada despliegue actualiza la base solo.

**5. Alcance grande para el tiempo disponible.** El levantamiento de Innova Soluciones tiene 97 requerimientos funcionales en 12 módulos. Se priorizó con MoSCoW y se trabajó por fases. Primero se hizo lo Must Have: login, roles, departamentos, proyectos, tareas, Kanban y aprobación. Después se sumaron calendario, dashboard, correos e invitaciones.

**6. Manejo de secretos en un repositorio público.** Credenciales de la base, JWT y Zoho. Los `.env` quedaron en `.gitignore` y solo se suben archivos `.env.example` sin valores reales. Los secretos viven únicamente en el panel de Render.

## Mejoras para un entorno productivo real

- **Plan pago en Render:** evita que la API se suspenda. La base gratuita vence el 10 de diciembre de 2026, y se necesitan respaldos automáticos.
- **Migraciones versionadas** (por ejemplo, `node-pg-migrate`) en lugar de reaplicar el esquema completo, para poder revertir cambios.
- **Integración continua:** pruebas automáticas de la API y de permisos por rol en cada push, y despliegue solo si pasan, con un ambiente de *staging* antes de producción.
- **Seguridad:** cabeceras con `helmet`, límite de intentos en el login y sesión en cookie `httpOnly` en lugar de `localStorage`.
- **Correos confiables:** cola con reintentos, plantillas versionadas y registro de entregas.
- **Monitoreo:** logs centralizados y alertas de caídas y errores.
- **Almacenamiento externo** (S3 o similar) para los archivos adjuntos, que quedaron pendientes.
