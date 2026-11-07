import type { Ctx } from './context.js';
import { HttpError } from './context.js';
import { type Content, type ExerciseType, MIN_LEVEL, TYPES, timeLimitS } from './domain/rules.js';

export interface ExerciseRow {
  id: number;
  type: ExerciseType;
  level: number;
  title: string;
  content: string;
  teacher_id: number | null;
  archived: number;
  created_at: string;
}

export function exerciseDto(e: ExerciseRow) {
  const content = JSON.parse(e.content) as Content;
  return {
    id: e.id,
    type: e.type,
    level: e.level,
    title: e.title,
    shared: e.teacher_id === null,
    archived: !!e.archived,
    timeLimitS: timeLimitS(e.type, content),
    content,
    createdAt: e.created_at,
  };
}

// ---------- Ownership ----------

export function ownClass(ctx: Ctx, teacherId: number, classId: number) {
  const c = ctx.db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId) as
    | { id: number; name: string; code: string; created_at: string }
    | undefined;
  if (!c) throw new HttpError(404, 'class_not_found');
  return c;
}

export function ownStudent(ctx: Ctx, teacherId: number, studentId: number) {
  const s = ctx.db
    .prepare(
      `SELECT s.* FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ? AND c.teacher_id = ?`,
    )
    .get(studentId, teacherId) as { id: number; class_id: number; name: string; student_number: string; points: number } | undefined;
  if (!s) throw new HttpError(404, 'student_not_found');
  return s;
}

/** Exercises a teacher can see: the shared ones plus their own. */
export function teacherCanUse(ctx: Ctx, teacherId: number, exerciseId: number): ExerciseRow {
  const e = ctx.db
    .prepare('SELECT * FROM exercises WHERE id = ? AND (teacher_id IS NULL OR teacher_id = ?)')
    .get(exerciseId, teacherId) as ExerciseRow | undefined;
  if (!e) throw new HttpError(404, 'exercise_not_found');
  return e;
}

/** The teacher owning a student's class: their exercises are visible to the student too. */
export function studentTeacher(ctx: Ctx, studentId: number) {
  return ctx.db
    .prepare('SELECT c.teacher_id AS teacherId, c.id AS classId FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ?')
    .get(studentId) as { teacherId: number; classId: number };
}

export function studentCanPlay(ctx: Ctx, studentId: number, exerciseId: number): ExerciseRow {
  const { teacherId } = studentTeacher(ctx, studentId);
  const e = ctx.db
    .prepare('SELECT * FROM exercises WHERE id = ? AND archived = 0 AND (teacher_id IS NULL OR teacher_id = ?)')
    .get(exerciseId, teacherId) as ExerciseRow | undefined;
  if (!e) throw new HttpError(404, 'exercise_not_found');
  return e;
}

// ---------- Levels ----------

export function levelsOf(ctx: Ctx, studentId: number): Record<ExerciseType, number> {
  const rows = ctx.db.prepare('SELECT type, level FROM levels WHERE student_id = ?').all(studentId) as Array<{
    type: ExerciseType;
    level: number;
  }>;
  const out = Object.fromEntries(TYPES.map((t) => [t, MIN_LEVEL])) as Record<ExerciseType, number>;
  for (const r of rows) out[r.type] = r.level;
  return out;
}

export function setLevel(ctx: Ctx, studentId: number, type: ExerciseType, level: number) {
  ctx.db
    .prepare('INSERT INTO levels (student_id, type, level) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET level = excluded.level')
    .run(studentId, type, level);
}

/**
 * Picks the exercise of a type at the kid's level that they have done the fewest times.
 * If nothing exists at that level, the nearest level is used.
 */
