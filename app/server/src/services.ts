import type { DB } from './db.js';
import { HttpError, iso, type Ctx } from './context.js';
import {
  DEFAULT_SETTINGS, EXERCISE_TYPES, MAX_ITEMS, type ExerciseType, initialLevel, nextLevel, pickPracticeTypes, starsFor,
} from './domain/rules.js';

const DAY = 86_400_000;

export interface StudentRow {
  id: number;
  class_id: number;
  student_number: string;
  name: string;
  birth_year: number;
  language: 'en' | 'fi';
  stars: number;
}

/** NFR-SEC-04 — a teacher sees only students enrolled in their own classes. */
export function assertStudentAccess(db: DB, teacherId: number, studentId: number): StudentRow {
  const s = db
    .prepare(
      `SELECT s.id, s.class_id, s.student_number, s.name, s.birth_year, s.language, s.stars
       FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ? AND c.teacher_id = ?`,
    )
    .get(studentId, teacherId) as StudentRow | undefined;
  if (!s) throw new HttpError(404, 'student_not_found');
  return s;
}

export function getLevels(db: DB, studentId: number): Record<ExerciseType, number> {
  const rows = db.prepare('SELECT type, level FROM levels WHERE student_id = ?').all(studentId) as Array<{ type: ExerciseType; level: number }>;
  const out = {} as Record<ExerciseType, number>;
  for (const t of EXERCISE_TYPES) out[t] = rows.find((r) => r.type === t)?.level ?? 1;
  return out;
}

/** FR-EX-07 — initial placement by age for all types. */
export function placeStudent(db: DB, studentId: number, birthYear: number, now = new Date()) {
  const lvl = initialLevel(birthYear, now);
  const ins = db.prepare('INSERT OR REPLACE INTO levels (student_id, type, level) VALUES (?, ?, ?)');
  for (const t of EXERCISE_TYPES) ins.run(studentId, t, lvl);
}

export function setLevel(db: DB, studentId: number, type: ExerciseType, level: number) {
  db.prepare('INSERT OR REPLACE INTO levels (student_id, type, level) VALUES (?, ?, ?)').run(studentId, type, level);
}

export function getSettings(db: DB, studentId: number) {
  const row = db.prepare('SELECT settings FROM students WHERE id = ?').get(studentId) as { settings: string };
  return { ...DEFAULT_SETTINGS, ...JSON.parse(row.settings) };
}

/** FR-ACC-05 / FR-ACC-09 — is this student number currently locked out? */
export function lockedUntil(db: DB, studentNumber: string, now: number): string | null {
  const r = db.prepare('SELECT locked_until FROM login_attempts WHERE student_number = ?').get(studentNumber) as
    | { locked_until: string | null }
    | undefined;
  return r?.locked_until && r.locked_until > iso(now) ? r.locked_until : null;
}

/** Accuracies of results at the current level since the last level change (input to FR-EX-06). */
function recentAccuracies(db: DB, studentId: number, type: string, level: number): number[] {
  const rows = db
    .prepare('SELECT level, items, correct FROM results WHERE student_id = ? AND type = ? ORDER BY id DESC LIMIT 10')
    .all(studentId, type) as Array<{ level: number; items: number; correct: number }>;
  const out: number[] = [];
  for (const r of rows) {
    if (r.level !== level) break;
    out.unshift(r.items ? r.correct / r.items : 0);
  }
  return out;
}

// ---------------- Exercise visibility and selection ----------------

/**
 * Exercises a student may open: the shared library, plus texts and E4 items made by the teacher of
 * the student's class (FR-CNT-02, FR-CNT-05). Uses the named parameter $student.
 */
const VISIBLE = `e.active = 1 AND (e.teacher_id IS NULL OR e.teacher_id =
   (SELECT c.teacher_id FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = $student))`;

/** Never-done exercises first (the class teacher's own content before the shared library), then the one done longest ago. */
const LEAST_RECENT = `(SELECT MAX(r.id) FROM results r WHERE r.student_id = $student AND r.exercise_id = e.id) IS NOT NULL,
   e.teacher_id IS NULL,
   (SELECT MAX(r.id) FROM results r WHERE r.student_id = $student AND r.exercise_id = e.id), e.id`;

export function canStudentOpen(db: DB, studentId: number, exerciseId: number): boolean {
  return !!db.prepare(`SELECT 1 FROM exercises e WHERE e.id = $id AND ${VISIBLE}`).get({ $id: exerciseId, $student: studentId });
}

