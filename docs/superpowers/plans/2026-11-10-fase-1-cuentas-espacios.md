# TaskBoard v2 · Fase 1: Cuentas y espacios · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir TaskBoard en una app con cuentas (correo/contraseña y Google), workspaces y tableros por usuario, manteniendo la lista de tareas dentro de cada tablero.

**Architecture:** Monorepo `backend/` (Express 5 + TypeScript + Better Auth + Drizzle sobre PostgreSQL) y `frontend/` (React + Vite + TypeScript + React Router + TanStack Query). En producción el Static Site de Render reescribe `/api/*` hacia el Web Service, de modo que el navegador ve un solo origen y la sesión viaja en una cookie httpOnly de primera parte. En local, el proxy de Vite imita esa reescritura.

**Tech Stack:** Node 20+, TypeScript 5, Express 5, better-auth 1.x, drizzle-orm + drizzle-kit, pg, zod, helmet, express-rate-limit, resend, Vitest, Supertest, React 19, react-router 7, @tanstack/react-query 5, @testing-library/react, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-fase-1-cuentas-espacios-design.md`

## Global Constraints

- Directorio de trabajo: `C:\Users\JULIAN\taskboard`. Rama de trabajo `fase-1`; `main` solo recibe la rama terminada.
- Antes de cualquier cambio: etiqueta `v1-taller` en el commit actual de `main` (`git tag v1-taller && git push origin v1-taller`).
- Todo el código nuevo en TypeScript con `"strict": true`. Se eliminan `backend/index.js`, `backend/schema.sql`, `frontend/src/App.jsx`, `frontend/src/main.jsx`.
- La API escucha en `PORT` (por defecto `3002` en local). Vite en `5173` con proxy `/api` → `http://localhost:3002`.
- Base local: contenedor Docker `taskboard-db` en `127.0.0.1:15432`, usuario `taskboard`, clave `taskboard_local`. Desarrollo usa la base `taskboard`; pruebas usan `taskboard_test` (`TEST_DATABASE_URL`).
- Longitudes: nombres de workspace y tablero de 1 a 100 caracteres tras `trim()`; títulos de tarea de 1 a 200; contraseña mínimo 10 caracteres.
- Paleta de tableros (valor guardado → hex en el frontend): `cobalt #2433C4`, `teal #0F8A8A`, `green #2E8540`, `amber #B7791F`, `coral #D64545`, `violet #7B3FC4`. Color por defecto `cobalt`.
- Roles válidos en la base: `owner`, `admin`, `editor`, `viewer`. En esta fase solo se crea `owner`.
- Respuesta de error única: `{ error: { code, message, fields? } }` con `code` ∈ `validation | unauthorized | not_found | conflict | rate_limited | internal`.
- Un recurso ajeno, inexistente o con id mal formado responde 404 con `code: "not_found"`.
- Enlace de restablecimiento: caduca en 3600 s y es de un solo uso. La respuesta a "recuperar" es la misma exista o no el correo.
- Textos de la interfaz en español, sentence case, con los mensajes exactos que fija la spec.
- **Desvío respecto a la spec:** Better Auth no permite crear el workspace personal en la misma transacción que el usuario. Se crea en `databaseHooks.user.create.after` y, como red de seguridad, `GET /api/workspaces` llama a `ensurePersonalWorkspace(userId)` (idempotente). Avisar al usuario de este cambio al entregar.
- **Render, plan gratuito:** no hay pre-deploy command, así que el start command ejecuta las migraciones antes de arrancar (`npm run start:prod`).
- Los nombres de la API de Better Auth cambian entre versiones menores. El implementador consulta la documentación de la versión instalada (`better-auth.com/docs`) antes de usar `toNodeHandler`, `fromNodeHeaders`, `databaseHooks`, `requestPasswordReset` y los métodos del cliente.

## Review Focus

1. **Acentos y emoji en nombres y títulos** ("Leer la guía", "Casa 🏠"): deben guardarse y volver idénticos. Prueba en la Tarea 6.
2. **Eliminar o archivar el tablero que se está viendo**: la app debe ir a `/app` y no quedarse en un 404 obsoleto. Prueba en la Tarea 11.
3. **Sesión caducada a mitad de uso**: una mutación que recibe 401 debe llevar a `/login?next=<ruta actual>`, no mostrar un error genérico. Prueba en la Tarea 8.
4. **Doble clic en "Crear" o "Agregar"**: no debe crear duplicados; el botón queda deshabilitado mientras la petición está en curso. Prueba en la Tarea 10.
5. **Borrar un workspace con tableros abiertos en la barra lateral**: sus tableros desaparecen de la barra sin recargar y la base no deja huérfanos. Pruebas en las Tareas 4 y 10.

---

### Task 0: Preparación del repositorio

**Files:**
- Modify: `.gitignore` (añadir `coverage/`, `playwright-report/`, `test-results/`)

- [ ] **Step 1:** `git tag v1-taller` en `main` y `git push origin v1-taller`. Verificar con `git ls-remote --tags origin` que aparece `refs/tags/v1-taller`.
- [ ] **Step 2:** `git switch -c fase-1`.
- [ ] **Step 3:** Crear la base de pruebas: `docker exec taskboard-db createdb -U taskboard taskboard_test`. Verificar con `docker exec taskboard-db psql -U taskboard -lqt` que aparece `taskboard_test`.
- [ ] **Step 4:** Commit: `chore: preparar rama fase-1`.

---

### Task 1: Backend en TypeScript con servidor base

**Files:**
- Create: `backend/tsconfig.json`, `backend/vitest.config.ts`, `backend/src/env.ts`, `backend/src/app.ts`, `backend/src/index.ts`, `backend/src/errors.ts`, `backend/src/middleware/errorHandler.ts`, `backend/test/health.test.ts`, `backend/.env.example`
- Modify: `backend/package.json`
- Delete: `backend/index.js`, `backend/schema.sql`

**Interfaces:**
- Produces:
  - `env` (objeto validado con Zod): `{ DATABASE_URL: string; DB_SSL: boolean; BETTER_AUTH_SECRET: string; APP_URL: string; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; RESEND_API_KEY?: string; EMAIL_FROM: string; PORT: number; NODE_ENV: "development" | "test" | "production" }`. Con `NODE_ENV=test`, `DATABASE_URL` toma el valor de `TEST_DATABASE_URL`.
  - `createApp(): express.Express` en `app.ts`, sin `listen`, para usar en pruebas.
  - Clases en `errors.ts`: `NotFoundError`, `ConflictError(message)`, `UnauthorizedError`. Las tres extienden `HttpError { status: number; code: string }`.
  - `errorHandler` (último middleware): Zod → 400 `validation` con `fields`; `HttpError` → su status y code; JSON mal formado → 400 `validation`; cualquier otro → 500 `internal` con mensaje "Error interno del servidor" y `console.error` del detalle.
- Scripts de `package.json`: `dev` (`tsx watch src/index.ts`), `build` (`tsc -p .`), `start` (`node dist/index.js`), `start:prod` (`npm run migrate && npm start`), `migrate` (lo define la Tarea 2), `test` (`vitest run`), `typecheck` (`tsc --noEmit`), `lint`.

- [ ] **Step 1: Write the failing tests** in `backend/test/health.test.ts`

```ts
test("GET /api/health responde ok", async () => {
  const res = await request(createApp()).get("/api/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok" });
});
test("ruta inexistente responde 404 con forma de error", async () => {
  const res = await request(createApp()).get("/api/nada");
  expect(res.status).toBe(404);
  expect(res.body.error.code).toBe("not_found");
});
test("JSON mal formado responde 400 validation", async () => {
  const res = await request(createApp()).post("/api/health")
    .set("Content-Type", "application/json").send("{mal");
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe("validation");
});
test("incluye cabeceras de helmet", async () => {
  const res = await request(createApp()).get("/api/health");
  expect(res.headers["x-content-type-options"]).toBe("nosniff");
});
```

- [ ] **Step 2:** `npm test` → FAIL (no existe `createApp`).
- [ ] **Step 3:** Implementar `env.ts`, `errors.ts`, `errorHandler.ts` y `createApp()`: `helmet()`, `express-rate-limit` con 300 peticiones por minuto por IP sobre `/api`, la ruta de health, 404 para el resto de `/api/*` y `errorHandler`. `index.ts` llama a `createApp().listen(env.PORT)`. **No** registrar `express.json()` de forma global: la Tarea 3 monta Better Auth antes del parser.
- [ ] **Step 4:** `npm test` → PASS; `npm run typecheck` → sin errores.
- [ ] **Step 5:** Commit: `feat(api): servidor base en TypeScript con manejo de errores`.

---

### Task 2: Esquema de base de datos y migraciones

**Files:**
- Create: `backend/drizzle.config.ts`, `backend/src/db/client.ts`, `backend/src/db/schema.ts`, `backend/src/db/migrate.ts`, `backend/drizzle/` (generado), `backend/test/helpers/db.ts`, `backend/test/setup.ts`, `backend/test/schema.test.ts`

**Interfaces:**
- Produces:
  - `db` (instancia de Drizzle) y `pool` en `db/client.ts`.
  - Tablas en `db/schema.ts`: `user`, `session`, `account`, `verification` (generadas con `npx @better-auth/cli generate`, con el formato de Drizzle), `workspaces`, `workspaceMembers`, `boards`, `tasks`, con las columnas, CHECK, índices y `ON DELETE CASCADE` de la sección 4 de la spec. Los ids propios son `uuid` con `defaultRandom()`.
  - `BOARD_COLORS = ["cobalt","teal","green","amber","coral","violet"] as const` y `ROLES = ["owner","admin","editor","viewer"] as const`, exportados desde `schema.ts`.
  - El script `migrate` (`tsx src/db/migrate.ts`) aplica `drizzle/`.
  - `resetDb(): Promise<void>` en `test/helpers/db.ts` vacía todas las tablas con `TRUNCATE ... CASCADE`. `test/setup.ts` migra la base de pruebas una vez (`globalSetup`) y llama a `resetDb` antes de cada prueba.

- [ ] **Step 1: Write the failing tests** in `backend/test/schema.test.ts` (insertan directamente con `db`)

```ts
test("rechaza un rol fuera de la lista", async () => {
  await expect(insertMember({ role: "superadmin" })).rejects.toThrow(/check/i);
});
test("rechaza un color fuera de la paleta", async () => {
  await expect(insertBoard({ color: "pink" })).rejects.toThrow(/check/i);
});
test("borrar un workspace borra sus tableros y tareas", async () => {
  const { workspaceId, boardId } = await seedWorkspaceWithBoardAndTask();
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  expect(await db.select().from(boards).where(eq(boards.id, boardId))).toHaveLength(0);
  expect(await db.select().from(tasks).where(eq(tasks.boardId, boardId))).toHaveLength(0);
});
```

  `insertMember`, `insertBoard` y `seedWorkspaceWithBoardAndTask` son helpers locales del archivo de prueba.

