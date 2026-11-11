# TaskBoard

Gestor de tareas con cuentas, espacios de trabajo (workspaces) y tableros. Frontend React y API Express en un solo origen, desplegados en Render.

> La entrega del taller (v1, tareas sueltas sin cuentas) está en la etiqueta `v1-taller`.

## Arquitectura

```
Navegador
   │  un solo origen: https://<static-site>.onrender.com
   ▼
Static Site (React + Vite + TS) ── rewrite /api/* ──► Web Service (Express + TS)
                                                         │  Better Auth (sesiones, Google, recuperación)
                                                         │  Drizzle ORM + migraciones
                                                         ├──► Render Postgres
                                                         └──► Resend (correo)
```

| Componente | Tecnología | Carpeta |
|---|---|---|
| Frontend | React, Vite, TypeScript | `frontend/` |
| Backend | Express 5, Better Auth, Drizzle, TypeScript | `backend/` |
| Base de datos | PostgreSQL (migraciones en `backend/drizzle/`) | |

- La sesión va en una cookie `httpOnly` de primera parte (el navegador solo ve el Static Site), por eso no hay CORS.
- En local, Vite hace proxy de `/api` a la API, igual que el rewrite en producción.
- Al crear un usuario se crea su workspace personal (hook de Better Auth); `GET /api/workspaces` lo repite si faltara (idempotente).

## Ejecución local

Requisitos: Node.js 20+, Git y Docker.

```bash
# Postgres local (una sola vez)
docker run -d --name taskboard-db -p 127.0.0.1:15432:5432 \
  -e POSTGRES_USER=taskboard -e POSTGRES_PASSWORD=taskboard_local -e POSTGRES_DB=taskboard_v2 postgres:16
docker exec taskboard-db createdb -U taskboard taskboard_test   # base de las pruebas
```

**Backend**

```bash
cd backend
cp .env.example .env     # ya apunta a taskboard_v2; sin RESEND_API_KEY los correos salen por consola
npm install
npm run migrate
npm run dev              # http://localhost:3002
```

**Frontend** (otra terminal)

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173 (proxy /api -> API_PROXY_TARGET, por defecto http://localhost:3002)
```

**Pruebas**: `npm test` en `backend/` y en `frontend/`. E2E: `npx playwright test` en `frontend/` (usa los puertos 3012 y 5183).

## Variables de entorno

Solo la API las usa; el Static Site no necesita ninguna.

| Variable | Local | Producción |
|---|---|---|
| `DATABASE_URL` | `postgresql://taskboard:taskboard_local@127.0.0.1:15432/taskboard_v2` | Internal Database URL |
| `TEST_DATABASE_URL` | base `taskboard_test` | no se define |
| `DB_SSL` | `false` | `false` |
| `BETTER_AUTH_SECRET` | 32+ caracteres | 32+ caracteres (el Blueprint lo genera) |
| `APP_URL` | `http://localhost:5173` | URL del Static Site, https y sin barra final |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | opcionales | del cliente OAuth de Google; sin ellos el botón de Google no funciona |
| `RESEND_API_KEY` | opcional (sin ella, correos por consola) | **obligatoria**: la API no arranca sin ella |
| `EMAIL_FROM` | opcional | remitente, p. ej. `TaskBoard <no-reply@tu-dominio>` |
| `TRUST_PROXY_HOPS` | `0` | número de proxies delante de la API (ver abajo) |
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3002` | la asigna Render, no definirla |

Los `.env` no se suben al repositorio; usar `backend/.env.example` como plantilla.

## Cuentas externas

**Google (inicio de sesión)**
1. En [Google Cloud Console](https://console.cloud.google.com/) crear un proyecto y configurar la pantalla de consentimiento OAuth.
2. **Credenciales -> Crear credenciales -> ID de cliente de OAuth**, tipo "Aplicación web".
3. URIs de redirección autorizados: `${APP_URL}/api/auth/callback/google` (por ejemplo `https://taskboard-web.onrender.com/api/auth/callback/google`; en local, `http://localhost:5173/api/auth/callback/google`).
4. Copiar el ID y el secreto a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.

**Resend (correo de recuperación)**
1. Crear cuenta en [resend.com](https://resend.com) y una API key: es `RESEND_API_KEY`.
2. El plan gratuito solo envía al correo del dueño de la cuenta hasta que se verifique un dominio; para probar, registrarse con ese correo.

## Despliegue en Render

**Opción A, Blueprint**: **New -> Blueprint**, elegir el repositorio. Render lee `render.yaml`, crea base, API y Static Site, y pide los valores `sync: false`: `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `TRUST_PROXY_HOPS`. `APP_URL` es la URL del Static Site, que aún no existe: poner un valor provisional y corregirlo después.

**Opción B, manual**
1. **New -> Postgres** `taskboard-db`, plan Free; copiar la Internal Database URL.
2. **New -> Web Service**: Root Directory `backend`, Build `npm ci && npm run build`, Start `npm run start:prod`, Health Check Path `/api/health`, plan Free. Variables: todas las de la tabla (columna Producción), con `NODE_ENV=production` y `DB_SSL=false`.
3. **New -> Static Site**: Root Directory `frontend`, Build `npm ci && npm run build`, Publish Directory `dist`. En **Redirects/Rewrites**, en este orden: `/api/*` -> `https://<api>.onrender.com/api/*` (Rewrite) y `/*` -> `/index.html` (Rewrite).
4. Poner la URL del Static Site en `APP_URL` de la API y en la URI de redirección de Google.

Notas:
- `start:prod` ejecuta `npm run migrate` y luego arranca (el plan gratuito no tiene pre-deploy command).
- El subdominio de la API puede no ser `taskboard-api` (si el nombre está tomado, Render añade un sufijo): hay que actualizar el destino del rewrite en `render.yaml` con la URL real.
- El rewrite añade latencia. Que las cookies de sesión funcionen a través de él es lo primero que hay que verificar tras desplegar: iniciar sesión, recargar y comprobar que la sesión persiste.
- `TRUST_PROXY_HOPS` alimenta `req.ip`, el rate limit de Express y el de Better Auth. Empezar con `1`; si los logs muestran todas las peticiones con la misma IP, o el límite afecta a todos los usuarios a la vez, ajustar el valor.
- Verificación: `https://<static>/api/health` debe responder `{"status":"ok"}`.
- El plan gratuito suspende la API tras un rato sin uso; la primera petición puede tardar cerca de un minuto.

## Comportamiento conocido

El correo no se verifica. Si alguien se registró con correo y contraseña y luego pulsa "Continuar con Google" con el mismo correo, Google no vincula la cuenta (requiere correo local verificado) y la interfaz le indica que inicie sesión con su contraseña.