export interface ExerciseRef {
  id: number;
  type: ExerciseType;
  level: number;
  title: string;
}

/**
 * Picks an exercise of `type` for a student.
 *  - E1, E2, E3: shared library at the nearest available level.
 *  - E5: shared passages and the class teacher's texts (FR-CNT-02) at the nearest level.
 *  - E4: teacher items at exactly this level and language; none → not offered (FR-EX-01).
 */
export function pickExercise(db: DB, studentId: number, type: ExerciseType, level: number, language: string): ExerciseRef | undefined {
  const exact = type === 'E4';
  return db
    .prepare(
      `SELECT e.id, e.type, e.level, e.title FROM exercises e
       WHERE e.type = $type AND e.language = $lang AND ${VISIBLE} ${exact ? 'AND e.level = $level' : ''}
       ORDER BY ABS(e.level - $level), e.level > $level, ${LEAST_RECENT}
       LIMIT 1`,
    )
    .get({ $type: type, $lang: language, $level: level, $student: studentId }) as ExerciseRef | undefined;
}

interface E4Stored {
  sentence: string;
  pictures: Array<{ ref: string; url: string; label: string }>; // index 0 is the correct picture
}

/**
 * FR-EX-03 / FR-CNT-05 — an E4 exercise is played as a set of up to 10 teacher sentence–picture
 * items of the same level and language, starting with `leadId`. Picture order is rotated per
 * student and item so the correct picture is not always first, and stays stable on resume.
 */
function buildE4(db: DB, studentId: number, lead: { id: number; level: number; language: string }, savedIds?: unknown) {
  let rows: Array<{ id: number; content: string }>;
  const load = db.prepare(`SELECT e.id, e.content FROM exercises e WHERE e.id = $id AND e.type = 'E4' AND ${VISIBLE}`);
  if (Array.isArray(savedIds) && savedIds.length && savedIds[0] === lead.id) {
    rows = savedIds
      .slice(0, MAX_ITEMS)
      .map((id) => load.get({ $id: Number(id), $student: studentId }) as { id: number; content: string } | undefined)
      .filter((r): r is { id: number; content: string } => !!r);
  } else {
    const others = db
      .prepare(
        `SELECT e.id, e.content FROM exercises e
         WHERE e.type = 'E4' AND e.level = $level AND e.language = $lang AND e.id != $lead AND ${VISIBLE}
         ORDER BY ${LEAST_RECENT} LIMIT ${MAX_ITEMS - 1}`,
      )
      .all({ $level: lead.level, $lang: lead.language, $lead: lead.id, $student: studentId }) as Array<{ id: number; content: string }>;
    rows = [load.get({ $id: lead.id, $student: studentId }) as { id: number; content: string }, ...others];
  }
  const items = rows.map((r) => {
    const c = JSON.parse(r.content) as E4Stored;
    const shift = (r.id + studentId) % 3;
    const pics = [0, 1, 2].map((i) => c.pictures[(i + shift) % 3]);
    return {
      id: r.id,
      sentence: c.sentence,
      pictures: pics.map((p) => ({ url: p.url, label: p.label })),
      answer: pics.indexOf(c.pictures[0]),
    };
  });
  return { items, itemIds: rows.map((r) => r.id) };
}

/** Loads an exercise for a student, with saved progress (FR-EX-08). */
export function loadExerciseForStudent(db: DB, studentId: number, exerciseId: number, now: number, resumeWindowMs: number) {
  if (!canStudentOpen(db, studentId, exerciseId)) throw new HttpError(404, 'exercise_not_found');
  const ex = db.prepare('SELECT id, type, level, language, title, content FROM exercises WHERE id = ?').get(exerciseId) as {
    id: number; type: ExerciseType; level: number; language: string; title: string; content: string;
  };
  const p = db.prepare('SELECT state, updated_at FROM progress WHERE student_id = ? AND exercise_id = ?').get(studentId, exerciseId) as
    | { state: string; updated_at: number }
    | undefined;
  const progress = p && now - p.updated_at < resumeWindowMs ? (JSON.parse(p.state) as Record<string, unknown>) : null;
  const content = ex.type === 'E4' ? buildE4(db, studentId, ex, progress?.itemIds) : JSON.parse(ex.content);
  return { id: ex.id, type: ex.type, level: ex.level, language: ex.language, title: ex.title, content, progress };
}

// ---------------- Results ----------------

