const { Pool, types } = require("pg");
require("dotenv").config();

// Las columnas DATE se devuelven como texto "AAAA-MM-DD" para evitar desfases de zona horaria
types.setTypeParser(1082, (value) => value);
// NUMERIC como número
types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  // Fechas y vencimientos calculados con la hora de Colombia
  options: "-c timezone=America/Bogota"
});

module.exports = pool;
