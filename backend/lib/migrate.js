// Aplica schema.sql al arrancar el servidor. El esquema es idempotente (IF NOT EXISTS / ON CONFLICT),
// así que las columnas nuevas llegan a la base de Render sin ejecutar db:init a mano.
const fs = require("fs");
const path = require("path");
const pool = require("../db");

module.exports = async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");
  await pool.query(sql);
};