export interface ResultInput {
  exerciseId: number;
  items: number;
  correct: number;
  durationS: number;
  clientId?: string;
}

/** FR-PRG-01 record + FR-MOT-01 stars + FR-EX-06 adaptation + assignment completion. */
export function recordResult(db: DB, studentId: number, input: ResultInput, now: number) {
  if (input.clientId) {
    const dup = db.prepare('SELECT stars FROM results WHERE client_id = ? AND student_id = ?').get(input.clientId, studentId) as
      | { stars: number }
      | undefined;
    if (dup) return { stars: dup.stars, duplicate: true, levelChange: 0 }; // NFR-REL-03 resend after reconnect
  }
  if (!canStudentOpen(db, studentId, input.exerciseId)) throw new HttpError(404, 'exercise_not_found');
  const ex = db.prepare('SELECT id, type FROM exercises WHERE id = ?').get(input.exerciseId) as { id: number; type: ExerciseType };
  if (input.correct < 0 || input.correct > input.items || input.items < 1 || input.items > MAX_ITEMS)
    throw new HttpError(400, 'invalid_result');
  const level = getLevels(db, studentId)[ex.type];
  const stars = starsFor(input.correct, input.items);
  db.exec('BEGIN');
  try {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO results (student_id, exercise_id, type, level, items, correct, duration_s, stars, client_id, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(studentId, ex.id, ex.type, level, input.items, input.correct, Math.max(0, Math.round(input.durationS)), stars, input.clientId ?? null, iso(now));
    db.prepare('UPDATE students SET stars = stars + ? WHERE id = ?').run(stars, studentId);
    db.prepare('DELETE FROM progress WHERE student_id = ? AND exercise_id = ?').run(studentId, ex.id);
    const newLevel = nextLevel(level, recentAccuracies(db, studentId, ex.type, level));
    if (newLevel !== level) setLevel(db, studentId, ex.type, newLevel);
    // Mark the oldest open assignment this result satisfies as done.
    const a = db
      .prepare(
        `SELECT t.assignment_id FROM assignment_targets t JOIN assignments a ON a.id = t.assignment_id
         WHERE t.student_id = ? AND t.result_id IS NULL
           AND (a.exercise_id = ? OR (a.exercise_id IS NULL AND a.type = ?))
         ORDER BY a.exercise_id IS NULL, a.due_date IS NULL, a.due_date, a.id LIMIT 1`,
      )
      .get(studentId, ex.id, ex.type) as { assignment_id: number } | undefined;
    if (a)
      db.prepare('UPDATE assignment_targets SET result_id = ? WHERE assignment_id = ? AND student_id = ?').run(lastInsertRowid, a.assignment_id, studentId);
    db.exec('COMMIT');
    const total = (db.prepare('SELECT stars FROM students WHERE id = ?').get(studentId) as { stars: number }).stars;
    return { stars, totalStars: total, levelChange: newLevel - level };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ---------------- FR-EX-10: Today's practice ----------------

export interface PracticeItem {
  exerciseId: number;
  type: ExerciseType;
  title: string;
  assigned: boolean;
  dueDate: string | null;
  inProgress: boolean;
}

export function todaysPractice(db: DB, studentId: number, now: number): PracticeItem[] {
  const { language } = db.prepare('SELECT language FROM students WHERE id = ?').get(studentId) as { language: string };
  const levels = getLevels(db, studentId);
  const out: PracticeItem[] = [];

  const open = db
    .prepare(
      `SELECT a.id, a.type, a.level, a.exercise_id, a.due_date FROM assignment_targets t
       JOIN assignments a ON a.id = t.assignment_id
       WHERE t.student_id = ? AND t.result_id IS NULL
       ORDER BY a.due_date IS NULL, a.due_date, a.id`,
    )
    .all(studentId) as Array<{ id: number; type: ExerciseType | null; level: number | null; exercise_id: number | null; due_date: string | null }>;
  for (const a of open) {
    if (out.length >= 3) break;
    let ex: ExerciseRef | undefined;
    if (a.exercise_id) {
      if (canStudentOpen(db, studentId, a.exercise_id))
        ex = db.prepare('SELECT id, type, level, title FROM exercises WHERE id = ?').get(a.exercise_id) as unknown as ExerciseRef;
    } else if (a.type) {
      ex = pickExercise(db, studentId, a.type, a.level ?? levels[a.type], language);
    }
    if (ex && !out.some((o) => o.exerciseId === ex.id))
      out.push({ exerciseId: ex.id, type: ex.type, title: ex.title, assigned: true, dueDate: a.due_date, inProgress: false });
  }

  const acc = db
    .prepare(
      `SELECT type, SUM(correct) * 1.0 / SUM(items) AS acc FROM
         (SELECT type, correct, items FROM results WHERE student_id = ? ORDER BY id DESC LIMIT 50)
       GROUP BY type`,
    )
    .all(studentId) as Array<{ type: ExerciseType; acc: number }>;
  const accByType = Object.fromEntries(acc.map((r) => [r.type, r.acc]));
  const candidates = new Map<ExerciseType, ExerciseRef>();
  for (const t of EXERCISE_TYPES) {
    if (out.some((o) => o.type === t)) continue;
    const ex = pickExercise(db, studentId, t, levels[t], language);
    if (ex) candidates.set(t, ex); // E4 only when the teacher has items at this level (FR-EX-01)
  }
  for (const t of pickPracticeTypes(accByType, out.length, [...candidates.keys()])) {
    const ex = candidates.get(t)!;
    out.push({ exerciseId: ex.id, type: t, title: ex.title, assigned: false, dueDate: null, inProgress: false });
  }

  // FR-EX-08 — mark exercises that can be resumed.
  const prog = db.prepare('SELECT exercise_id FROM progress WHERE student_id = ? AND updated_at > ?').all(studentId, now - DAY) as Array<{ exercise_id: number }>;
  for (const o of out) o.inProgress = prog.some((p) => p.exercise_id === o.exerciseId);
  return out;
}

// ---------------- Progress views ----------------

/** Start of the ISO week (Monday 00:00 UTC) containing t. */
export function weekStart(t: number): number {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

/** FR-PRG-02 — teacher's per-child view: weekly time and count, levels, 12-week accuracy trend. */
export function studentDashboard(db: DB, studentId: number, now: number) {
  const student = db
    .prepare('SELECT id, name, student_number AS studentNumber, birth_year AS birthYear, language, stars, class_id AS classId FROM students WHERE id = ?')
    .get(studentId) as { studentNumber: string } & Record<string, unknown>;
  const first = weekStart(now) - 11 * 7 * DAY;
  const rows = db
    .prepare(
      `SELECT type, items, correct, duration_s, CAST(strftime('%s', completed_at) AS INTEGER) * 1000 AS t
       FROM results WHERE student_id = ? AND completed_at >= ?`,
    )
    .all(studentId, iso(first)) as Array<{ type: ExerciseType; items: number; correct: number; duration_s: number; t: number }>;
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = first + i * 7 * DAY;
    const inWeek = rows.filter((r) => r.t >= start && r.t < start + 7 * DAY);
    const accuracy = {} as Record<ExerciseType, number | null>;
    for (const type of EXERCISE_TYPES) {
      const rs = inWeek.filter((r) => r.type === type);
      const items = rs.reduce((s, r) => s + r.items, 0);
      accuracy[type] = items ? rs.reduce((s, r) => s + r.correct, 0) / items : null;
    }
    return {
      weekStart: new Date(start).toISOString().slice(0, 10),
      minutes: Math.round(inWeek.reduce((s, r) => s + r.duration_s, 0) / 60),
      exercises: inWeek.length,
      accuracy,
    };
  });
  return {
    student: { ...student, locked: !!lockedUntil(db, student.studentNumber, now) },
    levels: getLevels(db, studentId),
    settings: getSettings(db, studentId),
    weeks,
  };
}

export interface OverviewRow {
  id: number;
  name: string;
  studentNumber: string;
  minutes7: number;
  exercises7: number;
  levels: Record<ExerciseType, number>;
  inactive: boolean;
  locked: boolean;
}

/** FR-PRG-03 — teacher class overview. */
export function classOverview(db: DB, classId: number, now: number): OverviewRow[] {
  const since = iso(now - 7 * DAY);
  const rows = db
    .prepare(
      `SELECT s.id, s.name, s.student_number,
         COALESCE((SELECT SUM(duration_s) FROM results r WHERE r.student_id = s.id AND r.completed_at >= $since), 0) AS seconds7,
         (SELECT COUNT(*) FROM results r WHERE r.student_id = s.id AND r.completed_at >= $since) AS exercises7
       FROM students s WHERE s.class_id = $cls ORDER BY s.name COLLATE NOCASE`,
    )
    .all({ $since: since, $cls: classId }) as Array<{ id: number; name: string; student_number: string; seconds7: number; exercises7: number }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    studentNumber: r.student_number,
    minutes7: Math.round(r.seconds7 / 60),
    exercises7: r.exercises7,
    levels: getLevels(db, r.id),
    inactive: r.exercises7 === 0,
    locked: !!lockedUntil(db, r.student_number, now),
  }));
}

