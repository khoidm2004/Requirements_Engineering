import { DatabaseSync } from 'node:sqlite';

export type DB = DatabaseSync;

/** Bump when the schema changes incompatibly; an older database file is then refused at start-up. */
export const SCHEMA_VERSION = 2;

/**
 * Schema. Only the personal data listed in DR-01 is stored (NFR-PRV-02).
 * Encryption at rest and EEA hosting (DR-02, C-1) are provided by the hosting volume, see README.
 * E4 picture binaries are NOT stored here — only their image-host references (FR-CNT-05).
 */
const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS teachers (
  id              INTEGER PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tokens (
  token       TEXT PRIMARY KEY,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('verify','reset')),
  expires_at  TEXT NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS classes (
  id          INTEGER PRIMARY KEY,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A student is enrolled in exactly one class by its teacher (FR-ACC-04).
CREATE TABLE IF NOT EXISTS students (
  id                INTEGER PRIMARY KEY,
  class_id          INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_number    TEXT NOT NULL UNIQUE,     -- normalised (trimmed, upper case), A-5
  name              TEXT NOT NULL,
  birth_year        INTEGER NOT NULL,
  language          TEXT NOT NULL CHECK (language IN ('en','fi')),
  settings          TEXT NOT NULL DEFAULT '{}',
  stars             INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at     TEXT,
  inactivity_notified_at TEXT
);

-- FR-ACC-05 / NFR-SEC-06 — failed child logins are counted per typed student number, whether or
-- not that number exists, so a lockout never reveals which numbers are enrolled.
CREATE TABLE IF NOT EXISTS login_attempts (
  student_number  TEXT PRIMARY KEY,
  failed          INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  teacher_id  INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
  student_id  INTEGER REFERENCES students(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('teacher','child')),
  last_seen   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS levels (
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  level       INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  PRIMARY KEY (student_id, type)
);

-- Shared library rows have teacher_id NULL and a seed_key (FR-CNT-03); teacher rows are E5 texts
-- (FR-CNT-02) or single E4 sentence–picture items (FR-CNT-05).
CREATE TABLE IF NOT EXISTS exercises (
  id          INTEGER PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('E1','E2','E3','E4','E5')),
  level       INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  language    TEXT NOT NULL CHECK (language IN ('en','fi')),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  teacher_id  INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
  seed_key    TEXT UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((teacher_id IS NULL) = (seed_key IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS results (
  id            INTEGER PRIMARY KEY,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exercise_id   INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  level         INTEGER NOT NULL,
  items         INTEGER NOT NULL,
  correct       INTEGER NOT NULL,
  duration_s    INTEGER NOT NULL,
  completed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  wcpm          REAL,
  stars         INTEGER NOT NULL,
  client_id     TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS progress (
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  state        TEXT NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (student_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id           INTEGER PRIMARY KEY,
  teacher_id   INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_id     INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  type         TEXT,
  level        INTEGER,
  exercise_id  INTEGER REFERENCES exercises(id) ON DELETE CASCADE,
  due_date     TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignment_targets (
  assignment_id  INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  result_id      INTEGER REFERENCES results(id) ON DELETE SET NULL,
  PRIMARY KEY (assignment_id, student_id)
);

-- Development mail outbox; in production the mailer hands messages to the e-mail service.
CREATE TABLE IF NOT EXISTS outbox (
  id          INTEGER PRIMARY KEY,
  to_addr     TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Records deletions so that backups can be purged within 30 days (DR-04).
CREATE TABLE IF NOT EXISTS deletion_log (
  id          INTEGER PRIMARY KEY,
  subject     TEXT NOT NULL,
  deleted_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function openDb(path = ':memory:'): DB {
  const db = new DatabaseSync(path);
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  const { n: tables } = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get() as { n: number };
  if (tables > 0 && version !== SCHEMA_VERSION) {
    throw new Error(
      `Database ${path} has schema version ${version}, expected ${SCHEMA_VERSION}. ` +
        'It was created by an older ReadBuddy build; delete it (or set DB_PATH to a new file) and restart.',
    );
  }
  db.exec(SCHEMA);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  return db;
}

/** Run fn inside a transaction. */
export function tx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
