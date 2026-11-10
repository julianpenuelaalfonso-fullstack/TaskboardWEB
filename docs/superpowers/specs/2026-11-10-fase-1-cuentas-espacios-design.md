# TaskBoard v2 · Fase 1: Cuentas y espacios de trabajo

Fecha: 2026-11-10 · Estado: aprobado en conversación, pendiente de revisión escrita

## 1. Contexto y objetivo

TaskBoard v1 es la entrega del taller: una lista de tareas (CRUD) con React + Vite, Express y PostgreSQL desplegada en Render, sin usuarios. La v2 la convierte en un producto de **portafolio y uso real**: personas con cuentas propias que organizan su trabajo personal y colaboran en equipos, según el documento `Requerimientos_Funcionales_Task_Board.docx` (110 requerimientos, 37 marcados como MVP).

La v2 se construye por fases; cada una queda desplegada y usable antes de empezar la siguiente, y tiene su propia especificación, plan e implementación. Este documento especifica **solo la Fase 1**.

### Hoja de ruta (referencia, no se especifica aquí)

| Fase | Requerimientos MVP |
|---|---|
| **1. Cuentas y espacios** (este documento) | RF-001, RF-002 (solo Google), RF-003, RF-008, RF-009, RF-072 |
| 2. Kanban | RF-014, RF-018 a RF-021, RF-023, RF-025, RF-051, RF-076 a RF-080 |
| 3. Colaboración | RF-031, RF-034 (correo con enlace), RF-035 (4 roles), RF-042, RF-062 |
| 4. Búsqueda | RF-038, RF-039 |
| 5. Tiempo real | RF-091 (pedido por el usuario aunque el documento no lo marca MVP) |

Los requerimientos UX del MVP (RF-071, RF-084 a RF-090, RF-093, RF-098, RF-099) son transversales: cada fase los cumple para lo que construye. El resto de requerimientos no MVP queda en backlog. El inicio de sesión con Microsoft (parte de RF-002) se pospone.

### Decisiones tomadas

- Se mantienen los tres servicios de Render (Static Site, Web Service, Postgres) para no romper la arquitectura del taller.
- Todo el código pasa a **TypeScript**.
- Antes de empezar se crea la etiqueta git `v1-taller` sobre el último commit de la v1, para poder recuperar siempre la entrega.
- Cada usuario tiene un workspace personal y puede crear o unirse a workspaces de equipo (la unión llega en la Fase 3).

## 2. Alcance de la Fase 1

**Incluye**

- RF-001 Registro con correo y contraseña.
- RF-002 Inicio de sesión con correo y contraseña, y con Google.
- RF-003 Recuperación de contraseña por correo y cambio de contraseña con sesión iniciada.
- RF-008 Crear, renombrar y eliminar workspaces.
- RF-009 Crear, editar (nombre y color), archivar, restaurar y eliminar tableros.
- RF-072 Barra lateral con workspaces y tableros.
- Lista de tareas simple dentro de cada tablero (la funcionalidad v1: crear, completar, eliminar).
- Requerimientos UX transversales aplicados a todo lo anterior.

**No incluye**: invitaciones y miembros, roles distintos de propietario, Kanban y campos de tarea, búsqueda, notificaciones, tiempo real, Microsoft, 2FA (RF-005), verificación obligatoria de correo (RF-004), perfil con foto (RF-006), gestión de sesiones activas (RF-007), favoritos (RF-012) y "Mis tareas" (RF-055).

**Criterio de terminado**: todas las pruebas pasan en CI; en producción en Render un usuario puede registrarse con correo o con Google, recibir el correo de recuperación y restablecer su contraseña, crear un workspace, crear, archivar, restaurar y eliminar tableros, y usar la lista de tareas; otro usuario no puede acceder a nada de lo anterior.

## 3. Arquitectura

```
Navegador
   │  un solo origen: https://<static-site>.onrender.com
   ▼
Static Site (React + TS) ── rewrite /api/* ──► Web Service (Express + TS)
                                                   │  Better Auth (sesiones, Google, reset)
                                                   │  Drizzle ORM + migraciones
                                                   ├──► Render Postgres
                                                   └──► Resend (correo)
```