/** FR-PRG-04 — class overview as CSV (RFC 4180 quoting; formula-looking cells neutralised). */
export function overviewCsv(rows: OverviewRow[], header: string[]): string {
  const cell = (v: unknown) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(cell).join(',')];
  for (const r of rows)
    lines.push(
      [r.name, r.studentNumber, r.minutes7, r.exercises7, ...EXERCISE_TYPES.map((t) => r.levels[t]), r.inactive ? 'yes' : 'no', r.locked ? 'yes' : 'no']
        .map(cell)
        .join(','),
    );
  return lines.join('\r\n') + '\r\n';
}

/** DR-06 — all stored data of the students in one class, as JSON. */
export function exportClassData(db: DB, classId: number) {
  const cls = db.prepare('SELECT name, code, created_at AS createdAt FROM classes WHERE id = ?').get(classId);
  const students = (db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY id').all(classId) as Array<Record<string, unknown>>).map((s) => {
    const id = s.id as number;
    const attempts = db.prepare('SELECT failed, locked_until AS lockedUntil FROM login_attempts WHERE student_number = ?').get(s.student_number as string);
    return {
      studentNumber: s.student_number,
      name: s.name,
      birthYear: s.birth_year,
      language: s.language,
      createdAt: s.created_at,
      lastLoginAt: s.last_login_at,
      stars: s.stars,
      settings: getSettings(db, id),
      levels: getLevels(db, id),
      failedLogins: attempts ?? { failed: 0, lockedUntil: null },
      results: db
        .prepare('SELECT type, level, items, correct, duration_s AS durationS, completed_at AS completedAt, wcpm, stars FROM results WHERE student_id = ? ORDER BY id')
        .all(id),
      pausedExercises: db.prepare('SELECT exercise_id AS exerciseId, state FROM progress WHERE student_id = ?').all(id),
      assignments: db
        .prepare(
          `SELECT a.type, a.level, a.exercise_id AS exerciseId, a.due_date AS dueDate, t.result_id IS NOT NULL AS done
           FROM assignment_targets t JOIN assignments a ON a.id = t.assignment_id WHERE t.student_id = ?`,
        )
        .all(id),
    };
  });
  return { exportedAt: new Date().toISOString(), class: cls, students };
}