- [ ] **Step 2:** `npm test -- schema` → FAIL.
- [ ] **Step 3:** Escribir `schema.ts`, generar la migración con `npx drizzle-kit generate` y escribir `migrate.ts` y los helpers.
- [ ] **Step 4:** `npm test` → PASS. `npm run migrate` contra la base `taskboard` local termina sin error. Antes, borrar la tabla `tasks` de la v1 con `docker exec taskboard-db psql -U taskboard -c "DROP TABLE IF EXISTS tasks"`.
- [ ] **Step 5:** Commit: `feat(db): esquema de workspaces, tableros y tareas con migraciones`.

---

### Task 3: Autenticación con Better Auth

**Files:**
- Create: `backend/src/auth/auth.ts`, `backend/src/auth/email.ts`, `backend/src/auth/personalWorkspace.ts`, `backend/src/middleware/requireSession.ts`, `backend/test/helpers/auth.ts`, `backend/test/auth.test.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Consumes: `db`, `schema` y `env` de las Tareas 1 y 2.
- Produces:
  - `auth` en `auth/auth.ts`. Configuración: `baseURL: env.APP_URL`, `basePath: "/api/auth"`, `trustedOrigins: [env.APP_URL]`, adaptador Drizzle `provider: "pg"`, `emailAndPassword { enabled: true, minPasswordLength: 10, resetPasswordTokenExpiresIn: 3600, sendResetPassword }`, `socialProviders.google` solo si existen las dos variables de Google, `account.accountLinking { enabled: true, trustedProviders: ["google"] }`, `rateLimit { enabled: true }` y `databaseHooks.user.create.after` → `ensurePersonalWorkspace(user.id)`.
  - `sendEmail({ to, subject, text }): Promise<void>` en `auth/email.ts`. Usa Resend si existe `RESEND_API_KEY`; si no, hace `console.log`. Exporta `sentEmails: {to,subject,text}[]`, que se llena cuando `NODE_ENV=test`.
  - `ensurePersonalWorkspace(userId: string): Promise<string>` devuelve el id del workspace personal. Es idempotente: dentro de una transacción con `pg_advisory_xact_lock(hashtext(userId))`, busca un workspace `is_personal` donde el usuario sea `owner` y, si no existe, crea `"Personal"` y su fila de miembro.
  - `requireSession` (middleware) pone `req.user = { id, email, name }` y, sin sesión válida, lanza `UnauthorizedError`. Declarar el tipo en `src/types/express.d.ts`.
  - En `createApp()`: `app.all("/api/auth/*splat", toNodeHandler(auth))` va **antes** de `express.json()`.
  - Helper de pruebas `signUp(email?: string): Promise<{ agent: TestAgent; userId: string }>`. Usa `request.agent(app)` (que conserva la cookie), envía la cabecera `Origin: env.APP_URL` y hace `POST /api/auth/sign-up/email` con la contraseña `"clave-segura-123"`.

- [ ] **Step 1: Write the failing tests** in `backend/test/auth.test.ts`

```ts
test("registrarse crea el workspace personal con rol owner", async () => {
  const { userId } = await signUp("ana@test.dev");
  const rows = await membershipsOf(userId);
  expect(rows).toEqual([expect.objectContaining({ role: "owner", isPersonal: true, name: "Personal" })]);
});
test("ensurePersonalWorkspace es idempotente", async () => {
  const { userId } = await signUp();
  const [a, b] = await Promise.all([ensurePersonalWorkspace(userId), ensurePersonalWorkspace(userId)]);
  expect(a).toBe(b);
  expect(await membershipsOf(userId)).toHaveLength(1);
});
test("contraseña de 9 caracteres se rechaza", async () => {
  const res = await request(createApp()).post("/api/auth/sign-up/email")
    .set("Origin", env.APP_URL).send({ email: "b@test.dev", password: "123456789", name: "B" });
  expect(res.status).toBe(400);
});
test("login con contraseña incorrecta falla", async () => {
  await signUp("c@test.dev");
  const res = await request(createApp()).post("/api/auth/sign-in/email")
    .set("Origin", env.APP_URL).send({ email: "c@test.dev", password: "otra-clave-999" });
  expect(res.status).toBe(401);
});
test("recuperar contraseña: enlace de un solo uso", async () => {
  await signUp("d@test.dev");
  await request(createApp()).post("/api/auth/request-password-reset")
    .set("Origin", env.APP_URL).send({ email: "d@test.dev", redirectTo: "/restablecer" });
  const token = extractToken(sentEmails.at(-1)!.text);
  const reset = (pw: string) => request(createApp()).post("/api/auth/reset-password")
    .set("Origin", env.APP_URL).send({ token, newPassword: pw });
  expect((await reset("nueva-clave-123")).status).toBe(200);
  expect((await reset("otra-nueva-456")).status).toBe(400);
});
test("recuperar con correo inexistente responde igual que con uno existente", async () => {
  await signUp("e@test.dev");
  const send = (email: string) => request(createApp()).post("/api/auth/request-password-reset")
    .set("Origin", env.APP_URL).send({ email, redirectTo: "/restablecer" });
  const [a, b] = await Promise.all([send("e@test.dev"), send("nadie@test.dev")]);
  expect(a.status).toBe(b.status);
  expect(a.body).toEqual(b.body);
});
```

  `membershipsOf(userId)` (JOIN de `workspace_members` con `workspaces`, que devuelve `{role, isPersonal, name}`) y `extractToken(text)` (toma el parámetro `token` del enlace del correo) son helpers de `test/helpers/auth.ts`. Antes del Step 1, verificar en la documentación de la versión instalada las rutas exactas (`request-password-reset` o `forget-password`) y ajustar las pruebas.

- [ ] **Step 2:** `npm test -- auth` → FAIL.
- [ ] **Step 3:** Implementar los archivos de la lista `Files`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit: `feat(auth): registro, login, Google y recuperación con Better Auth`.

---

### Task 4: API de workspaces con control de acceso

**Files:**
- Create: `backend/src/access.ts`, `backend/src/validation.ts`, `backend/src/workspaces/routes.ts`, `backend/src/workspaces/service.ts`, `backend/test/workspaces.test.ts`
- Modify: `backend/src/app.ts` (montar `express.json()` y los routers tras `requireSession`)

**Interfaces:**
- Consumes: `requireSession`, `ensurePersonalWorkspace`, `signUp` y los errores.
- Produces:
  - En `validation.ts`: `nameSchema = z.string().trim().min(1).max(100)`, `titleSchema = z.string().trim().min(1).max(200)`, `colorSchema = z.enum(BOARD_COLORS)` y `uuidParam(value: string): string`, que lanza `NotFoundError` si el valor no es un UUID.
  - En `access.ts`: `requireWorkspaceMember(userId, workspaceId): Promise<{ role: Role; isPersonal: boolean }>`, `requireBoardAccess(userId, boardId): Promise<{ board: Board; role: Role }>` y `requireTaskAccess(userId, taskId): Promise<{ task: Task; boardId: string; role: Role }>`. Las tres hacen JOIN con `workspace_members` y lanzan `NotFoundError` si no hay fila. Son **el único** camino para cargar un recurso por id.
  - Rutas de workspaces según la tabla de la sección 5 de la spec. `GET` devuelve `[{ id, name, isPersonal, role }]` ordenado con el personal primero y luego por `created_at`. `DELETE` sobre el personal lanza `ConflictError("No puedes eliminar tu espacio personal")`.

- [ ] **Step 1: Write the failing tests** in `backend/test/workspaces.test.ts`

```ts
test("sin sesión responde 401", async () => {
  const res = await request(createApp()).get("/api/workspaces");
  expect(res.status).toBe(401);
  expect(res.body.error.code).toBe("unauthorized");
});
test("crear, listar y renombrar", async () => {
  const { agent } = await signUp();
  const created = await agent.post("/api/workspaces").send({ name: "  Equipo X  " });
  expect(created.status).toBe(201);
  expect(created.body.name).toBe("Equipo X");
  const list = await agent.get("/api/workspaces");
  expect(list.body.map((w) => w.name)).toEqual(["Personal", "Equipo X"]);
  const renamed = await agent.patch(`/api/workspaces/${created.body.id}`).send({ name: "Equipo Y" });
  expect(renamed.body.name).toBe("Equipo Y");
});
test("nombre vacío o de 101 caracteres responde 400 con fields.name", async () => {
  const { agent } = await signUp();
  for (const name of ["   ", "x".repeat(101)]) {
    const res = await agent.post("/api/workspaces").send({ name });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.name).toBeTruthy();
  }
});
test("no se puede eliminar el workspace personal", async () => {
  const { agent } = await signUp();
  const [personal] = (await agent.get("/api/workspaces")).body;
  expect((await agent.delete(`/api/workspaces/${personal.id}`)).status).toBe(409);
});
test("aislamiento: B recibe 404 sobre el workspace de A", async () => {
  const a = await signUp("a@test.dev");
  const b = await signUp("b@test.dev");
  const ws = (await a.agent.post("/api/workspaces").send({ name: "Privado" })).body;
  expect((await b.agent.patch(`/api/workspaces/${ws.id}`).send({ name: "x" })).status).toBe(404);
  expect((await b.agent.delete(`/api/workspaces/${ws.id}`)).status).toBe(404);
  expect((await b.agent.get(`/api/workspaces/${ws.id}/boards`)).status).toBe(404);
});
test("id mal formado responde 404", async () => {
  const { agent } = await signUp();
  expect((await agent.patch("/api/workspaces/123").send({ name: "x" })).status).toBe(404);
});
test("borrar un workspace con tableros no deja huérfanos", async () => {
  const { agent } = await signUp();
  const ws = (await agent.post("/api/workspaces").send({ name: "Temporal" })).body;
  const board = (await agent.post(`/api/workspaces/${ws.id}/boards`).send({ name: "T", color: "teal" })).body;
  expect((await agent.delete(`/api/workspaces/${ws.id}`)).status).toBe(204);
  expect((await agent.get(`/api/boards/${board.id}/tasks`)).status).toBe(404);
});
```

  La última prueba depende de las rutas de la Tarea 5; se marca `test.todo` hasta que esa tarea exista y se activa allí.

- [ ] **Step 2:** `npm test -- workspaces` → FAIL.
- [ ] **Step 3:** Implementar `validation.ts`, `access.ts`, `service.ts` y `routes.ts`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit: `feat(api): workspaces con control de acceso por membresía`.

---

### Task 5: API de tableros

**Files:**
- Create: `backend/src/boards/routes.ts`, `backend/src/boards/service.ts`, `backend/test/boards.test.ts`

**Interfaces:**
- Consumes: `requireWorkspaceMember`, `requireBoardAccess`, `nameSchema`, `colorSchema` y `uuidParam`.
- Produces: rutas de tableros según la spec. Un tablero en JSON es `{ id, workspaceId, name, color, archivedAt: string | null, createdAt, updatedAt }`. `GET /api/workspaces/:id/boards?archived=true|false` (por defecto `false`) ordena por `created_at`. `PATCH` acepta `{ name?, color?, archived? }` con al menos un campo; `archived: true` pone `archived_at = now()` y `false` lo pone a `null`. Toda escritura actualiza `updated_at`. Además:
  - `GET /api/boards/archived` devuelve los archivados de **todos** mis workspaces, con `workspaceName`, para la página "Archivados". Se registra antes de `/api/boards/:id` para que `archived` no se interprete como un id.
  - `GET /api/boards/:id` devuelve el tablero con `workspaceName`; sin acceso, 404.
  - Helper de pruebas `signUpWithBoard(): Promise<{ agent; userId; workspaceId; boardId }>` en `test/helpers/auth.ts`: se registra y crea el tablero "Tablero de prueba" en su workspace personal.

- [ ] **Step 1: Write the failing tests** in `backend/test/boards.test.ts`: crear con color por defecto `cobalt` · color `"pink"` → 400 `fields.color` · archivar lo quita de la lista activa y lo pone en `?archived=true` y en `/api/boards/archived` · restaurar lo devuelve · `GET /api/boards/archived` no se confunde con un id · `PATCH {}` → 400 · aislamiento en `GET /api/boards/:id` · aislamiento: B recibe 404 en `PATCH` y `DELETE` de un tablero de A · `DELETE` → 204 y después 404. Activar el `test.todo` de cascada de la Tarea 4.
- [ ] **Step 2:** `npm test -- boards` → FAIL.
- [ ] **Step 3:** Implementar `service.ts` y `routes.ts`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit: `feat(api): tableros con archivar, restaurar y eliminar`.

---

### Task 6: API de tareas dentro de un tablero

**Files:**
- Create: `backend/src/tasks/routes.ts`, `backend/src/tasks/service.ts`, `backend/test/tasks.test.ts`

**Interfaces:**
- Consumes: `requireBoardAccess`, `requireTaskAccess` y `titleSchema`.
- Produces: `GET /api/boards/:id/tasks` (ordenado por `created_at`), `POST /api/boards/:id/tasks {title}`, `PATCH /api/tasks/:id {done: boolean}`, `DELETE /api/tasks/:id`. Una tarea en JSON es `{ id, boardId, title, done, createdAt }`.

- [ ] **Step 1: Write the failing tests** in `backend/test/tasks.test.ts`

```ts
test("acentos y emoji se guardan y vuelven idénticos", async () => {
  const { agent, boardId } = await signUpWithBoard();
  const title = "Leer la guía de Render 🚀 — ñandú";
  await agent.post(`/api/boards/${boardId}/tasks`).send({ title });
  const list = await agent.get(`/api/boards/${boardId}/tasks`);
  expect(list.body[0].title).toBe(title);
});
```

  Más: crear → 201 · título vacío o de 201 caracteres → 400 `fields.title` · `PATCH {done:"si"}` → 400 · completar → `done: true` · `DELETE` → 204 y repetirlo → 404 · aislamiento: B recibe 404 al listar, crear, completar y borrar tareas de A.

- [ ] **Step 2:** `npm test -- tasks` → FAIL.
- [ ] **Step 3:** Implementar `service.ts` y `routes.ts`.
- [ ] **Step 4:** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5:** Commit: `feat(api): tareas por tablero`.

---

### Task 7: Base del frontend en TypeScript

**Files:**
- Create: `frontend/tsconfig.json`, `frontend/vite.config.ts` (sustituye a `.js`), `frontend/src/main.tsx`, `frontend/src/router.tsx`, `frontend/src/api/client.ts`, `frontend/src/theme/theme.ts`, `frontend/src/ui/{Toast,Dialog,Skeleton,EmptyState,Field,SaveStatus}.tsx`, `frontend/src/styles/tokens.css`, `frontend/src/test/setup.ts`, `frontend/src/api/client.test.ts`, `frontend/src/theme/theme.test.ts`
- Delete: `frontend/src/App.jsx`, `frontend/src/main.jsx`, `frontend/vite.config.js`, `frontend/.env.example`
- Modify: `frontend/package.json`, `frontend/src/index.css` (pasa los tokens de color del rediseño actual a `tokens.css` y añade `[data-theme="dark"]`)

**Interfaces:**
- Produces:
  - `apiFetch<T>(path: string, init?: RequestInit): Promise<T>` en `api/client.ts`: rutas relativas a `/api`, `credentials: "same-origin"` y JSON. Si la respuesta no es 2xx, lanza `ApiError { status: number; code: string; message: string; fields?: Record<string,string> }`. Un fallo de red lanza `ApiError` con `status: 0` y `code: "network"`. Ante un 401 llama a `onUnauthorized()`, registrado con `setUnauthorizedHandler(fn)`.
  - `queryClient` configurado con `retry`: hasta 2 reintentos solo cuando `status === 0` o `status >= 500`.
  - `getTheme(): "light" | "dark" | "system"` y `setTheme(t)` en `theme/theme.ts`. Guarda el valor en `localStorage["taskboard-theme"]` dentro de try/catch y aplica `data-theme` en `<html>` (sin el atributo para `system`).
  - Componentes:
    - `<Dialog open onClose title>` sobre `<dialog>` nativo con `showModal()`.
    - `<ToastProvider>` con `useToast(): { show(message, opts?: { actionLabel?: string; onAction?: () => void; durationMs?: number }) }`; por defecto `durationMs` vale 5000.
    - `<Skeleton lines>`, `<EmptyState title action>` y `<Field label error>` (asocia `aria-describedby`).
    - `<SaveStatus />`, que lee `useIsMutating()` y muestra "Guardando…" o "Guardado".
  - Proxy de Vite: `server.proxy["/api"] = "http://localhost:3002"`.
  - Fuentes: se mantienen Bricolage Grotesque e Instrument Sans y la estética de pizarra y resaltador.

- [ ] **Step 1: Write the failing tests**: en `client.test.ts`, que un 400 con `fields` produzca `ApiError` con esos `fields`; que un `fetch` rechazado produzca `code: "network"`; que un 401 llame al handler registrado. En `theme.test.ts`, que `setTheme("dark")` ponga `data-theme="dark"` y guarde el valor, y que, si `localStorage` lanza un error, `getTheme()` devuelva `"system"` sin romperse.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar los archivos.
- [ ] **Step 4:** `npm test && npx tsc --noEmit && npm run build` → PASS.
- [ ] **Step 5:** Commit: `feat(web): base TypeScript con cliente de API, tema y componentes UI`.

---

### Task 8: Pantallas de cuenta y rutas protegidas

**Files:**
- Create: `frontend/src/auth/authClient.ts`, `frontend/src/auth/{LoginPage,RegisterPage,ForgotPage,ResetPage}.tsx`, `frontend/src/auth/RequireAuth.tsx`, `frontend/src/auth/validation.ts`, `frontend/src/auth/auth.test.tsx`
- Modify: `frontend/src/router.tsx`

**Interfaces:**
- Consumes: `Field`, `useToast`, `setUnauthorizedHandler`.
- Produces:
  - `authClient = createAuthClient({ basePath: "/api/auth" })` (de `better-auth/react`), con `useSession()`.
  - `validateEmail(v): string | null` y `validatePassword(v): string | null`. Los mensajes son "Escribe un correo válido." y "La contraseña debe tener al menos 10 caracteres.".
  - `<RequireAuth>`: mientras carga muestra un skeleton; sin sesión hace `navigate("/login?next=" + encodeURIComponent(location.pathname + location.search))`. `LoginPage`, tras entrar, navega a `next` solo si empieza por `/app`; si no, va a `/app`.
  - `setUnauthorizedHandler` se registra en `main.tsx` y redirige igual que `RequireAuth`.
  - Textos exactos:
    - registro con correo existente: "Ese correo ya tiene cuenta. Inicia sesión o recupera tu contraseña.";
    - recuperar: "Si existe una cuenta con ese correo, te enviamos un enlace.";
    - botón de Google: "Continuar con Google".
  - Las páginas públicas con sesión activa redirigen a `/app`.

- [ ] **Step 1: Write the failing tests** in `auth.test.tsx` (con `fetch` simulado):
  - Al salir del campo de correo con "ana@" aparece "Escribe un correo válido.".
  - `RequireAuth` sin sesión en `/app/b/123` redirige a `/login?next=%2Fapp%2Fb%2F123`.
  - `next=https://evil.dev` tras el login lleva a `/app`.
  - Una mutación que recibe 401 lleva a `/login?next=<ruta actual>` (Review Focus 3).
  - El formulario de recuperar muestra el mismo texto tanto si la API responde 200 como si responde 404.
