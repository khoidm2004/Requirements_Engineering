import { DatabaseSync } from 'node:sqlite';

export type DB = DatabaseSync;

/**
 * Schema. Spec B: "All data should be kept so we can analyse it later" — results keep every
 * answer (with timing), and exercises are archived instead of deleted.
 */
const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS teachers (
  id             INTEGER PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at  TEXT
);

CREATE TABLE IF NOT EXISTS classes (
  id          INTEGER PRIMARY KEY,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Students are added manually by the teacher (req 3) and log in with number + name (req 4).
CREATE TABLE IF NOT EXISTS students (
  id              INTEGER PRIMARY KEY,
  class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  student_number  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  points          INTEGER NOT NULL DEFAULT 0,
  settings        TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at   TEXT
);

CREATE TABLE IF NOT EXISTS levels (
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  level       INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  PRIMARY KEY (student_id, type)
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  teacher_id  INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
  student_id  INTEGER REFERENCES students(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL
);

-- teacher_id NULL = shared exercise that comes with the app (req 17).
CREATE TABLE IF NOT EXISTS exercises (
  id          INTEGER PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('letters','words','sentences','pictures','stories')),
  level       INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  teacher_id  INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignments (
  id           INTEGER PRIMARY KEY,
  class_id     INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  student_id   INTEGER REFERENCES students(id) ON DELETE CASCADE,  -- NULL = whole class
  due_date     TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS results (
  id             INTEGER PRIMARY KEY,
  student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exercise_id    INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  assignment_id  INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
  type           TEXT NOT NULL,
  level          INTEGER NOT NULL,
  correct        INTEGER NOT NULL,
  total          INTEGER NOT NULL,
  points         INTEGER NOT NULL,
  duration_ms    INTEGER NOT NULL,
  answers        TEXT NOT NULL,
  completed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Teacher-uploaded pictures for sentence–picture exercises (req 5).
CREATE TABLE IF NOT EXISTS images (
  id          INTEGER PRIMARY KEY,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  file        TEXT NOT NULL,
  mime        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Kids' read-aloud recordings, kept for teachers to listen to later (req 13).
CREATE TABLE IF NOT EXISTS recordings (
  id           INTEGER PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exercise_id  INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  file         TEXT NOT NULL,
  mime         TEXT NOT NULL,
  duration_ms  INTEGER NOT NULL,
  listened_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS results_student ON results(student_id, completed_at);
CREATE INDEX IF NOT EXISTS recordings_student ON recordings(student_id);
CREATE INDEX IF NOT EXISTS students_class ON students(class_id);
`;

export function openDb(path = ':memory:'): DB {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
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
