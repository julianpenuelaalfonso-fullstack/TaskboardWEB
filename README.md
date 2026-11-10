# TaskBoard

Gestor de tareas sencillo: crear, listar, marcar como completadas y eliminar tareas.
Frontend y backend separados, comunicados por una API REST y desplegados en Render.

## Producción

| Servicio | URL |
|---|---|
| Frontend (Static Site) | https://taskboard-web.onrender.com ← reemplazar por la real |
| Backend health check | https://taskboard-api.onrender.com/api/health ← reemplazar por la real |

> El plan gratuito suspende la API tras un rato sin uso; la primera petición puede tardar cerca de un minuto.

## Arquitectura

```
Navegador ──► Static Site (React + Vite) ──fetch──► Web Service (Express) ──SQL──► Render Postgres
```

| Componente | Tecnología | Servicio en Render | Carpeta |
|---|---|---|---|
| Frontend | React + Vite | Static Site | `frontend/` |
| Backend | Node.js + Express | Web Service | `backend/` |
| Base de datos | PostgreSQL | Render Postgres | `backend/schema.sql` |

La API crea la tabla `tasks` al arrancar (`CREATE TABLE IF NOT EXISTS`), así que no hace falta ejecutar el script a mano. El mismo script está en `backend/schema.sql` por si se quiere correr desde psql, DBeaver o pgAdmin.

## API

| Método | Ruta | Cuerpo | Respuestas |
|---|---|---|---|
| GET | `/api/health` | — | 200 `{"status":"ok"}` |
| GET | `/api/tasks` | — | 200 lista de tareas |
| POST | `/api/tasks` | `{"title":"..."}` | 201 tarea creada · 400 título vacío o > 200 caracteres |
| PATCH | `/api/tasks/:id` | `{"done":true}` | 200 tarea actualizada · 400 datos inválidos · 404 no existe |
| DELETE | `/api/tasks/:id` | — | 204 eliminada · 400 id inválido · 404 no existe |

Errores inesperados (por ejemplo, la base de datos caída) responden 500 `{"error":"..."}`.

## Ejecución local

Requisitos: Node.js LTS (20 o superior), Git y una base de datos Postgres en Render.

**Backend**

```bash
cd backend
cp .env.example .env    # completar DATABASE_URL con la External Database URL
npm install
npm start               # http://localhost:3000
```

**Frontend** (en otra terminal)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev             # http://localhost:5173
```

**Pruebas rápidas con curl**

```bash
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/tasks -H "Content-Type: application/json" -d "{\"title\":\"Primera tarea\"}"
curl http://localhost:3000/api/tasks
curl -X PATCH http://localhost:3000/api/tasks/1 -H "Content-Type: application/json" -d "{\"done\":true}"
curl -X DELETE http://localhost:3000/api/tasks/1
```

## Variables de entorno

| Variable | Dónde | Local | Producción |
|---|---|---|---|
| `DATABASE_URL` | backend | External Database URL | Internal Database URL |
| `DB_SSL` | backend | `true` | `false` |
| `FRONTEND_URL` | backend | `http://localhost:5173` | URL del Static Site, con `https` y sin barra final |
| `PORT` | backend | `3000` | la asigna Render, no definirla |
| `VITE_API_URL` | frontend | `http://localhost:3000` | URL pública del backend, sin barra final |

Los archivos `.env` no se suben al repositorio (ver `.gitignore`); usar los `.env.example` como plantilla.
`VITE_API_URL` se incrusta al compilar: si cambia, hay que hacer **Manual Deploy → Deploy latest commit** del Static Site.

## Despliegue en Render

**Opción A, manual**

1. **New → Postgres**: `taskboard-db`, plan Free. Copiar la Internal y la External Database URL.
2. **New → Web Service** con este repositorio: Root Directory `backend`, Build `npm install`, Start `npm start`, Health Check Path `/api/health`, plan Free. Variables: `DATABASE_URL` (interna), `DB_SSL=false`, `FRONTEND_URL` (paso 4).
3. **New → Static Site**: Root Directory `frontend`, Build `npm install && npm run build`, Publish Directory `dist`. Variable: `VITE_API_URL` = URL del backend.
4. Copiar la URL del Static Site y ponerla en `FRONTEND_URL` del backend.

**Opción B, Blueprint**: **New → Blueprint**, elegir el repositorio; Render lee `render.yaml`, crea los tres servicios y pide `FRONTEND_URL` y `VITE_API_URL`.

Cada `git push` a `main` vuelve a desplegar ambos servicios automáticamente.

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| Error de CORS en la consola | `FRONTEND_URL` debe coincidir exacto con la URL del Static Site (https, sin barra final). |
| El frontend llama a `localhost` | Definir `VITE_API_URL` en el Static Site y volver a desplegar. |
| Error de conexión a la BD | En producción usar la Internal Database URL con `DB_SSL=false`. |
| La primera carga tarda ~1 minuto | Normal en el plan gratuito; la interfaz muestra un mensaje y un botón para reintentar. |
