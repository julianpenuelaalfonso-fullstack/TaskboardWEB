const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");
const { requireAuth } = require("./middleware/auth");
const { ah } = require("./lib/http");

const app = express();
app.use(express.json({ limit: "1mb" }));

// CORS: solo el origen del frontend (se pueden separar varios con comas)
const origins = (process.env.FRONTEND_URL || "").split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : false }));

// Health check para Render
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Rutas públicas de autenticación
const auth = require("./routes/auth");
app.use("/api/auth", auth.router);

// A partir de aquí todo requiere sesión
app.use("/api", requireAuth);

// Catálogos para los formularios
app.get("/api/meta", ah(async (req, res) => {
  const [statuses, priorities, roles] = await Promise.all([
    pool.query("SELECT id, name, is_closed FROM statuses ORDER BY sort_order"),
    pool.query("SELECT id, name FROM priorities ORDER BY sort_order"),
    pool.query("SELECT id, name, description FROM roles ORDER BY CASE id WHEN 'superadmin' THEN 1 WHEN 'admin' THEN 2 WHEN 'gerente' THEN 3 WHEN 'lider' THEN 4 WHEN 'colaborador' THEN 5 ELSE 6 END")
  ]);
  res.json({ statuses: statuses.rows, priorities: priorities.rows, roles: roles.rows });
}));

app.use("/api/users", require("./routes/users"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/tasks", require("./routes/tasks"));

app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada." }));

// Manejador central de errores
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "El cuerpo de la petición no es JSON válido." });
  console.error(err);
  res.status(500).json({ error: "Ocurrió un error inesperado en el servidor." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API escuchando en el puerto ${PORT}`));
