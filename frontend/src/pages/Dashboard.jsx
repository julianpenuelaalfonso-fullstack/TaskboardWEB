import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, Printer, LoaderCircle, X } from "lucide-react";
import { api, downloadFile } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { toISO, addDays, todayISO, parseDate, formatDate } from "../lib/format";
import { PageHeader, ErrorBox, Loading, Empty, Avatar } from "../components/ui";

const fmtHours = (n) => (Number(n) || 0).toLocaleString("es-CO", { maximumFractionDigits: 1 });

function quickRanges() {
  const t = parseDate(todayISO());
  const monthStart = new Date(t.getFullYear(), t.getMonth(), 1);
  const monthEnd = new Date(t.getFullYear(), t.getMonth() + 1, 0);
  return [
    { id: "mes", label: "Este mes", from: toISO(monthStart), to: toISO(monthEnd) },
    { id: "30", label: "Últimos 30 días", from: toISO(addDays(t, -30)), to: toISO(t) },
    { id: "prox", label: "Próximos 30 días", from: toISO(t), to: toISO(addDays(t, 30)) }
  ];
}

// Barra de porcentaje horizontal (una sola serie, el número va al lado en texto)
function Meter({ value, label }) {
  return (
    <span className="meter-row">
      <span className="hbar" role="img" aria-label={`${label}: ${value} %`}>
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <strong>{value} %</strong>
    </span>
  );
}

// RF-080 a RF-090: indicadores, avance y estadísticas, con filtros y exportación
export default function Dashboard() {
  const { user, permissions } = useAuth();
  const notify = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ from: "", to: "", department_id: "", project_id: "" });
  const [exporting, setExporting] = useState(false);
  const [hover, setHover] = useState(null);

  const qs = () => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && q.set(k, v));
    return q.toString();
  };

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api(`/dashboard?${qs()}`));
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([api("/departments"), api("/projects")]).then(([d, p]) => { setDepartments(d); setProjects(p); }).catch(() => {});
  }, []);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const active = Object.values(filters).some(Boolean);
  const ranges = quickRanges();
  const activeRange = ranges.find((r) => r.from === filters.from && r.to === filters.to)?.id;

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadFile(`/dashboard/export.xlsx?${qs()}`, "taskboard-reporte.xlsx");
      notify("Reporte en Excel descargado.");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const t = data?.totals;
  const statusTotal = data ? data.by_status.reduce((a, s) => a + s.count, 0) : 0;
  const filterSummary = [
    filters.from || filters.to ? `Vencimiento: ${filters.from ? formatDate(filters.from, { day: "numeric", month: "short", year: "numeric" }) : "inicio"} – ${filters.to ? formatDate(filters.to, { day: "numeric", month: "short", year: "numeric" }) : "hoy en adelante"}` : "Todas las fechas",
    filters.department_id ? departments.find((d) => String(d.id) === filters.department_id)?.name : null,
    filters.project_id ? projects.find((p) => String(p.id) === filters.project_id)?.name : null
  ].filter(Boolean).join(" · ");

  return (
    <div className="page page-wide dashboard">
      <PageHeader
        title="Dashboard"
        description={permissions.viewAll ? "Indicadores de todas las tareas de la empresa." : "Indicadores de las tareas de tus proyectos."}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={exportExcel} disabled={exporting || !data}>
              {exporting ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : <FileSpreadsheet size={18} aria-hidden="true" />}
              Excel
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => window.print()} disabled={!data}>
              <Printer size={18} aria-hidden="true" /> PDF
            </button>
          </>
        }
      />

      <p className="print-only print-meta">
        Generado el {new Date().toLocaleString("es-CO")} por {user.name} · {filterSummary}
      </p>

      <div className="filters-bar dash-filters">
        <div className="segmented" role="group" aria-label="Rango rápido">
          {ranges.map((r) => (
            <button key={r.id} type="button" aria-pressed={activeRange === r.id}
              onClick={() => setFilters((f) => ({ ...f, from: r.from, to: r.to }))}>{r.label}</button>
          ))}
        </div>
        <label className="date-field">
          <span>Vence desde</span>
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={set("from")} />
        </label>
        <label className="date-field">
          <span>hasta</span>
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={set("to")} />
        </label>
        <label className="sr-only" htmlFor="d-dep">Departamento</label>
        <select id="d-dep" value={filters.department_id} onChange={set("department_id")}>
          <option value="">Todos los departamentos</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="d-proj">Proyecto</label>
        <select id="d-proj" value={filters.project_id} onChange={set("project_id")}>
          <option value="">Todos los proyectos</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {active && (
          <button type="button" className="link-btn" onClick={() => setFilters({ from: "", to: "", department_id: "", project_id: "" })}>
            <X size={15} aria-hidden="true" /> Limpiar
          </button>
        )}
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!data && !error && <Loading text="Calculando indicadores..." />}

      {data && t.total === 0 && (
        <Empty title="No hay tareas con estos filtros">Amplía el rango de fechas o quita algún filtro.</Empty>
      )}

      {data && t.total > 0 && (
        <>
          {/* RF-080 a RF-085 */}
          <section className="stats" aria-label="Indicadores generales">
            <div className="stat"><span className="stat-label">Total de tareas</span><strong>{t.total}</strong></div>
            <div className="stat"><span className="stat-label">Pendientes</span><strong>{t.pending}</strong></div>
            <div className="stat"><span className="stat-label">En progreso</span><strong>{t.in_progress}</strong>
              {t.in_review > 0 && <span className="stat-sub">+ {t.in_review} en revisión</span>}</div>
            <div className="stat"><span className="stat-label">Finalizadas</span><strong>{t.done}</strong></div>
            <div className={`stat${t.overdue ? " stat-alert" : ""}`}><span className="stat-label">Vencidas</span><strong>{t.overdue}</strong></div>
            <div className="stat stat-accent"><span className="stat-label">Cumplimiento</span><strong>{t.completion} %</strong>
              <span className="stat-sub">finalizadas sobre no canceladas</span></div>
          </section>

          {/* Distribución por estado: barra apilada con leyenda numerada (sirve de tabla) */}
          <section className="panel dash-panel">
            <h2>Tareas por estado</h2>
            <div className="stack" role="img" aria-label={data.by_status.map((s) => `${s.name}: ${s.count}`).join(", ")}
              onMouseLeave={() => setHover(null)}>
              {data.by_status.filter((s) => s.count > 0).map((s) => (
                <span key={s.id} className={`seg st-${s.id}`} style={{ flexGrow: s.count }}
                  onMouseEnter={() => setHover(s)} onMouseMove={() => setHover(s)} />
              ))}
              {hover && (
                <span className="stack-tip" role="status">
                  <strong>{hover.name}</strong> {hover.count} {hover.count === 1 ? "tarea" : "tareas"} · {Math.round((100 * hover.count) / statusTotal)} %
                </span>
              )}
            </div>
            <ul className="stack-legend">
              {data.by_status.map((s) => (
                <li key={s.id} className={s.count === 0 ? "is-zero" : ""}>
                  <span className={`key st-${s.id}`} aria-hidden="true" />
                  <span className="lg-name">{s.name}</span>
                  <strong>{s.count}</strong>
                  <span className="lg-pct">{statusTotal ? Math.round((100 * s.count) / statusTotal) : 0} %</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="dash-grid">
            {/* RF-086 */}
            <section className="panel dash-panel">
              <h2>Avance por proyecto</h2>
              <ul className="proj-progress">
                {data.projects.map((p) => (
                  <li key={p.id}>
                    <div className="pp-head">
                      <a href={`#/tablero?proyecto=${p.id}`}>{p.name}</a>
                      {p.overdue > 0 && <span className="chip chip-overdue">{p.overdue} vencidas</span>}
                    </div>
                    <Meter value={p.progress} label={`Avance de ${p.name}`} />
                    <p className="pp-sub">{p.done} de {p.total - p.cancelled} tareas finalizadas{p.end_date ? ` · termina el ${formatDate(p.end_date, { day: "numeric", month: "short", year: "numeric" })}` : ""}</p>
                  </li>
                ))}
              </ul>
            </section>

            {/* RF-087 */}
            <section className="panel dash-panel">
              <h2>Por departamento</h2>
              <div className="table-wrap flat">
                <table className="table">
                  <thead><tr><th scope="col">Departamento</th><th scope="col" className="num">Abiertas</th><th scope="col" className="num">Vencidas</th><th scope="col">Cumplimiento</th></tr></thead>
                  <tbody>
                    {data.departments.map((d) => (
                      <tr key={d.name}>
                        <td>{d.name}<small className="cell-sub">{d.total} tareas · {d.done} finalizadas</small></td>
                        <td className="num">{d.open}</td>
                        <td className={`num${d.overdue ? " txt-danger" : ""}`}>{d.overdue}</td>
                        <td><Meter value={d.completion} label={`Cumplimiento de ${d.name}`} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* RF-088 */}
          <section className="panel dash-panel">
            <h2>Por colaborador</h2>
            <p className="muted panel-note">Una tarea con varios responsables cuenta para cada uno. Úsalo para ver la carga de trabajo, no como medida aislada del desempeño.</p>
            <div className="table-wrap flat">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Colaborador</th><th scope="col" className="num">Asignadas</th><th scope="col" className="num">En curso</th>
                    <th scope="col" className="num">Finalizadas</th><th scope="col" className="num">Vencidas</th>
                    <th scope="col" className="num">Horas (real / est.)</th><th scope="col">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.collaborators.map((c) => (
                    <tr key={c.id}>
                      <td><span className="cell-person"><Avatar name={c.name} size="sm" /><span>{c.name}<small className="cell-sub">{c.department}</small></span></span></td>
                      <td className="num">{c.total}</td>
                      <td className="num">{c.in_progress}</td>
                      <td className="num">{c.done}</td>
                      <td className={`num${c.overdue ? " txt-danger" : ""}`}>{c.overdue}</td>
                      <td className="num">{fmtHours(c.actual_hours)} / {fmtHours(c.estimated_hours)}</td>
                      <td><Meter value={c.completion} label={`Cumplimiento de ${c.name}`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
