# TaskBoard empresarial · INNOVA SOLUCIONES S.A.S.

Plataforma web para planificar, asignar y hacer seguimiento de las tareas y proyectos de los departamentos de una empresa ficticia (proyecto académico).
El frontend y el backend están separados, se comunican por una API REST y se despliegan en Render.

**Integrantes:** _(completar)_

## Enlaces en producción

- Frontend (Static Site): _(pegar URL)_
- Backend (Web Service): _(pegar URL)_ · health check: `/api/health`

## Alcance implementado (Must Have, fases 1 a 4)

| Módulo | Requerimientos | Estado |
|---|---|---|
| 1. Inicio de sesión y usuarios | RF-001 a RF-009 | Completo |
| 2. Roles y permisos | RF-010 a RF-015 | Completo, validado en el servidor |
| 3. Departamentos | RF-016 a RF-020 | Completo |
| 4. Proyectos | RF-021 a RF-029 | Completo |
| 5. Tareas | RF-030 a RF-044 | Completo excepto RF-037 (adjuntos, Should Have) |
| 6. Tablero Kanban | RF-045 a RF-054 | Completo |
| 7. Estados y seguimiento | RF-055 a RF-060 | Completo |
| Reglas de negocio | RN-001 a RN-012 | Completas |
| Módulos 8 a 12 (calendario, comentarios, notificaciones, dashboard, configuración) | RF-061 a RF-097 | Fases siguientes |

Notas:
- **RF-006 (recuperar contraseña):** el enlace se genera con un token de un solo uso que vence en 1 hora. Como no hay servicio de correo, el enlace se escribe en los logs del servidor; en desarrollo también aparece en pantalla.
- **RNF-001:** las contraseñas se guardan con bcrypt. **RNF-002:** todos los permisos se validan en la API.

## Roles y permisos

| Acción | Admin | Gerente | Líder | Colaborador | Invitado |
|---|:-:|:-:|:-:|:-:|:-:|
| Gestionar usuarios, roles y cuentas | ✔ | | | | |
| Crear y editar departamentos | ✔ | | | | |
| Ver todos los proyectos y tareas | ✔ | ✔ | | | |
| Crear proyectos | ✔ | | ✔ (los lidera) | | |
| Editar o archivar un proyecto | ✔ | | Sus proyectos | | |
| Crear, editar, duplicar y archivar tareas | ✔ | | Sus proyectos | | |
| Cambiar estado, subtareas y tiempo real | ✔ | | Sus proyectos | Sus tareas | |
| Aprobar o rechazar tareas en revisión | ✔ | | Sus proyectos | | |
| Eliminar tareas | ✔ | | | | |
| Ver proyectos donde participa | ✔ | ✔ | ✔ | ✔ | ✔ (solo lectura) |

Si el proyecto exige aprobación (RN-007), el colaborador no puede pasar una tarea a «Finalizada»: la envía a «En revisión» y el líder la aprueba o la rechaza con observaciones.

## Arquitectura

| Componente | Tecnología | Servicio en Render |
|---|---|---|
| Frontend | React + Vite | Static Site |
| Backend | Node.js + Express, JWT, bcrypt | Web Service |
| Base de datos | PostgreSQL | Render Postgres |

```
taskboard/
├── backend/
│   ├── index.js            → servidor y rutas
│   ├── db.js               → conexión a PostgreSQL
│   ├── schema.sql          → tablas y catálogos
│   ├── init-db.js          → crea tablas y datos de ejemplo
│   ├── middleware/auth.js  → sesión (JWT) y roles
│   ├── lib/permissions.js  → matriz de permisos
│   └── routes/             → auth, users, departments, projects, tasks
└── frontend/src/
    ├── pages/              → Login, Board (Kanban), Projects, Departments, Users, Profile
    ├── components/         → TaskDrawer, TaskForm, componentes de interfaz
    └── lib/                → api, auth, toast, formato
```

### Modelo de datos

`roles`, `users`, `departments`, `password_resets`, `statuses`, `priorities`, `projects`, `project_members`, `tasks`, `task_assignees`, `subtasks`, `task_history`. Las relaciones muchos a muchos (participantes de proyecto y responsables de tarea) usan tablas intermedias.

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión |
| GET / PUT | `/api/auth/me` | Ver / actualizar perfil |
| PUT | `/api/auth/me/password` | Cambiar contraseña |
| POST | `/api/auth/forgot` · `/api/auth/reset` | Recuperar contraseña |
| GET / POST / PUT | `/api/users` · `/api/users/:id` | Empleados |
| PATCH | `/api/users/:id/active` | Activar o desactivar cuenta |
| GET / POST / PUT | `/api/departments` · `/:id` · `/:id/members` | Departamentos |
| GET / POST / PUT | `/api/projects` · `/:id` | Proyectos |
| PATCH | `/api/projects/:id/archive` | Archivar proyecto |
| GET / POST / PUT | `/api/tasks` · `/:id` | Tareas (filtros: `project_id`, `assignee_id`, `priority_id`, `status_id`, `q`, `overdue`) |
| PATCH | `/api/tasks/:id/status` | Cambiar estado (Kanban) |
| POST | `/api/tasks/:id/review` | Aprobar o rechazar |
| POST | `/api/tasks/:id/duplicate` | Duplicar |
| PATCH | `/api/tasks/:id/time` · `/:id/archive` | Tiempo real · archivar |
| DELETE | `/api/tasks/:id` | Eliminar (solo admin) |
| POST / PATCH / DELETE | `/api/tasks/:id/subtasks[/:subId]` | Subtareas |
| GET | `/api/meta` | Estados, prioridades y roles |

## Ejecución local

1. **Backend**
   ```bash
   cd backend
   copy .env.example .env     # completar DATABASE_URL (External URL) y JWT_SECRET
   npm install
   npm run db:init            # crea tablas y datos de ejemplo
   npm start                  # http://localhost:3000/api/health
   ```
2. **Frontend** (otra terminal)
   ```bash
   cd frontend
   copy .env.example .env     # VITE_API_URL=http://localhost:3000
   npm install
   npm run dev                # http://localhost:5173
   ```

### Cuentas de demostración

Contraseña para todas: `Innova2026*`

| Rol | Correo |
|---|---|
| Administrador | admin@innova.com |
| Gerente | gerente@innova.com |
| Líder de equipo | lider@innova.com |
| Colaborador | colaborador@innova.com · valentina@innova.com |
| Invitado | invitado@innova.com |

## Despliegue en Render

**Backend (Web Service):** Root Directory `backend`, Build `npm install`, Start `npm start`, Health Check `/api/health`.
Variables: `DATABASE_URL` (Internal Database URL), `DB_SSL=false`, `FRONTEND_URL` (URL del Static Site, sin barra final), `JWT_SECRET` (texto largo y aleatorio), `NODE_ENV=production`.

**Frontend (Static Site):** Root Directory `frontend`, Build `npm install && npm run build`, Publish `dist`.
Variable: `VITE_API_URL` (URL del backend, sin barra final). Si cambia, hay que volver a desplegar.

**Base de datos:** ejecutar `npm run db:init` una vez desde el equipo local con la External Database URL.
