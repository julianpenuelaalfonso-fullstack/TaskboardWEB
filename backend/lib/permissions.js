// Matriz de roles y permisos. Todas las validaciones se hacen en el servidor (RNF-002).
const pool = require("../db");

const ADMINS = ["superadmin", "admin"];
const VIEW_ALL = ["superadmin", "admin", "gerente"];

const isAdmin = (user) => ADMINS.includes(user.role_id);
const canViewAll = (user) => VIEW_ALL.includes(user.role_id);
const canManageUsers = (user) => isAdmin(user);
const canCreateProject = (user) => isAdmin(user) || user.role_id === "lider";

// Permisos globales que el frontend usa para mostrar u ocultar opciones
function permissionsFor(user) {
  return {
    manageUsers: canManageUsers(user),
    manageDepartments: isAdmin(user),
    createProject: canCreateProject(user),
    viewAll: canViewAll(user),
    readOnly: ["gerente", "invitado"].includes(user.role_id)
  };
}

async function getProject(projectId) {
  const { rows } = await pool.query("SELECT * FROM projects WHERE id = $1", [projectId]);
  return rows[0] || null;
}

async function isProjectMember(projectId, userId) {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, userId]
  );
  return rowCount > 0;
}

async function canViewProject(user, project) {
  if (canViewAll(user) || project.leader_id === user.id) return true;
  return isProjectMember(project.id, user.id);
}

// Editar el proyecto y administrar sus tareas: administrador o líder del proyecto (RF-013)
function canManageProject(user, project) {
  return isAdmin(user) || (user.role_id === "lider" && project.leader_id === user.id);
}

async function isTaskAssignee(taskId, userId) {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM task_assignees WHERE task_id = $1 AND user_id = $2",
    [taskId, userId]
  );
  return rowCount > 0;
}

// Actualizar avance: quien administra el proyecto o un responsable de la tarea
// que no sea invitado ni gerente (RF-014, RF-055, RN-006)
async function canWorkOnTask(user, project, taskId) {
  if (canManageProject(user, project)) return true;
  if (["invitado", "gerente"].includes(user.role_id)) return false;
  return isTaskAssignee(taskId, user.id);
}

module.exports = {
  isAdmin,
  canViewAll,
  canManageUsers,
  canCreateProject,
  permissionsFor,
  getProject,
  canViewProject,
  canManageProject,
  canWorkOnTask
};