- [ ] **Step 2:** `npm test -- auth` → FAIL.
- [ ] **Step 3:** Implementar los archivos.
- [ ] **Step 4:** `npm test` → PASS. Probar a mano con la API local: registro, cierre de sesión, inicio de sesión y recuperación con el enlace que aparece en la consola de la API.
- [ ] **Step 5:** Commit: `feat(web): registro, inicio de sesión y recuperación de contraseña`.

---

### Task 9: Hooks de datos de workspaces y tableros

**Files:**
- Create: `frontend/src/api/workspaces.ts`, `frontend/src/api/boards.ts`, `frontend/src/api/tasks.ts`, `frontend/src/api/types.ts`, `frontend/src/api/hooks.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `queryClient`.
- Produces:
  - Tipos `Workspace`, `Board` y `Task`, con la forma JSON de las Tareas 4 a 6.
  - Claves de caché: `["workspaces"]`, `["boards", workspaceId, archived]`, `["boards","archived"]`, `["board", boardId]`, `["tasks", boardId]`.
  - Hooks:
    - `useWorkspaces()`, `useCreateWorkspace()`, `useRenameWorkspace()`, `useDeleteWorkspace()`;
    - `useBoards(workspaceId, archived?)`, `useArchivedBoards()`, `useCreateBoard(workspaceId)`, `useUpdateBoard()`, `useDeleteBoard()`;
    - `useTasks(boardId)`, `useCreateTask(boardId)`, `useToggleTask()`, `useDeleteTask()`.
  - Cada mutación invalida las claves afectadas. `useDeleteWorkspace` invalida `["workspaces"]` y elimina de la caché `["boards", id, *]`. `useToggleTask` actualiza la caché de forma optimista y revierte si hay error.
  - `useBoard(boardId)` usa `GET /api/boards/:id` (Tarea 5).

- [ ] **Step 1: Write the failing tests**:
  - `useDeleteWorkspace` deja de mostrar los tableros de ese workspace en `useBoards`.
  - `useToggleTask` revierte `done` si la API responde 500.
- [ ] **Step 2:** `npm test -- hooks` → FAIL.
- [ ] **Step 3:** Implementar los archivos.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit: `feat(web): hooks de datos para workspaces, tableros y tareas`.

---

### Task 10: AppShell y barra lateral

**Files:**
- Create: `frontend/src/layout/{AppShell,Sidebar,UserMenu}.tsx`, `frontend/src/boards/{CreateBoardDialog,CreateWorkspaceDialog}.tsx`, `frontend/src/layout/layout.test.tsx`, `frontend/src/layout/layout.css`
- Modify: `frontend/src/router.tsx`

**Interfaces:**
- Consumes: los hooks de la Tarea 9, `authClient`, `setTheme`, `Dialog`, `useToast` y `Skeleton`.
- Produces:
  - `<AppShell>`: barra lateral más `<Outlet/>`. Por debajo de 768px la barra se abre con un botón "Menú" (`aria-expanded`) y se cierra con Esc o al elegir un tablero.
  - `<Sidebar>`: workspaces como `<details>` abiertos por defecto, con sus tableros activos (punto de color más nombre, enlace a `/app/b/:id`, `aria-current="page"` en el actual), "+ Tablero", "+ Workspace" y "Archivados".
  - `<UserMenu>`: nombre, selector de tema (Claro / Oscuro / Automático), "Cambiar contraseña" (diálogo con contraseña actual y nueva, vía `authClient.changePassword`) y "Cerrar sesión".
  - Aviso de servidor dormido: mientras alguna consulta está reintentando tras un error con `status: 0` o `>= 500`, un banner `role="status"` muestra "Conectando con el servidor…" y, en una segunda línea, "Si estaba en reposo, puede tardar hasta un minuto en responder.". Si todos los reintentos fallan, se reemplaza por un error con el botón "Reintentar".
  - Los diálogos de crear validan en vivo con `nameSchema`, replicado en el frontend (1 a 100 caracteres). El botón queda deshabilitado mientras la mutación está pendiente. Al crear, se navega al tablero nuevo y aparece el toast "Tablero creado".

- [ ] **Step 1: Write the failing tests** in `layout.test.tsx`:
  - Mientras `useWorkspaces` carga se ve un `Skeleton`.
  - Con datos simulados aparecen "Personal" y sus tableros.
  - **Doble clic en "Crear tablero" envía un solo POST** (Review Focus 4).
  - Tras borrar un workspace, sus tableros desaparecen de la barra sin recargar (Review Focus 5).
  - En un viewport de 375px, "Menú" abre la barra y Esc la cierra.
  - Si `GET /api/workspaces` falla con `status: 0`, se ve "Conectando con el servidor…"; cuando se agotan los reintentos aparece "Reintentar".
- [ ] **Step 2:** `npm test -- layout` → FAIL.
- [ ] **Step 3:** Implementar los archivos.
- [ ] **Step 4:** `npm test` → PASS; revisar en el navegador a 1280px y 375px, en tema claro y oscuro.
- [ ] **Step 5:** Commit: `feat(web): barra lateral con workspaces y tableros`.

---

### Task 11: Páginas de tablero, workspace y archivados

**Files:**
- Create: `frontend/src/boards/{BoardPage,BoardMenu,DeleteConfirmDialog,WorkspacePage,ArchivedPage,NotFoundPage}.tsx`, `frontend/src/boards/TaskList.tsx` (sale de la antigua `App.jsx`), `frontend/src/boards/boards.test.tsx`
- Modify: `frontend/src/router.tsx`

**Interfaces:**
- Consumes: los hooks de la Tarea 9, `Dialog`, `useToast`, `EmptyState`, `SaveStatus` y `Skeleton`.
- Produces:
  - `/app` redirige al primer tablero activo del workspace personal o muestra `EmptyState` con el título "Crea tu primer tablero".
  - `BoardPage`: cabecera "workspace / tablero" y `<BoardMenu>` con Renombrar (edición en el sitio), Color (los 6 colores de la paleta, con nombre visible además del color), Archivar y Eliminar.
  - `TaskList`: la lista actual con estilo de pizarra y resaltador.
  - `DeleteConfirmDialog({ name, onConfirm })`: el botón "Eliminar" solo se habilita cuando el texto escrito coincide exactamente con `name`.
  - Comportamiento al archivar y eliminar:
    - Archivar muestra el toast "Tablero archivado" con "Deshacer" (`PATCH {archived:false}`) y navega a `/app`.
    - Eliminar un tablero navega a `/app` y muestra "Tablero eliminado".
    - Eliminar una tarea la oculta al instante, muestra el toast "Tarea eliminada" con "Deshacer" y envía el `DELETE` a los 5000 ms; si se sale de la página antes, lo envía en `pagehide` con `fetch(..., { keepalive: true })`.
  - Un 404 de `GET /api/boards/:id` muestra `NotFoundPage`, con el texto "Este tablero no existe o no tienes acceso" y un enlace a `/app`.
  - `WorkspacePage` (`/app/w/:id`): tableros activos como lista con su color y acciones de renombrar o eliminar el workspace. Eliminar el workspace personal no aparece.
  - `ArchivedPage` (`/app/archivados`): usa `useArchivedBoards()` y ofrece Restaurar y Eliminar.

- [ ] **Step 1: Write the failing tests** in `boards.test.tsx`:
  - `DeleteConfirmDialog` deshabilita "Eliminar" con "Taller" cuando el nombre es "Taller Render" y lo habilita al escribir el nombre exacto.
  - Con temporizadores falsos: eliminar una tarea **no** envía `DELETE` antes de 5000 ms; pulsar "Deshacer" a los 3000 ms lo cancela y la tarea vuelve; a los 5000 ms sin deshacer se envía una vez.
  - **Archivar el tablero abierto navega a `/app`** (Review Focus 2).
  - Un 404 muestra "Este tablero no existe o no tienes acceso".
  - `/app` sin tableros muestra "Crea tu primer tablero".
- [ ] **Step 2:** `npm test -- boards` → FAIL.
- [ ] **Step 3:** Implementar los archivos.
- [ ] **Step 4:** `npm test && npx tsc --noEmit && npm run build` → PASS. Revisar a mano con la API local: crear, renombrar, cambiar color, archivar, restaurar y eliminar un tablero; agregar, completar y eliminar con deshacer una tarea; todo con teclado (Tab y Enter, y Esc para cerrar diálogos).
- [ ] **Step 5:** Commit: `feat(web): tablero, workspace y archivados con confirmaciones y deshacer`.

---

### Task 12: Prueba de punta a punta y CI

**Files:**
- Create: `frontend/playwright.config.ts`, `frontend/e2e/flujo-basico.spec.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: la app completa en local (API en 3002 con `NODE_ENV=test` sobre `taskboard_test` y Vite en 5173). Playwright levanta ambos con `webServer`.
- Produces:
  - Prueba "registrarse, crear tablero, agregar y completar tarea, cerrar y volver a entrar": registro con un correo único → "+ Tablero" con el nombre "Mi tablero" → agregar "Primera tarea" y completarla → "Cerrar sesión" → iniciar sesión → la tarea aparece en "Hechas".
  - `ci.yml`: en `push` y `pull_request`, un servicio `postgres:16` y estos pasos: instalar `backend` y `frontend` con `npm ci`, migrar `taskboard_test`, y ejecutar `typecheck`, `lint` y `test` en ambos, más `npx playwright install --with-deps chromium && npx playwright test`.

- [ ] **Step 1:** Escribir `flujo-basico.spec.ts`.
- [ ] **Step 2:** `npx playwright test` → PASS en local.
- [ ] **Step 3:** Escribir `ci.yml`, hacer push de la rama `fase-1` y verificar con `gh run watch` (o en la pestaña Actions) que el workflow termina en verde.
- [ ] **Step 4:** Commit: `test: prueba e2e y CI en GitHub Actions`.

---

### Task 13: Configuración de despliegue y documentación

**Files:**
- Modify: `render.yaml`, `README.md`, `backend/.env.example`

**Interfaces:**
- Produces:
  - `render.yaml`:
    - **API**: `buildCommand: npm ci && npm run build`, `startCommand: npm run start:prod` y las variables `BETTER_AUTH_SECRET` (`generateValue: true`), `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` y `EMAIL_FROM` (`sync: false`), además de `NODE_ENV=production`, `DATABASE_URL` y `DB_SSL=false`.
    - **Static Site**: `routes` con, en este orden, `rewrite /api/*` → `https://<api>.onrender.com/api/*` y `rewrite /*` → `/index.html`. Se eliminan `VITE_API_URL` y `FRONTEND_URL`.
  - `README.md` actualizado con:
    - arquitectura v2 y diagrama de mismo origen;
    - cómo correrlo en local (Docker, `npm run migrate`, `npm run dev` en ambos);
    - variables de entorno;
    - pasos para crear el cliente OAuth de Google (URI de redirección `${APP_URL}/api/auth/callback/google`) y la cuenta de Resend;
    - una nota que indique que la entrega del taller está en la etiqueta `v1-taller`.

- [ ] **Step 1:** Escribir los cambios.
- [ ] **Step 2:** Validar el Blueprint en el panel de Render ("New → Blueprint" muestra el plan sin errores) **o**, si el usuario prefiere configurarlo a mano, comprobar que el README lista cada valor.
- [ ] **Step 3:** Commit: `docs: despliegue v2 en Render y README`.
- [ ] **Step 4: Verificación en producción**, después de que el usuario cree las cuentas de Google y Resend y configure Render:
  - `https://<static>/api/health` → `{"status":"ok"}` (comprueba que la reescritura funciona);
  - registrarse con correo y con Google;
  - recibir el correo de recuperación;
  - crear, archivar, restaurar y eliminar un tablero;
  - desde otra cuenta, un enlace `/app/b/<id>` ajeno muestra "no existe o no tienes acceso".

  Si la reescritura no reenvía `Set-Cookie`, detenerse y avisar al usuario antes de cambiar la arquitectura.
- [ ] **Step 5:** Abrir un pull request de `fase-1` a `main` con el resumen y las evidencias.
