// RF-080 a RF-090: dashboard e informes
const express = require("express");
const ExcelJS = require("exceljs");
const pool = require("../db");
const { ah, HttpError, isDate } = require("../lib/http");
const P = require("../lib/permissions");

const router = express.Router();

const CLOSED = "('finalizada','cancelada')";

// Tareas visibles para el usuario con los filtros del dashboard (RF-089)
function scope(user, query) {
  const params = [];
  const where = ["NOT t.archived"];
  if (!P.canViewAll(user)) {
    params.push(user.id);
    const me = `$${params.length}`;
    where.push(`(p.leader_id = ${me}
      OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = ${me})
      OR EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = ${me}))`);
  }
  if (query.from) {
    if (!isDate(query.from)) throw new HttpError(400, "La fecha inicial no es válida.");
    params.push(query.from);
    where.push(`t.due_date >= $${params.length}`);
  }
  if (query.to) {
    if (!isDate(query.to)) throw new HttpError(400, "La fecha final no es válida.");
    params.push(query.to);
    where.push(`t.due_date <= $${params.length}`);
  }
  if (query.department_id) {
    params.push(Number(query.department_id));
    where.push(`p.department_id = $${params.length}`);
  }
  if (query.project_id) {
    params.push(Number(query.project_id));
    where.push(`t.project_id = $${params.length}`);
  }
  return { params, sql: `FROM tasks t JOIN projects p ON p.id = t.project_id WHERE ${where.join(" AND ")}` };
}

// Porcentaje de cumplimiento = finalizadas / (total − canceladas)
const pct = (done, total, cancelled = 0) => {
  const base = total - cancelled;
  return base > 0 ? Math.round((100 * done) / base) : 0;
};

