const jwt = require("jsonwebtoken");
const pool = require("../db");

const SECRET = process.env.JWT_SECRET || "cambia-este-secreto-en-produccion";

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role_id }, SECRET, { expiresIn: "8h" });
}

// Verifica el token y carga el usuario actual. Rechaza usuarios inactivos (RN-001, RN-010).
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Debes iniciar sesión." });
  try {
    const payload = jwt.verify(token, SECRET);
    const { rows } = await pool.query(
      "SELECT id, name, email, role_id, department_id, active FROM users WHERE id = $1",
      [payload.id]
    );
    const user = rows[0];
    if (!user || !user.active) {
      return res.status(401).json({ error: "Tu cuenta no está activa. Contacta al administrador." });
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Tu sesión expiró. Inicia sesión de nuevo." });
  }
}

// Permite el paso solo a los roles indicados (RF-015, RNF-002)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role_id)) {
      return res.status(403).json({ error: "No tienes permiso para realizar esta acción." });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole };
