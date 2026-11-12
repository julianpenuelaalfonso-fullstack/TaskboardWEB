-- ============================================================
-- TaskBoard empresarial · INNOVA SOLUCIONES S.A.S.
-- Esquema de base de datos (PostgreSQL). Es idempotente:
-- se puede ejecutar varias veces sin duplicar nada.
-- ============================================================

-- Roles del sistema (RF-007, RF-010)
CREATE TABLE IF NOT EXISTS roles (
  id          VARCHAR(20) PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  description TEXT
);

-- Departamentos (RF-016 a RF-020)
CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  leader_id   INTEGER,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Usuarios / empleados (RF-001 a RF-009)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,           -- RNF-001: bcrypt
  role_id       VARCHAR(20) NOT NULL REFERENCES roles(id),
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  position      VARCHAR(100),
  phone         VARCHAR(30),
  active        BOOLEAN NOT NULL DEFAULT true,  -- RF-005, RN-010
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE departments
    ADD CONSTRAINT departments_leader_fk FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Recuperación de contraseña (RF-006)
CREATE TABLE IF NOT EXISTS password_resets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(100) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false
);

-- Catálogos: estados y prioridades (sección 7, RF-025, RF-033)
CREATE TABLE IF NOT EXISTS statuses (
  id         VARCHAR(20) PRIMARY KEY,
  name       VARCHAR(40) NOT NULL,
  sort_order INTEGER NOT NULL,
  is_closed  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS priorities (
  id         VARCHAR(20) PRIMARY KEY,
  name       VARCHAR(40) NOT NULL,
  sort_order INTEGER NOT NULL
);

-- Proyectos (RF-021 a RF-029)
CREATE TABLE IF NOT EXISTS projects (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  objectives        TEXT,
  department_id     INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  leader_id         INTEGER NOT NULL REFERENCES users(id),
  priority_id       VARCHAR(20) NOT NULL REFERENCES priorities(id) DEFAULT 'media',
  start_date        DATE,
  end_date          DATE,
  requires_approval BOOLEAN NOT NULL DEFAULT true,  -- RN-007
  archived          BOOLEAN NOT NULL DEFAULT false, -- RF-028, RN-011
  created_by        INTEGER REFERENCES users(id),
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- Participantes de cada proyecto (RF-023)
CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

-- Tareas (RF-030 a RF-044, RN-002 a RN-004)
CREATE TABLE IF NOT EXISTS tasks (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT NOT NULL,
  status_id       VARCHAR(20) NOT NULL REFERENCES statuses(id) DEFAULT 'pendiente',
  priority_id     VARCHAR(20) NOT NULL REFERENCES priorities(id) DEFAULT 'media',
  start_date      DATE,
  due_date        DATE NOT NULL,
  estimated_hours NUMERIC(6,2),
  actual_hours    NUMERIC(6,2),
  tags            TEXT[] NOT NULL DEFAULT '{}',
  archived        BOOLEAN NOT NULL DEFAULT false,
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (start_date IS NULL OR due_date >= start_date),
  CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
  CHECK (actual_hours IS NULL OR actual_hours >= 0)
);

-- Responsables de cada tarea (RF-032)
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

-- Subtareas (RF-036)
CREATE TABLE IF NOT EXISTS subtasks (
  id         SERIAL PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Historial de cambios (RF-044, RF-056, RF-057, RN-009, RN-012)
CREATE TABLE IF NOT EXISTS task_history (
  id         SERIAL PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(40) NOT NULL,
  detail     TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_history_task ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);

-- Datos de catálogo
INSERT INTO roles (id, name, description) VALUES
  ('superadmin', 'Superadministrador', 'Control técnico y configuración global de la plataforma.'),
  ('admin', 'Administrador', 'Gestiona usuarios, departamentos, parámetros y permisos.'),
  ('gerente', 'Gerente', 'Consulta proyectos, resultados e indicadores generales.'),
  ('lider', 'Líder de equipo', 'Crea proyectos y tareas, distribuye trabajo y revisa entregables.'),
  ('colaborador', 'Colaborador', 'Consulta sus tareas, actualiza avances y participa en conversaciones.'),
  ('invitado', 'Invitado', 'Consulta información expresamente autorizada.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO statuses (id, name, sort_order, is_closed) VALUES
  ('pendiente', 'Pendiente', 1, false),
  ('por_iniciar', 'Por iniciar', 2, false),
  ('en_progreso', 'En progreso', 3, false),
  ('en_revision', 'En revisión', 4, false),
  ('en_espera', 'En espera', 5, false),
  ('finalizada', 'Finalizada', 6, true),
  ('cancelada', 'Cancelada', 7, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO priorities (id, name, sort_order) VALUES
  ('baja', 'Baja', 1),
  ('media', 'Media', 2),
  ('alta', 'Alta', 3),
  ('urgente', 'Urgente', 4)
ON CONFLICT (id) DO NOTHING;