async function buildDashboard(user, query) {
  const { params, sql } = scope(user, query);

  const [totals, byStatus, projects, departments, people] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE t.status_id IN ('pendiente','por_iniciar'))::int AS pending,
              COUNT(*) FILTER (WHERE t.status_id = 'en_progreso')::int AS in_progress,
              COUNT(*) FILTER (WHERE t.status_id = 'en_revision')::int AS in_review,
              COUNT(*) FILTER (WHERE t.status_id = 'finalizada')::int AS done,
              COUNT(*) FILTER (WHERE t.status_id = 'cancelada')::int AS cancelled,
              COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status_id NOT IN ${CLOSED})::int AS overdue,
              COALESCE(SUM(t.estimated_hours), 0)::float AS estimated_hours,
              COALESCE(SUM(t.actual_hours), 0)::float AS actual_hours
       ${sql}`,
      params
    ),
    pool.query(
      `SELECT s.id, s.name, COUNT(t.id)::int AS count
       FROM statuses s LEFT JOIN (SELECT t.id, t.status_id ${sql}) t ON t.status_id = s.id
       GROUP BY s.id, s.name, s.sort_order ORDER BY s.sort_order`,
      params
    ),
    pool.query(
      `SELECT p.id, p.name, p.end_date, p.archived,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE t.status_id = 'finalizada')::int AS done,
              COUNT(*) FILTER (WHERE t.status_id = 'cancelada')::int AS cancelled,
              COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status_id NOT IN ${CLOSED})::int AS overdue
       ${sql} GROUP BY p.id ORDER BY p.name`,
      params
    ),
    pool.query(
      `SELECT COALESCE(d.name, 'Sin departamento') AS name,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE t.status_id = 'finalizada')::int AS done,
              COUNT(*) FILTER (WHERE t.status_id = 'cancelada')::int AS cancelled,
              COUNT(*) FILTER (WHERE t.status_id NOT IN ${CLOSED})::int AS open,
              COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status_id NOT IN ${CLOSED})::int AS overdue
       ${sql.replace("WHERE", "LEFT JOIN departments d ON d.id = p.department_id WHERE")}
       GROUP BY d.name ORDER BY total DESC, name`,
      params
    ),
    pool.query(
      `SELECT u.id, u.name, COALESCE(d.name, '—') AS department,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE t.status_id = 'finalizada')::int AS done,
              COUNT(*) FILTER (WHERE t.status_id = 'cancelada')::int AS cancelled,
              COUNT(*) FILTER (WHERE t.status_id IN ('en_progreso','en_revision'))::int AS in_progress,
              COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status_id NOT IN ${CLOSED})::int AS overdue,
              COALESCE(SUM(t.estimated_hours), 0)::float AS estimated_hours,
              COALESCE(SUM(t.actual_hours), 0)::float AS actual_hours
       ${sql.replace("WHERE", "JOIN task_assignees a2 ON a2.task_id = t.id JOIN users u ON u.id = a2.user_id LEFT JOIN departments d ON d.id = u.department_id WHERE")}
       GROUP BY u.id, u.name, d.name ORDER BY total DESC, u.name`,
      params
    )
  ]);

  const t = totals.rows[0];
  return {
    filters: { from: query.from || null, to: query.to || null, department_id: query.department_id || null, project_id: query.project_id || null },
    totals: { ...t, completion: pct(t.done, t.total, t.cancelled) },
    by_status: byStatus.rows,
    projects: projects.rows.map((r) => ({ ...r, progress: pct(r.done, r.total, r.cancelled) })),
    departments: departments.rows.map((r) => ({ ...r, completion: pct(r.done, r.total, r.cancelled) })),
    collaborators: people.rows.map((r) => ({ ...r, completion: pct(r.done, r.total, r.cancelled) }))
  };
}

router.get("/", ah(async (req, res) => {
  res.json(await buildDashboard(req.user, req.query));
}));

// RF-090: exportar a Excel (el PDF se genera desde el navegador con una vista de impresión)
router.get("/export.xlsx", ah(async (req, res) => {
  const data = await buildDashboard(req.user, req.query);
  const { params, sql } = scope(req.user, req.query);
  const detail = await pool.query(
    `SELECT t.id, p.name AS project, t.title, s.name AS status, pr.name AS priority, t.start_date, t.due_date,
            (t.due_date < CURRENT_DATE AND t.status_id NOT IN ${CLOSED}) AS overdue,
            (SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM task_assignees a JOIN users u ON u.id = a.user_id WHERE a.task_id = t.id) AS assignees,
            t.estimated_hours, t.actual_hours
     ${sql.replace("WHERE", "JOIN statuses s ON s.id = t.status_id JOIN priorities pr ON pr.id = t.priority_id WHERE")}
     ORDER BY t.due_date, t.id`,
    params
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "TaskBoard";
  wb.created = new Date();
  const head = { font: { bold: true, color: { argb: "FFFFFFFF" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF15322B" } } };

  const sheet = (name, columns, rows) => {
    const ws = wb.addWorksheet(name);
    ws.columns = columns;
    ws.getRow(1).eachCell((c) => { c.font = head.font; c.fill = head.fill; });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    rows.forEach((r) => ws.addRow(r));
    return ws;
  };

  const f = data.filters;
  const resumen = sheet("Resumen", [{ header: "Indicador", key: "k", width: 34 }, { header: "Valor", key: "v", width: 18 }], [
    { k: "Generado", v: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }) },
    { k: "Generado por", v: req.user.name },
    { k: "Vencimiento desde", v: f.from || "Sin límite" },
    { k: "Vencimiento hasta", v: f.to || "Sin límite" },
    { k: "Total de tareas", v: data.totals.total },
    { k: "Pendientes (pendiente y por iniciar)", v: data.totals.pending },
    { k: "En progreso", v: data.totals.in_progress },
    { k: "En revisión", v: data.totals.in_review },
    { k: "Finalizadas", v: data.totals.done },
    { k: "Canceladas", v: data.totals.cancelled },
    { k: "Vencidas", v: data.totals.overdue },
    { k: "Cumplimiento (%)", v: data.totals.completion },
    { k: "Horas estimadas", v: data.totals.estimated_hours },
    { k: "Horas reales", v: data.totals.actual_hours }
  ]);
  resumen.getColumn("v").alignment = { horizontal: "right" };

  sheet("Por estado", [{ header: "Estado", key: "name", width: 18 }, { header: "Tareas", key: "count", width: 10 }], data.by_status);
  sheet("Proyectos", [
    { header: "Proyecto", key: "name", width: 34 }, { header: "Tareas", key: "total", width: 10 }, { header: "Finalizadas", key: "done", width: 12 },
    { header: "Vencidas", key: "overdue", width: 10 }, { header: "Avance (%)", key: "progress", width: 12 }, { header: "Fecha fin", key: "end_date", width: 14 }
  ], data.projects);
  sheet("Departamentos", [
    { header: "Departamento", key: "name", width: 24 }, { header: "Tareas", key: "total", width: 10 }, { header: "Abiertas", key: "open", width: 10 },
    { header: "Finalizadas", key: "done", width: 12 }, { header: "Vencidas", key: "overdue", width: 10 }, { header: "Cumplimiento (%)", key: "completion", width: 16 }
  ], data.departments);
  sheet("Colaboradores", [
    { header: "Colaborador", key: "name", width: 26 }, { header: "Departamento", key: "department", width: 20 }, { header: "Asignadas", key: "total", width: 11 },
    { header: "En curso", key: "in_progress", width: 10 }, { header: "Finalizadas", key: "done", width: 12 }, { header: "Vencidas", key: "overdue", width: 10 },
    { header: "Horas estimadas", key: "estimated_hours", width: 15 }, { header: "Horas reales", key: "actual_hours", width: 13 }, { header: "Cumplimiento (%)", key: "completion", width: 16 }
  ], data.collaborators);
  sheet("Tareas", [
    { header: "ID", key: "id", width: 7 }, { header: "Proyecto", key: "project", width: 26 }, { header: "Tarea", key: "title", width: 40 },
    { header: "Estado", key: "status", width: 14 }, { header: "Prioridad", key: "priority", width: 11 }, { header: "Inicio", key: "start_date", width: 12 },
    { header: "Vencimiento", key: "due_date", width: 13 }, { header: "Vencida", key: "overdue", width: 9 }, { header: "Responsables", key: "assignees", width: 34 },
    { header: "Horas est.", key: "estimated_hours", width: 10 }, { header: "Horas reales", key: "actual_hours", width: 12 }
  ], detail.rows.map((r) => ({ ...r, overdue: r.overdue ? "Sí" : "No" })));

  const stamp = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }); // AAAA-MM-DD en hora de Colombia
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="taskboard-reporte-${stamp}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}));

module.exports = router;
