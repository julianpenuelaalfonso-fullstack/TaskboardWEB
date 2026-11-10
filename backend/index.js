const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
});

// Mismo script de la guía; se ejecuta al arrancar para no depender de un cliente SQL.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  done BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);`;

// Devuelve el id como entero positivo, o null si no es válido.
const parseId = (value) => (/^\d+$/.test(value) ? Number(value) : null);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.get("/api/tasks", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM tasks ORDER BY id");
  res.json(rows);
});

app.post("/api/tasks", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) return res.status(400).json({ error: "El título es obligatorio" });
  if (title.length > 200) return res.status(400).json({ error: "El título admite máximo 200 caracteres" });
  const { rows } = await pool.query(
    "INSERT INTO tasks (title) VALUES ($1) RETURNING *", [title]);
  res.status(201).json(rows[0]);
});

app.patch("/api/tasks/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Id inválido" });
  const { done } = req.body ?? {};
  if (typeof done !== "boolean") return res.status(400).json({ error: "El campo done debe ser true o false" });
  const { rows } = await pool.query(
    "UPDATE tasks SET done = $1 WHERE id = $2 RETURNING *", [done, id]);
  if (rows.length === 0) return res.status(404).json({ error: "Tarea no encontrada" });
  res.json(rows[0]);
});

app.delete("/api/tasks/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Id inválido" });
  const { rowCount } = await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
  if (rowCount === 0) return res.status(404).json({ error: "Tarea no encontrada" });
  res.status(204).end();
});

// Express 5 envía aquí los errores de las rutas async (por ejemplo, la BD caída).
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido" });
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API escuchando en el puerto ${PORT}`));

pool.query(SCHEMA)
  .then(() => console.log("Tabla tasks lista"))
  .catch((err) => console.error("No se pudo preparar la base de datos:", err.message));
