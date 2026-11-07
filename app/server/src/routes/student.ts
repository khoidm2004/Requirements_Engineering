import express, { Router } from 'express';
import { type Ctx, HttpError, h, int, requireStudent } from '../context.js';
import { tx } from '../db.js';
import { type Answer, type Content, isType, nextLevel, score, validateSettings } from '../domain/rules.js';
import {
  type ExerciseRow, exerciseDto, leaderboard, levelsOf, openAssignments, pickExercise, setLevel, studentCanPlay,
  studentTeacher,
} from '../services.js';
import { sniffAudio } from '../storage.js';

export const MAX_RECORDING_BYTES = 20 * 1024 * 1024;
const MAX_RECORDING_MS = 10 * 60 * 1000;

export function studentRoutes(ctx: Ctx) {
  const r = Router();
  r.use('/student', requireStudent);
  const sid = (req: express.Request) => req.auth!.studentId!;

  r.get('/student/home', h((req, res) => {
    const s = ctx.db.prepare('SELECT points FROM students WHERE id = ?').get(sid(req)) as { points: number };
    const { classId } = studentTeacher(ctx, sid(req));
    const board = leaderboard(ctx, classId, 'all');
    res.json({
      points: s.points,
      rank: board.findIndex((b) => b.id === sid(req)) + 1,
      levels: levelsOf(ctx, sid(req)),
      assignments: openAssignments(ctx, sid(req)),
    });
  }));

  // Req 7: the next exercise of a type, at the kid's current level.
  r.get('/student/practice/:type', h((req, res) => {
    const type = req.params.type;
    if (!isType(type)) throw new HttpError(400, 'invalid_type');
    const e = pickExercise(ctx, sid(req), type);
    if (!e) throw new HttpError(404, 'no_exercises');
    res.json(exerciseDto(e));
  }));

  r.get('/student/exercises/:id', h((req, res) => {
    res.json(exerciseDto(studentCanPlay(ctx, sid(req), int(req.params.id, 'id', 1, Number.MAX_SAFE_INTEGER))));
  }));

  r.post('/student/results', h((req, res) => {
    const studentId = sid(req);
    const e: ExerciseRow = studentCanPlay(ctx, studentId, int(req.body?.exerciseId, 'exerciseId', 1, Number.MAX_SAFE_INTEGER));
    const raw = req.body?.answers;
    if (!Array.isArray(raw) || raw.length > 50) throw new HttpError(400, 'invalid_answers');
    const answers: Answer[] = raw.map((a) => {
      const given = a?.given;
      if (given !== null && (typeof given !== 'string' || given.length > 200)) throw new HttpError(400, 'invalid_answers');
      return { given, ms: typeof a?.ms === 'number' && Number.isFinite(a.ms) ? a.ms : 0 };
    });
    const durationMs = int(Math.round(Number(req.body?.durationMs ?? 0)), 'durationMs', 0, 24 * 3600 * 1000);

    let assignmentId: number | null = null;
    if (req.body?.assignmentId !== undefined && req.body?.assignmentId !== null) {
      assignmentId = int(req.body.assignmentId, 'assignmentId', 1, Number.MAX_SAFE_INTEGER);
      const { classId } = studentTeacher(ctx, studentId);
      const ok = ctx.db
        .prepare('SELECT 1 FROM assignments WHERE id = ? AND class_id = ? AND exercise_id = ? AND (student_id IS NULL OR student_id = ?)')
        .get(assignmentId, classId, e.id, studentId);
      if (!ok) throw new HttpError(400, 'invalid_assignment');
    }

    const content = JSON.parse(e.content) as Content;
    const result = score(e.type, content, answers);
    const before = levelsOf(ctx, studentId)[e.type];
    // Only exercises at the kid's own level move the level (assigned ones may be easier/harder).
    const after = e.level === before ? nextLevel(before, result.correct, result.total) : before;

    const totalPoints = tx(ctx.db, () => {
      ctx.db
        .prepare(
          `INSERT INTO results (student_id, exercise_id, assignment_id, type, level, correct, total, points, duration_ms, answers)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(studentId, e.id, assignmentId, e.type, e.level, result.correct, result.total, result.points, durationMs,
          JSON.stringify(result.marked));
      if (after !== before) setLevel(ctx, studentId, e.type, after);
      ctx.db.prepare('UPDATE students SET points = points + ? WHERE id = ?').run(result.points, studentId);
      return (ctx.db.prepare('SELECT points FROM students WHERE id = ?').get(studentId) as { points: number }).points;
    });

    res.status(201).json({
      correct: result.correct,
      total: result.total,
      points: result.points,
      totalPoints,
      level: before,
      newLevel: after,
      answers: result.marked,
    });
  }));

  // Req 10: kids' own font, colour and size settings.
  r.put('/student/settings', h((req, res) => {
    const settings = validateSettings(req.body);
    ctx.db.prepare('UPDATE students SET settings = ? WHERE id = ?').run(JSON.stringify(settings), sid(req));
    res.json(settings);
  }));

  // Req 14: the class leaderboard.
  r.get('/student/leaderboard', h((req, res) => {
    const { classId } = studentTeacher(ctx, sid(req));
    const rows = leaderboard(ctx, classId, req.query.period === 'week' ? 'week' : 'all');
    res.json(rows.map((b) => ({ ...b, me: b.id === sid(req) })));
  }));

  // ---------- Read aloud & record (req 13) ----------

  /** Texts to read aloud: stories visible to the kid, closest to their story level first. */
  r.get('/student/texts', h((req, res) => {
    const { teacherId } = studentTeacher(ctx, sid(req));
    const level = levelsOf(ctx, sid(req)).stories;
    const rows = ctx.db
      .prepare(
        `SELECT * FROM exercises WHERE type = 'stories' AND archived = 0 AND (teacher_id IS NULL OR teacher_id = ?)
          ORDER BY ABS(level - ?), level, id`,
      )
      .all(teacherId, level) as unknown as ExerciseRow[];
    res.json(rows.map((e) => ({ id: e.id, title: e.title, level: e.level, shared: e.teacher_id === null,
      text: (JSON.parse(e.content) as { text: string }).text })));
  }));

  r.post(
    '/student/recordings',
    express.raw({ type: () => true, limit: MAX_RECORDING_BYTES }),
    h((req, res) => {
      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || !body.length) throw new HttpError(400, 'empty_file');
      const kind = sniffAudio(body);
      if (!kind) throw new HttpError(415, 'unsupported_audio');
      const durationMs = int(Math.round(Number(req.query.durationMs ?? 0)), 'durationMs', 0, MAX_RECORDING_MS);
      let exerciseId: number | null = null;
      let title = 'My reading';
      if (req.query.exerciseId) {
        const e = studentCanPlay(ctx, sid(req), int(req.query.exerciseId, 'exerciseId', 1, Number.MAX_SAFE_INTEGER));
        exerciseId = e.id;
        title = e.title;
      }
      const file = ctx.storage.put('recordings', kind.ext, body);
      const { lastInsertRowid } = ctx.db
        .prepare('INSERT INTO recordings (student_id, exercise_id, title, file, mime, duration_ms) VALUES (?, ?, ?, ?, ?, ?)')
        .run(sid(req), exerciseId, title, file, kind.mime, durationMs);
      res.status(201).json({ id: Number(lastInsertRowid) });
    }),
  );

  r.get('/student/recordings', h((req, res) => {
    res.json(
      ctx.db
        .prepare(
          `SELECT id, title, duration_ms AS durationMs, listened_at IS NOT NULL AS listened, created_at AS createdAt
             FROM recordings WHERE student_id = ? ORDER BY id DESC`,
        )
        .all(sid(req)),
    );
  }));

  r.get('/student/recordings/:id/audio', h((req, res) => {
    const rec = ctx.db
      .prepare('SELECT file, mime FROM recordings WHERE id = ? AND student_id = ?')
      .get(int(req.params.id, 'id', 1, Number.MAX_SAFE_INTEGER), sid(req)) as { file: string; mime: string } | undefined;
    const data = rec && ctx.storage.get(rec.file);
    if (!rec || !data) throw new HttpError(404, 'recording_not_found');
    res.type(rec.mime).setHeader('Cache-Control', 'private, no-store');
    res.send(data);
  }));

  return r;
}

/** Pictures can be seen by their teacher and by that teacher's students. */
export function imageRoutes(ctx: Ctx) {
  const r = Router();
  r.get('/images/:id', h((req, res) => {
    const a = req.auth;
    if (!a?.teacherId && !a?.studentId) throw new HttpError(401, 'not_logged_in');
    const img = ctx.db.prepare('SELECT teacher_id, file, mime FROM images WHERE id = ?').get(
      int(req.params.id, 'id', 1, Number.MAX_SAFE_INTEGER),
    ) as { teacher_id: number; file: string; mime: string } | undefined;
    const owner = a.teacherId ?? (a.studentId ? studentTeacher(ctx, a.studentId).teacherId : undefined);
    const data = img && img.teacher_id === owner ? ctx.storage.get(img.file) : null;
    if (!img || !data) throw new HttpError(404, 'image_not_found');
    res.type(img.mime).setHeader('Cache-Control', 'private, max-age=86400');
    res.send(data);
  }));
  return r;
}
