# TaskBoard empresarial

Plataforma web para planificar, asignar y hacer seguimiento de las tareas y proyectos de los departamentos de una empresa.
Nació como proyecto académico con el caso de estudio INNOVA SOLUCIONES S.A.S. y hoy es el **prototipo (beta) del TaskBoard de Industrias Caslop**.
El frontend y el backend están separados, se comunican por una API REST y se despliegan en Render.

**Integrantes:** Diego Alejandro López Castellanos ([@diego311204](https://github.com/diego311204)) · Julián Andrés Peñuela Alfonso ([@julianpenuelaalfonso-fullstack](https://github.com/julianpenuelaalfonso-fullstack)) · Alejandro García ([@AlejoCtr](https://github.com/AlejoCtr))

**Documentación:** [`docs/TaskBoard_Documentacion_v1.1.pdf`](docs/TaskBoard_Documentacion_v1.1.pdf) reúne los entregables 1 a 9: visión y alcance, SRS, historias de usuario, UML, modelo entidad-relación, prototipos, matriz de permisos, plan de pruebas y manuales, actualizados con el calendario, el dashboard, los correos y las invitaciones. El levantamiento de requerimientos original está en `Levantamiento_Requerimientos.docx`.

## Enlaces en producción

- Aplicación: **https://taskboard.rosariumpos.com** (dominio propio; también responde en https://taskboard-web-rr8f.onrender.com)
- API: https://taskboard-api-ihvm.onrender.com · health check: `/api/health`

En el plan gratuito de Render la API se suspende tras un rato sin uso: la primera carga puede tardar cerca de un minuto.

## Estado por fases

El levantamiento define 97 requerimientos (RF-001 a RF-097) priorizados con MoSCoW y repartidos en siete fases.

| Fase | Alcance | Estado |
|---|---|---|
| 1 | Inicio de sesión, usuarios y roles (RF-001 a RF-015) | ✅ Completa, más alta de usuarios por invitación |
| 2 | Departamentos y proyectos (RF-016 a RF-029) | ✅ Completa |
| 3 | Creación, asignación y administración de tareas (RF-030 a RF-044) | ✅ Completa, excepto RF-037 (adjuntos) |
| 4 | Tablero Kanban, estados y seguimiento (RF-045 a RF-060) | ✅ Completa |
| 5 | Calendario, notificaciones, comentarios y adjuntos (RF-061 a RF-079) | 🟡 Parcial: calendario completo y aviso por correo de tarea asignada (RF-073); faltan comentarios (RF-067 a RF-072), adjuntos y el resto de avisos (RF-074 a RF-079) |
| 6 | Dashboard e informes (RF-080 a RF-090) | ✅ Completa, con exportación a Excel y PDF |
| 7 | Pruebas, seguridad, configuración y puesta en marcha (RF-091 a RF-097) | 🟡 Parcial: despliegue, dominio propio, correo y pruebas hechos; faltan parámetros de configuración y auditoría |

Reglas de negocio RN-001 a RN-012: todas aplicadas en el servidor.

**Pendiente para las siguientes iteraciones:** comentarios y menciones en tareas, archivos adjuntos, avisos por vencimiento, modificación y aprobación, notificaciones dentro de la aplicación, módulo de configuración (prioridades, estados, horarios) y bitácora de auditoría. Fuera del alcance: IA avanzada, integraciones complejas y app móvil nativa (la web es responsiva).

### Qué incluye cada módulo terminado

- **Calendario (RF-061 a RF-066):** vistas de mes, semana y día con las tareas por fecha de vencimiento, filtros por proyecto y responsable, y reprogramación arrastrando la tarea a otro día.
- **Dashboard (RF-080 a RF-090):** indicadores generales (cumplimiento, vencidas), tareas por estado, avance por proyecto y resultados por departamento y por colaborador, con filtros de fecha, proyecto y departamento. Se exporta a Excel (`.xlsx`) o se imprime/guarda como PDF.
- **Correos (RF-073, RF-006):** aviso de tarea asignada, recuperación de contraseña e invitaciones, enviados con Zoho Mail desde el dominio de la empresa.

Notas:
- **RF-006 (recuperar contraseña):** el enlace se genera con un token de un solo uso que vence en 1 hora y llega por correo (ver *Correos*).
- **Alta de usuarios por invitación:** no hay registro público; solo el administrador crea cuentas. Por defecto la persona recibe un correo con un enlace (un solo uso, 72 horas) para crear su propia contraseña, y la tabla de usuarios la muestra como *Invitación pendiente* con opción de reenviar. Si el correo no sale, el administrador ve el enlace para copiarlo. También puede asignar una contraseña inicial a mano.
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
│   ├── lib/migrate.js      → aplica schema.sql al arrancar
│   ├── lib/mailer.js       → envío de correos con la API de Zoho Mail
│   ├── lib/emails.js       → plantillas de los correos
│   ├── lib/invitations.js  → enlaces de invitación y recuperación
│   └── routes/             → auth, users, departments, projects, tasks, dashboard
└── frontend/src/
    ├── pages/              → Login, Board (Kanban), Calendar, Dashboard, Projects, Departments, Users, Profile
    ├── components/         → TaskDrawer, TaskForm, componentes de interfaz
    └── lib/                → api, auth, toast, formato
```

### Modelo de datos

`roles`, `users`, `departments`, `password_resets` (invitaciones y recuperación), `statuses`, `priorities`, `projects`, `project_members`, `tasks`, `task_assignees`, `subtasks`, `task_history`. Las relaciones muchos a muchos (participantes de proyecto y responsables de tarea) usan tablas intermedias.

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión |
| GET / PUT | `/api/auth/me` | Ver / actualizar perfil |
| PUT | `/api/auth/me/password` | Cambiar contraseña |
| POST | `/api/auth/forgot` · `/api/auth/reset` | Recuperar contraseña / activar cuenta invitada |
| GET | `/api/auth/link/:token` | Valida un enlace de invitación o recuperación |
| POST | `/api/users/:id/invite` | Reenviar invitación (administrador) |
| GET / POST / PUT | `/api/users` · `/api/users/:id` | Empleados |
| PATCH | `/api/users/:id/active` | Activar o desactivar cuenta |
| GET / POST / PUT | `/api/departments` · `/:id` · `/:id/members` | Departamentos |
| GET / POST / PUT | `/api/projects` · `/:id` | Proyectos |
| PATCH | `/api/projects/:id/archive` | Archivar proyecto |
| GET / POST / PUT | `/api/tasks` · `/:id` | Tareas (filtros: `project_id`, `assignee_id`, `priority_id`, `status_id`, `q`, `overdue`, `from`, `to`) |
| PATCH | `/api/tasks/:id/reschedule` | Reprogramar desde el calendario |
| PATCH | `/api/tasks/:id/status` | Cambiar estado (Kanban) |
| POST | `/api/tasks/:id/review` | Aprobar o rechazar |
| POST | `/api/tasks/:id/duplicate` | Duplicar |
| PATCH | `/api/tasks/:id/time` · `/:id/archive` | Tiempo real · archivar |
| DELETE | `/api/tasks/:id` | Eliminar (solo admin) |
| POST / PATCH / DELETE | `/api/tasks/:id/subtasks[/:subId]` | Subtareas |
| GET | `/api/dashboard` · `/api/dashboard/export.xlsx` | Indicadores · exportación a Excel |
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

## Correos (Zoho Mail)

El sistema envía correos desde la cuenta de Zoho de la empresa usando la **API HTTPS de Zoho Mail**, porque el plan gratuito de Render bloquea el SMTP.

- **Tarea asignada (RF-073):** al crear una tarea, cada responsable recibe un correo con el título, el proyecto, la descripción, la prioridad, las fechas, quién la asignó y un botón que abre la tarea (`#/tablero?tarea=ID`). Al editar una tarea, solo se avisa a los responsables nuevos. Quien crea la tarea no recibe aviso.
- **Recuperación de contraseña (RF-006):** el enlace llega por correo.
- **Invitación de usuarios nuevos:** enlace para crear la contraseña.
- Los envíos se hacen en segundo plano: si Zoho falla, la operación se completa igual y el error queda en los logs. Si las variables no están configuradas, el correo solo se escribe en los logs.

**Configuración (una sola vez):**
1. En `api-console.zoho.com` crea un **Self Client** y copia el Client ID y el Client Secret.
2. En **Generate Code** usa el scope `ZohoMail.accounts.READ,ZohoMail.messages.CREATE` y ejecuta `node backend/scripts/zoho-get-refresh-token.js` (instrucciones dentro del archivo) para obtener el refresh token.
3. En Render (Web Service → Environment) define `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_DC` (`com`, `eu`, `in`…) y `MAIL_FROM` (el correo de la cuenta que autorizó la app). Nunca subas estos valores a GitHub.

## Despliegue en Render

El servidor actualiza el esquema de la base de datos al arrancar (`schema.sql` es idempotente), así que después de un despliegue no hace falta correr `db:init` a mano.


**Backend (Web Service):** Root Directory `backend`, Build `npm install`, Start `npm start`, Health Check `/api/health`.
Variables: `DATABASE_URL` (Internal Database URL), `DB_SSL=false`, `FRONTEND_URL` (dominio propio y URL del Static Site, separados por coma, sin barra final), `JWT_SECRET` (texto largo y aleatorio), `NODE_ENV=production` y, para los correos, las variables `ZOHO_*` y `MAIL_FROM` (sección anterior).

**Frontend (Static Site):** Root Directory `frontend`, Build `npm install && npm run build`, Publish `dist`.
Variable: `VITE_API_URL` (URL del backend, sin barra final). Si cambia, hay que volver a desplegar.

**Base de datos:** para cargar los datos de demostración en una base nueva, ejecutar `npm run db:init` una sola vez desde el equipo local con la External Database URL. Los cambios de esquema posteriores se aplican solos al desplegar. La base gratuita de Render vence el 10 de diciembre de 2026; para uso real se necesita un plan pago.

**Dominio propio:** en Render (Static Site → Settings → Custom Domains) se agregó `taskboard.rosariumpos.com`, y en Cloudflare un registro CNAME `taskboard` que apunta a la URL `.onrender.com` del Static Site. En el backend, `FRONTEND_URL` admite varios orígenes separados por coma; el primero se usa para los enlaces de los correos, así que debe ser el dominio propio.

**Despliegue:** el auto-deploy está desactivado. Después de cada push a `main`, en Render usar **Manual Deploy → Deploy latest commit** en `taskboard-api` y en `taskboard-web`.