- **Mismo origen.** El Static Site define una regla de reescritura (rewrite) `/api/*` → `https://<web-service>.onrender.com/api/*` y otra `/*` → `/index.html` para el enrutado del SPA. El navegador solo ve un origen, por lo que la cookie de sesión es de primera parte y no hace falta CORS.
- **Sesión** en cookie `httpOnly`, `Secure` (en producción), `SameSite=Lax`, administrada por Better Auth y guardada en Postgres. El frontend nunca lee ni almacena tokens.
- **Desarrollo local.** El servidor de Vite hace proxy de `/api` a `http://localhost:3002`, igual que el rewrite de producción. Desaparecen `VITE_API_URL` y `FRONTEND_URL`.
- **Migraciones** versionadas con Drizzle Kit en `backend/drizzle/`; el comando de despliegue del Web Service ejecuta las migraciones antes de arrancar. Se elimina el `CREATE TABLE` al arrancar de la v1.
- **Correo** con Resend. Sin `RESEND_API_KEY` (desarrollo local), los correos se escriben en la consola del servidor en lugar de enviarse. Nota: el plan gratuito de Resend solo envía al correo del dueño de la cuenta hasta verificar un dominio.

### Estructura de carpetas

```
backend/
  src/
    index.ts              arranque del servidor
    app.ts                creación de la app Express (importable en pruebas)
    env.ts                lectura y validación de variables de entorno con Zod
    db/schema.ts          tablas Drizzle
    db/client.ts          conexión
    auth/auth.ts          configuración de Better Auth (+ hook de workspace personal)
    auth/email.ts         envío de correo (Resend o consola)
    middleware/           requireSession, loadMembership, errorHandler, rateLimit
    workspaces/           routes.ts, service.ts
    boards/               routes.ts, service.ts
    tasks/                routes.ts, service.ts
  drizzle/                migraciones generadas
  test/                   pruebas de API
frontend/
  src/
    main.tsx, router.tsx
    api/                  cliente fetch y hooks de TanStack Query
    auth/                 páginas de login, registro, recuperar, restablecer; RequireAuth
    layout/               AppShell, Sidebar, UserMenu
    boards/               BoardPage, diálogos de crear/editar/eliminar
    ui/                   Toast, Dialog, Skeleton, EmptyState, Field
    theme/                tema claro/oscuro/automático
  e2e/                    prueba Playwright
```

### Variables de entorno

| Variable | Servicio | Descripción |
|---|---|---|
| `DATABASE_URL` | API | Internal Database URL en Render; URL del contenedor Docker en local |
| `DB_SSL` | API | `false` con la URL interna y en local |
| `BETTER_AUTH_SECRET` | API | Secreto aleatorio de 32+ bytes |
| `APP_URL` | API | URL pública del Static Site (base de los enlaces de correo y del callback de Google) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | API | Cliente OAuth creado por el usuario en Google Cloud Console; URI de redirección `${APP_URL}/api/auth/callback/google` |
| `RESEND_API_KEY`, `EMAIL_FROM` | API | Opcionales en local |
| `PORT` | API | La asigna Render |

El Static Site ya no necesita variables; la URL de la API vive en la regla de rewrite.

## 4. Modelo de datos

```
users ─┬─< workspace_members >─┬─ workspaces ─< boards ─< tasks
       └─ sessions, accounts, verifications   (Better Auth)
```

| Tabla | Columnas | Restricciones |
|---|---|---|
| `users`, `sessions`, `accounts`, `verifications` | Esquema estándar de Better Auth | `users.email` único. Vincular Google a una cuenta existente solo si el correo de Google está verificado. |
| `workspaces` | `id uuid pk`, `name varchar(100) not null`, `is_personal boolean not null default false`, `created_at timestamptz not null default now()` | |
| `workspace_members` | `workspace_id uuid fk`, `user_id fk`, `role text not null`, `created_at timestamptz` | PK (`workspace_id`, `user_id`); `role` ∈ {`owner`,`admin`,`editor`,`viewer`} por CHECK; índice en `user_id` |
| `boards` | `id uuid pk`, `workspace_id uuid fk not null`, `name varchar(100) not null`, `color text not null`, `archived_at timestamptz null`, `created_at`, `updated_at timestamptz not null` | índice en (`workspace_id`, `archived_at`); `color` ∈ paleta fija por CHECK |
| `tasks` | `id uuid pk`, `board_id uuid fk not null`, `title varchar(200) not null`, `done boolean not null default false`, `created_at timestamptz not null default now()` | índice en `board_id` |