export function pickExercise(ctx: Ctx, studentId: number, type: ExerciseType): ExerciseRow | undefined {
  const level = levelsOf(ctx, studentId)[type];
  const { teacherId } = studentTeacher(ctx, studentId);
  return ctx.db
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM results r WHERE r.exercise_id = e.id AND r.student_id = ?) AS times
         FROM exercises e
        WHERE e.type = ? AND e.archived = 0 AND (e.teacher_id IS NULL OR e.teacher_id = ?)
        ORDER BY ABS(e.level - ?), times, RANDOM()
        LIMIT 1`,
    )
    .get(studentId, type, teacherId, level) as ExerciseRow | undefined;
}

// ---------- Assignments ----------

/** Assignments for a kid that they have not completed yet. */
export function openAssignments(ctx: Ctx, studentId: number) {
  const { classId } = studentTeacher(ctx, studentId);
  return ctx.db
    .prepare(
      `SELECT a.id, a.due_date AS dueDate, e.id AS exerciseId, e.title, e.type, e.level
         FROM assignments a JOIN exercises e ON e.id = a.exercise_id
        WHERE a.class_id = ? AND (a.student_id IS NULL OR a.student_id = ?) AND e.archived = 0
          AND NOT EXISTS (SELECT 1 FROM results r WHERE r.assignment_id = a.id AND r.student_id = ?)
        ORDER BY a.due_date IS NULL, a.due_date, a.id`,
    )
    .all(classId, studentId, studentId);
}

// ---------- Leaderboard (req 14) ----------

export function leaderboard(ctx: Ctx, classId: number, period: 'all' | 'week') {
  if (period === 'all') {
    return ctx.db
      .prepare('SELECT id, name, points FROM students WHERE class_id = ? ORDER BY points DESC, name LIMIT 100')
      .all(classId) as Array<{ id: number; name: string; points: number }>;
  }
  return ctx.db
    .prepare(
      `SELECT s.id, s.name,
              COALESCE((SELECT SUM(points) FROM results r
                         WHERE r.student_id = s.id AND r.completed_at >= datetime('now', '-7 days')), 0) AS points
         FROM students s WHERE s.class_id = ? ORDER BY points DESC, s.name LIMIT 100`,
    )
    .all(classId) as Array<{ id: number; name: string; points: number }>;
}

// ---------- Reports (req 16) ----------

interface ClassReportRow {
  id: number;
  name: string;
  number: string;
  points: number;
  lastLogin: string | null;
  exercises: number;
  avgPct: number | null;
  lastExercise: string | null;
  timeMs: number;
  recordings: number;
  newRecordings: number;
}

export function classReport(ctx: Ctx, classId: number) {
  const students = ctx.db
    .prepare(
      `SELECT s.id, s.name, s.student_number AS number, s.points, s.last_login_at AS lastLogin,
              COUNT(r.id) AS exercises,
              ROUND(100.0 * SUM(r.correct) / NULLIF(SUM(r.total), 0)) AS avgPct,
              MAX(r.completed_at) AS lastExercise,
              COALESCE(SUM(r.duration_ms), 0) AS timeMs,
              (SELECT COUNT(*) FROM recordings rc WHERE rc.student_id = s.id) AS recordings,
              (SELECT COUNT(*) FROM recordings rc WHERE rc.student_id = s.id AND rc.listened_at IS NULL) AS newRecordings
         FROM students s LEFT JOIN results r ON r.student_id = s.id
        WHERE s.class_id = ?
        GROUP BY s.id ORDER BY s.name`,
    )
    .all(classId) as unknown as ClassReportRow[];
  return students.map((s) => ({ ...s, levels: levelsOf(ctx, s.id) }));
}

export function studentReport(ctx: Ctx, studentId: number) {
  const byType = ctx.db
    .prepare(
      `SELECT type, COUNT(*) AS exercises, ROUND(100.0 * SUM(correct) / NULLIF(SUM(total), 0)) AS avgPct,
              SUM(points) AS points
         FROM results WHERE student_id = ? GROUP BY type`,
    )
    .all(studentId);
  const results = ctx.db
    .prepare(
      `SELECT r.id, r.exercise_id AS exerciseId, e.title, r.type, r.level, r.correct, r.total, r.points,
              r.duration_ms AS durationMs, r.answers, r.assignment_id AS assignmentId, r.completed_at AS completedAt
         FROM results r JOIN exercises e ON e.id = r.exercise_id
        WHERE r.student_id = ? ORDER BY r.completed_at DESC, r.id DESC LIMIT 200`,
    )
    .all(studentId)
    .map((r) => ({ ...r, answers: JSON.parse((r as { answers: string }).answers) }));
  const recordings = ctx.db
    .prepare(
      `SELECT id, title, duration_ms AS durationMs, listened_at AS listenedAt, created_at AS createdAt
         FROM recordings WHERE student_id = ? ORDER BY id DESC`,
    )
    .all(studentId);
  return { levels: levelsOf(ctx, studentId), byType, results, recordings };
}

// ---------- CSV export (req 18) ----------

/** Quotes a CSV cell and neutralises spreadsheet formulas (=, +, -, @). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r;]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

export function resultsCsv(ctx: Ctx, classId: number) {
  const rows = ctx.db
    .prepare(
      `SELECT s.student_number, s.name, r.completed_at, e.title, r.type, r.level, r.correct, r.total,
              r.points, r.duration_ms, r.assignment_id
         FROM results r JOIN students s ON s.id = r.student_id JOIN exercises e ON e.id = r.exercise_id
        WHERE s.class_id = ? ORDER BY r.completed_at, r.id`,
    )
    .all(classId) as Array<Record<string, string | number | null>>;
  return toCsv([
    ['student_number', 'name', 'completed_at_utc', 'exercise', 'type', 'level', 'correct', 'total', 'percent', 'points', 'seconds', 'assigned'],
    ...rows.map((r) => [
      r.student_number, r.name, r.completed_at, r.title, r.type, r.level, r.correct, r.total,
      Math.round((100 * Number(r.correct)) / Number(r.total)), r.points, Math.round(Number(r.duration_ms) / 1000),
      r.assignment_id ? 'yes' : 'no',
    ]),
  ]);
}

export function studentsCsv(ctx: Ctx, classId: number) {
  const rows = classReport(ctx, classId);
  return toCsv([
    ['student_number', 'name', 'points', 'exercises', 'average_percent', 'minutes_practised', 'recordings', 'last_login_utc',
      ...TYPES.map((t) => `level_${t}`)],
    ...rows.map((s) => [
      s.number, s.name, s.points, s.exercises, s.avgPct, Math.round(Number(s.timeMs) / 60000), s.recordings, s.lastLogin,
      ...TYPES.map((t) => s.levels[t]),
    ]),
  ]);
}