// ---------------- Deletion (FR-ACC-08, DR-04) ----------------

/** Live data is removed immediately; `deletion_log` drives the purge from backups within 30 days. */
export function deleteStudent(db: DB, studentId: number) {
  const s = db.prepare('SELECT student_number FROM students WHERE id = ?').get(studentId) as { student_number: string } | undefined;
  if (!s) return;
  db.prepare('DELETE FROM students WHERE id = ?').run(studentId);
  db.prepare('DELETE FROM login_attempts WHERE student_number = ?').run(s.student_number);
  db.prepare('INSERT INTO deletion_log (subject) VALUES (?)').run(`student:${studentId}`);
}

/** Image references held by a teacher's E4 items. */
export function e4ImageRefs(db: DB, where: string, ...params: Array<number | string>): string[] {
  const rows = db.prepare(`SELECT content FROM exercises WHERE type = 'E4' AND ${where}`).all(...params) as Array<{ content: string }>;
  return rows.flatMap((r) => (JSON.parse(r.content) as E4Stored).pictures.map((p) => p.ref));
}

/** DR-04 — delete a teacher account with its classes, students, texts, E4 items and pictures. */
export async function deleteTeacher(ctx: Ctx, teacherId: number) {
  const { db } = ctx;
  const refs = e4ImageRefs(db, 'teacher_id = ?', teacherId);
  const students = db
    .prepare('SELECT s.id FROM students s JOIN classes c ON c.id = s.class_id WHERE c.teacher_id = ?')
    .all(teacherId) as Array<{ id: number }>;
  db.exec('BEGIN');
  try {
    for (const s of students) deleteStudent(db, s.id);
    db.prepare('DELETE FROM teachers WHERE id = ?').run(teacherId);
    db.prepare('INSERT INTO deletion_log (subject) VALUES (?)').run(`teacher:${teacherId}`);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  await Promise.all(refs.map((r) => ctx.images.remove(r)));
}
