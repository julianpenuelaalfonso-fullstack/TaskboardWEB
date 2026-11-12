// Crea las tablas y carga datos de ejemplo (solo si la base está vacía).
// Uso: npm run db:init
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const pool = require("./db");

const DEMO_PASSWORD = "Innova2026*";

async function main() {
  const client = await pool.connect();
  try {
    // La versión anterior del taller tenía una tabla "tasks" simple (con columna "done").
    // Si existe, se elimina para crear el modelo empresarial.
    const old = await client.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'done'"
    );
    if (old.rowCount > 0) {
      await client.query("DROP TABLE tasks CASCADE");
      console.log("Tabla tasks anterior eliminada (versión simple del taller).");
    }

    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await client.query(sql);
    console.log("Esquema listo.");

    const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM users");
    if (rows[0].n > 0) {
      console.log("Ya hay usuarios; no se cargan datos de ejemplo.");
      return;
    }

    await client.query("BEGIN");
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

    const depNames = [
      ["Gerencia", "Dirección general de la empresa."],
      ["Desarrollo", "Construcción y mantenimiento de software."],
      ["Diseño", "Experiencia de usuario e identidad visual."],
      ["Marketing", "Comunicación, campañas y posicionamiento."],
      ["Recursos Humanos", "Gestión del talento y bienestar."],
      ["Administración", "Finanzas, compras y procesos internos."],
      ["Soporte técnico", "Atención y solución de incidentes a clientes."]
    ];
    const dep = {};
    for (const [name, description] of depNames) {
      const r = await client.query(
        "INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING id",
        [name, description]
      );
      dep[name] = r.rows[0].id;
    }

    const people = [
      ["Laura Gómez", "admin@innova.com", "admin", "Administración", "Administradora de la plataforma"],
      ["Andrés Rojas", "gerente@innova.com", "gerente", "Gerencia", "Gerente general"],
      ["Camila Torres", "lider@innova.com", "lider", "Desarrollo", "Líder de desarrollo"],
      ["Julián Pérez", "colaborador@innova.com", "colaborador", "Desarrollo", "Desarrollador full stack"],
      ["Valentina Ruiz", "valentina@innova.com", "colaborador", "Desarrollo", "Desarrolladora frontend"],
      ["Mateo Herrera", "disenio@innova.com", "lider", "Diseño", "Líder de diseño"],
      ["Sofía Castro", "invitado@innova.com", "invitado", null, "Consultora externa"]
    ];
    const u = {};
    for (const [name, email, role, depName, position] of people) {
      const r = await client.query(
        `INSERT INTO users (name, email, password_hash, role_id, department_id, position)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [name, email, hash, role, depName ? dep[depName] : null, position]
      );
      u[email] = r.rows[0].id;
    }

    await client.query("UPDATE departments SET leader_id = $1 WHERE id = $2", [u["gerente@innova.com"], dep["Gerencia"]]);
    await client.query("UPDATE departments SET leader_id = $1 WHERE id = $2", [u["lider@innova.com"], dep["Desarrollo"]]);
    await client.query("UPDATE departments SET leader_id = $1 WHERE id = $2", [u["disenio@innova.com"], dep["Diseño"]]);
    await client.query("UPDATE departments SET leader_id = $1 WHERE id = $2", [u["admin@innova.com"], dep["Administración"]]);

    const p = await client.query(
      `INSERT INTO projects (name, description, objectives, department_id, leader_id, priority_id,
                             start_date, end_date, requires_approval, created_by)
       VALUES ($1, $2, $3, $4, $5, 'alta', CURRENT_DATE - 20, CURRENT_DATE + 40, true, $5) RETURNING id`,
      [
        "Portal de clientes",
        "Plataforma web para que los clientes consulten sus servicios y abran solicitudes de soporte.",
        "Reducir en 30 % las solicitudes por correo y centralizar la atención.",
        dep["Desarrollo"],
        u["lider@innova.com"]
      ]
    );
    const projectId = p.rows[0].id;
    for (const email of ["colaborador@innova.com", "valentina@innova.com", "disenio@innova.com", "invitado@innova.com"]) {
      await client.query("INSERT INTO project_members VALUES ($1, $2)", [projectId, u[email]]);
    }

    const tasks = [
      ["Definir requerimientos del portal", "Reunión con soporte para listar las solicitudes más frecuentes.", "finalizada", "alta", -18, -10, ["colaborador@innova.com"], ["análisis"], 8, 7],
      ["Diseñar el flujo de inicio de sesión", "Prototipo en Figma del login y la recuperación de contraseña.", "en_revision", "media", -8, 2, ["valentina@innova.com"], ["diseño", "ux"], 6, 5],
      ["Implementar API de solicitudes", "Endpoints REST para crear y consultar solicitudes de soporte.", "en_progreso", "alta", -5, 6, ["colaborador@innova.com", "valentina@innova.com"], ["backend"], 16, 9],
      ["Configurar base de datos de pruebas", "Crear la instancia de pruebas y cargar datos ficticios.", "en_progreso", "urgente", -10, -2, ["colaborador@innova.com"], ["infraestructura"], 4, 3],
      ["Redactar textos de la página de ayuda", "Preguntas frecuentes y guías cortas para clientes.", "pendiente", "baja", null, 15, ["valentina@innova.com"], ["contenido"], 5, null],
      ["Integración con el sistema de facturación", "Esperando credenciales del proveedor externo.", "en_espera", "media", -3, 12, ["colaborador@innova.com"], ["integración"], 10, null],
      ["Pruebas de usabilidad", "Sesiones con 5 clientes para validar el prototipo.", "por_iniciar", "media", 3, 20, ["disenio@innova.com"], ["ux"], 12, null]
    ];
    for (const [title, description, status, priority, startOffset, dueOffset, assignees, tags, est, real] of tasks) {
      const t = await client.query(
        `INSERT INTO tasks (project_id, title, description, status_id, priority_id, start_date, due_date,
                            estimated_hours, actual_hours, tags, created_by)
         VALUES ($1, $2, $3, $4, $5,
                 CASE WHEN $6::int IS NULL THEN NULL ELSE CURRENT_DATE + $6::int END,
                 CURRENT_DATE + $7::int, $8, $9, $10, $11) RETURNING id`,
        [projectId, title, description, status, priority, startOffset, dueOffset, est, real, tags, u["lider@innova.com"]]
      );
      const taskId = t.rows[0].id;
      for (const email of assignees) {
        await client.query("INSERT INTO task_assignees VALUES ($1, $2)", [taskId, u[email]]);
      }
      await client.query(
        "INSERT INTO task_history (task_id, user_id, action, detail) VALUES ($1, $2, 'creada', 'Tarea creada')",
        [taskId, u["lider@innova.com"]]
      );
      if (title === "Implementar API de solicitudes") {
        await client.query(
          "INSERT INTO subtasks (task_id, title, done) VALUES ($1, 'Modelo de datos', true), ($1, 'Endpoint POST /solicitudes', true), ($1, 'Endpoint GET /solicitudes', false), ($1, 'Pruebas con Postman', false)",
          [taskId]
        );
      }
    }

    await client.query("COMMIT");
    console.log("Datos de ejemplo cargados.");
    console.log(`Usuarios de prueba (contraseña: ${DEMO_PASSWORD}):`);
    for (const [name, email, role] of people) console.log(`  ${role.padEnd(12)} ${email}  (${name})`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error inicializando la base de datos:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