- Todas las llaves foráneas usan `ON DELETE CASCADE` hacia los hijos.
- La tabla `tasks` de la v1 se reemplaza (no hay datos de producción); la base local de Docker se recrea.
- **Workspace personal**: un hook de Better Auth al crear el usuario inserta, en la misma transacción, un workspace `"Personal"` con `is_personal = true` y la fila de miembro con rol `owner`. Un usuario tiene exactamente un workspace personal.
- En la Fase 1 solo existe el rol `owner`; la columna y el CHECK quedan listos para la Fase 3.

## 5. API

Autenticación: Better Auth montado en `/api/auth/*` (registro, login, logout, Google, solicitud y restablecimiento de contraseña, cambio de contraseña, sesión actual). Las rutas propias exigen sesión (401 sin ella).

| Método | Ruta | Cuerpo | Respuestas |
|---|---|---|---|
| GET | `/api/health` | — | 200 `{status:"ok"}` (sin sesión) |
| GET | `/api/workspaces` | — | 200 `[{id,name,isPersonal,role}]` |
| POST | `/api/workspaces` | `{name}` | 201 · 400 |
| PATCH | `/api/workspaces/:id` | `{name}` | 200 · 400 · 404 |
| DELETE | `/api/workspaces/:id` | — | 204 · 404 · 409 si es personal |
| GET | `/api/workspaces/:id/boards` | query `archived=true\|false` (por defecto `false`) | 200 · 404 |
| POST | `/api/workspaces/:id/boards` | `{name, color}` | 201 · 400 · 404 |
| PATCH | `/api/boards/:id` | `{name?, color?, archived?}` | 200 · 400 · 404 |
| DELETE | `/api/boards/:id` | — | 204 · 404 |
| GET | `/api/boards/:id/tasks` | — | 200 · 404 |
| POST | `/api/boards/:id/tasks` | `{title}` | 201 · 400 · 404 |
| PATCH | `/api/tasks/:id` | `{done}` | 200 · 400 · 404 |
| DELETE | `/api/tasks/:id` | — | 204 · 404 |

- **Validación** con Zod en cada ruta: nombres recortados de 1 a 100 caracteres, títulos de 1 a 200, `color` de la paleta, ids en formato UUID (un id mal formado responde 404, igual que uno inexistente), `archived` y `done` booleanos.
- **Errores** con forma única: `{ error: { code, message, fields? } }`. `code` ∈ {`validation`, `unauthorized`, `not_found`, `conflict`, `rate_limited`, `internal`}; `fields` mapea campo → mensaje.
- **Control de acceso**: un middleware resuelve el workspace del recurso (directo, vía tablero o vía tarea) y comprueba que el usuario de la sesión sea miembro. Si no lo es, responde **404**, igual que si no existiera. Ningún servicio consulta un recurso sin ese filtro.
- **Seguridad**: `helmet`; límite de intentos en login, registro y recuperación (lo provee Better Auth; además 300 peticiones por minuto por IP en el resto); hash de contraseñas a cargo de Better Auth; contraseñas de al menos 10 caracteres; la respuesta de recuperación es la misma exista o no el correo; los enlaces de restablecimiento caducan en 1 hora y son de un solo uso; nunca se devuelven hashes ni tokens.

## 6. Frontend

**Rutas**: `/login`, `/registro`, `/recuperar`, `/restablecer?token=…` (públicas; con sesión redirigen a `/app`); `/app`, `/app/w/:workspaceId`, `/app/b/:boardId`, `/app/archivados` (protegidas; sin sesión redirigen a `/login?next=<ruta>`). `/app` abre el primer tablero activo del workspace personal o su estado vacío. `/app/w/:workspaceId` muestra los tableros activos de ese workspace como lista con su color, más las acciones de renombrar y eliminar el workspace.

**Disposición**

```
┌──────────────┬───────────────────────────────────────────┐
│ TaskBoard    │  Personal / Taller Render       [⋯]       │
│              │                                           │
│ Personal   ▾ │  [¿Qué hay que hacer?        ] [Agregar]  │
│  ● Taller    │                                           │
│  + Tablero   │  Pendientes 3                             │
│ Equipo X   ▾ │  ○ Crear la base en Render            ✕   │
│ + Workspace  │                                           │
│ Archivados   │                                           │
│ (●) Nombre ▾ │                                           │
└──────────────┴───────────────────────────────────────────┘
```

- **Barra lateral (RF-072)**: workspaces desplegables con sus tableros activos (punto del color del tablero), "+ Tablero", "+ Workspace", "Archivados" y menú de usuario (tema, cambiar contraseña, cerrar sesión). En pantallas menores de 768 px es un panel que se abre con un botón y se cierra con Esc o al elegir un tablero.
- **Cabecera del tablero**: ubicación "workspace / tablero" y menú ⋯ con renombrar, cambiar color, archivar y eliminar.
- **Tablero**: la lista de tareas v1 con el estilo actual (pizarra y resaltador).
- **Archivados**: lista de tableros archivados de todos mis workspaces con "Restaurar" y "Eliminar".
- **Formularios de cuenta**: validación al salir de cada campo y al enviar (RF-088); botón "Continuar con Google"; errores accionables (p. ej. "Ese correo ya tiene cuenta. Inicia sesión o recupera tu contraseña."). La recuperación siempre responde "Si existe una cuenta con ese correo, te enviamos un enlace".
- **Comportamientos comunes**:
  - RF-084: las acciones se guardan al instante; un indicador discreto muestra "Guardando…" y "Guardado".
  - RF-085: skeletons en la barra lateral y en el tablero mientras cargan.
  - RF-086: toasts tras crear, renombrar, archivar, restaurar y eliminar; archivar tablero y eliminar tarea ofrecen "Deshacer" durante 5 segundos. Deshacer un archivado envía `PATCH {archived:false}`; al eliminar una tarea, la interfaz la oculta al instante y envía el `DELETE` cuando pasan los 5 segundos sin deshacer (o al salir de la página).
  - RF-087: mensajes de error con causa y acción sugerida.
  - RF-089: eliminar un tablero o un workspace exige escribir su nombre en un diálogo de confirmación.
  - RF-090: estados vacíos con llamado a la acción ("Crea tu primer tablero").
  - RF-093: tema claro, oscuro o automático, elegido en el menú de usuario y guardado en `localStorage`.
  - RF-098/099: contraste AA, foco visible, diálogos con foco atrapado y cierre con Esc, todo operable con teclado.
- **Datos**: TanStack Query para cargar y cachear; las mutaciones actualizan la caché e invalidan las consultas afectadas. Reintenta 2 veces los errores de red; mientras la API despierta muestra "Conectando con el servidor…".

## 7. Manejo de errores

- **Backend**: un middleware final convierte errores de Zod en 400 con `fields`, `NotFoundError` en 404, `ConflictError` en 409 y cualquier otro en 500 con mensaje genérico; el detalle solo va al log.
- **Frontend**: 401 → redirige a `/login?next=…`; 400 con `fields` → mensajes junto a cada campo; 404 → pantalla "Este tablero no existe o no tienes acceso" con enlace a `/app`; red caída o 5xx → toast con "Reintentar".

## 8. Pruebas

| Nivel | Herramientas | Casos |
|---|---|---|
| API | Vitest + Supertest, Postgres real en Docker con base de pruebas recreada por suite | Registro crea workspace personal con rol owner · login correcto e incorrecto · rutas protegidas sin sesión → 401 · validaciones → 400 con `fields` · **aislamiento**: el usuario B recibe 404 al leer, editar o borrar workspaces, tableros y tareas de A · borrar workspace personal → 409 · archivar oculta del listado y restaurar lo devuelve · borrar workspace elimina tableros y tareas en cascada · recuperación: el correo (consola) contiene un enlace que funciona una sola vez |
| Frontend | Vitest + Testing Library | Validación de formularios · RequireAuth redirige con `next` · estados de carga, vacío y error del tablero · diálogo de eliminación exige el nombre exacto |
| E2E | Playwright (1 prueba) | Registrarse → crear tablero → agregar y completar tarea → cerrar sesión → iniciar sesión → la tarea sigue ahí |

**CI**: GitHub Actions ejecuta lint, verificación de tipos y pruebas de API y frontend en cada push y pull request. Render tiene activado el despliegue automático solo cuando pasan los checks.

## 9. Tareas a cargo del usuario

Requieren cuentas propias y no las hace el asistente:

1. Crear el cliente OAuth en Google Cloud Console con la URI de redirección indicada y pasar las claves a Render.
2. Crear la cuenta de Resend y su API key; opcionalmente verificar un dominio para enviar a cualquier correo.
3. Crear o recrear en Render los servicios con la nueva configuración (rewrite del Static Site, comando de despliegue con migraciones, variables de entorno).
