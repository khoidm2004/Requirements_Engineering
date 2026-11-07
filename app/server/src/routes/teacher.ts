import express, { Router } from 'express';
import { type Ctx, DATE_RE, HttpError, h, int, requireTeacher, str } from '../context.js';
import { tx } from '../db.js';
import {
  MAX_LEVEL, MIN_LEVEL, STUDENT_NUMBER_RE, type Content, type PicturesContent, generateClassCode, isType, validateContent,
} from '../domain/rules.js';
import {
  type ExerciseRow, classReport, exerciseDto, leaderboard, ownClass, ownStudent, resultsCsv, setLevel, studentReport,
  studentsCsv, teacherCanUse,
} from '../services.js';
import { sniffImage } from '../storage.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function teacherRoutes(ctx: Ctx) {
  const r = Router();
  r.use('/teacher', requireTeacher);
  const tid = (req: express.Request) => req.auth!.teacherId!;
  const id = (req: express.Request, name = 'id') => int(req.params[name], name, 1, Number.MAX_SAFE_INTEGER);

  // ---------- Classes (req 2) ----------

  r.get('/teacher/classes', h((req, res) => {
    res.json(
      ctx.db
        .prepare(
          `SELECT c.id, c.name, c.code, c.created_at AS createdAt,
                  (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS students
             FROM classes c WHERE c.teacher_id = ? ORDER BY c.name`,
        )
        .all(tid(req)),
    );
  }));

  r.post('/teacher/classes', h((req, res) => {
    const name = str(req.body?.name, 'name', { max: 80 });
    const code = generateClassCode((c) => !!ctx.db.prepare('SELECT 1 FROM classes WHERE code = ?').get(c));
    const { lastInsertRowid } = ctx.db
      .prepare('INSERT INTO classes (teacher_id, name, code) VALUES (?, ?, ?)')
      .run(tid(req), name, code);
    res.status(201).json({ id: Number(lastInsertRowid), name, code });
  }));

  r.get('/teacher/classes/:id', h((req, res) => {
    const c = ownClass(ctx, tid(req), id(req));
    res.json({ id: c.id, name: c.name, code: c.code, createdAt: c.created_at, students: classReport(ctx, c.id) });
  }));

  r.get('/teacher/classes/:id/leaderboard', h((req, res) => {
    const c = ownClass(ctx, tid(req), id(req));
    res.json(leaderboard(ctx, c.id, req.query.period === 'week' ? 'week' : 'all'));
  }));

  // ---------- Students (req 3) ----------

  r.post('/teacher/classes/:id/students', h((req, res) => {
    const c = ownClass(ctx, tid(req), id(req));
    const name = str(req.body?.name, 'name', { max: 60 });
    const number = str(req.body?.number, 'number', { max: 30 });
    if (!STUDENT_NUMBER_RE.test(number)) throw new HttpError(400, 'invalid_number');
    if (ctx.db.prepare('SELECT 1 FROM students WHERE student_number = ?').get(number)) throw new HttpError(409, 'number_taken');
    const { lastInsertRowid } = ctx.db
      .prepare('INSERT INTO students (class_id, name, student_number) VALUES (?, ?, ?)')
      .run(c.id, name, number);
    res.status(201).json({ id: Number(lastInsertRowid), name, number });
  }));

  r.get('/teacher/students/:id', h((req, res) => {
    const s = ownStudent(ctx, tid(req), id(req));
    const cls = ctx.db.prepare('SELECT id, name FROM classes WHERE id = ?').get(s.class_id);
    res.json({ id: s.id, name: s.name, number: s.student_number, points: s.points, class: cls, ...studentReport(ctx, s.id) });
  }));

  r.put('/teacher/students/:id/levels', h((req, res) => {
    const s = ownStudent(ctx, tid(req), id(req));
    const type = req.body?.type;
    if (!isType(type)) throw new HttpError(400, 'invalid_type');
    setLevel(ctx, s.id, type, int(req.body?.level, 'level', MIN_LEVEL, MAX_LEVEL));
    res.json({ ok: true });
  }));

  // Removes a student and everything stored about them (needed for GDPR erasure requests).
  r.delete('/teacher/students/:id', h((req, res) => {
    const s = ownStudent(ctx, tid(req), id(req));
    const files = ctx.db.prepare('SELECT file FROM recordings WHERE student_id = ?').all(s.id) as Array<{ file: string }>;
    ctx.db.prepare('DELETE FROM students WHERE id = ?').run(s.id);
    for (const f of files) ctx.storage.remove(f.file);
    res.json({ ok: true });
  }));

  // ---------- Exercises: library and teacher's own content (req 5, 17) ----------

  r.get('/teacher/exercises', h((req, res) => {
    const rows = ctx.db
      .prepare(
        `SELECT * FROM exercises WHERE archived = 0 AND (teacher_id IS NULL OR teacher_id = ?)
          ORDER BY teacher_id IS NULL, type, level, id`,
      )
      .all(tid(req)) as unknown as ExerciseRow[];
    res.json(rows.map(exerciseDto));
  }));

  r.post('/teacher/exercises', h((req, res) => {
    const type = req.body?.type;
    if (!isType(type)) throw new HttpError(400, 'invalid_type');
    const level = int(req.body?.level, 'level', MIN_LEVEL, MAX_LEVEL);
    const title = str(req.body?.title, 'title', { max: 100 });
    const content: Content = validateContent(type, req.body?.content);
    if (type === 'pictures') {
      for (const item of (content as PicturesContent).items) {
        if ('imageId' in item.picture) {
          const img = ctx.db.prepare('SELECT 1 FROM images WHERE id = ? AND teacher_id = ?').get(item.picture.imageId, tid(req));
          if (!img) throw new HttpError(400, 'invalid_picture');
        }
      }
    }
    const { lastInsertRowid } = ctx.db
      .prepare('INSERT INTO exercises (type, level, title, content, teacher_id) VALUES (?, ?, ?, ?, ?)')
      .run(type, level, title, JSON.stringify(content), tid(req));
    res.status(201).json({ id: Number(lastInsertRowid) });
  }));

  // Exercises are archived, not deleted, so results stay available for analysis.
  r.delete('/teacher/exercises/:id', h((req, res) => {
    const { changes } = ctx.db
      .prepare('UPDATE exercises SET archived = 1 WHERE id = ? AND teacher_id = ?')
      .run(id(req), tid(req));
    if (!changes) throw new HttpError(404, 'exercise_not_found');
    res.json({ ok: true });
  }));

  // ---------- Pictures (req 5) ----------

  r.post(
    '/teacher/images',
    express.raw({ type: () => true, limit: MAX_IMAGE_BYTES }),
    h((req, res) => {
      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || !body.length) throw new HttpError(400, 'empty_file');
      const kind = sniffImage(body);
      if (!kind) throw new HttpError(415, 'unsupported_image');
      const file = ctx.storage.put('images', kind.ext, body);
      const { lastInsertRowid } = ctx.db
        .prepare('INSERT INTO images (teacher_id, file, mime) VALUES (?, ?, ?)')
        .run(tid(req), file, kind.mime);
      res.status(201).json({ id: Number(lastInsertRowid) });
    }),
  );

  // ---------- Assignments (req 5) ----------

  r.get('/teacher/classes/:id/assignments', h((req, res) => {
    const c = ownClass(ctx, tid(req), id(req));
    res.json(
      ctx.db
        .prepare(
          `SELECT a.id, a.due_date AS dueDate, a.created_at AS createdAt, a.student_id AS studentId,
                  s.name AS studentName, e.id AS exerciseId, e.title, e.type, e.level,
                  CASE WHEN a.student_id IS NULL THEN (SELECT COUNT(*) FROM students WHERE class_id = a.class_id) ELSE 1 END AS assigned,
                  (SELECT COUNT(DISTINCT r.student_id) FROM results r WHERE r.assignment_id = a.id) AS done
             FROM assignments a JOIN exercises e ON e.id = a.exercise_id LEFT JOIN students s ON s.id = a.student_id
            WHERE a.class_id = ? ORDER BY a.id DESC`,
        )
        .all(c.id),
    );
  }));

  r.post('/teacher/assignments', h((req, res) => {
    const c = ownClass(ctx, tid(req), int(req.body?.classId, 'classId', 1, Number.MAX_SAFE_INTEGER));
    const e = teacherCanUse(ctx, tid(req), int(req.body?.exerciseId, 'exerciseId', 1, Number.MAX_SAFE_INTEGER));
    if (e.archived) throw new HttpError(400, 'exercise_archived');
    const due = req.body?.dueDate || null;
    if (due !== null && (typeof due !== 'string' || !DATE_RE.test(due))) throw new HttpError(400, 'invalid_dueDate');
    const ids: unknown = req.body?.studentIds;
    const insert = ctx.db.prepare('INSERT INTO assignments (class_id, exercise_id, student_id, due_date) VALUES (?, ?, ?, ?)');
    if (ids === undefined || ids === null || (Array.isArray(ids) && ids.length === 0)) {
      insert.run(c.id, e.id, null, due);
      return res.status(201).json({ created: 1 });
    }
    if (!Array.isArray(ids) || ids.length > 200) throw new HttpError(400, 'invalid_studentIds');
    const inClass = ctx.db.prepare('SELECT 1 FROM students WHERE id = ? AND class_id = ?');
    tx(ctx.db, () => {
      for (const sid of new Set(ids)) {
        if (!Number.isInteger(sid) || !inClass.get(sid, c.id)) throw new HttpError(400, 'invalid_studentIds');
        insert.run(c.id, e.id, sid as number, due);
      }
    });
    res.status(201).json({ created: new Set(ids).size });
  }));

  r.delete('/teacher/assignments/:id', h((req, res) => {
    const { changes } = ctx.db
      .prepare('DELETE FROM assignments WHERE id = ? AND class_id IN (SELECT id FROM classes WHERE teacher_id = ?)')
      .run(id(req), tid(req));
    if (!changes) throw new HttpError(404, 'assignment_not_found');
    res.json({ ok: true });
  }));

  // ---------- Recordings (req 13) ----------

  r.get('/teacher/recordings/:id/audio', h((req, res) => {
    const rec = ctx.db
      .prepare(
        `SELECT rc.id, rc.file, rc.mime FROM recordings rc JOIN students s ON s.id = rc.student_id
           JOIN classes c ON c.id = s.class_id WHERE rc.id = ? AND c.teacher_id = ?`,
      )
      .get(id(req), tid(req)) as { id: number; file: string; mime: string } | undefined;
    const data = rec && ctx.storage.get(rec.file);
    if (!rec || !data) throw new HttpError(404, 'recording_not_found');
    ctx.db.prepare("UPDATE recordings SET listened_at = COALESCE(listened_at, datetime('now')) WHERE id = ?").run(rec.id);
    res.type(rec.mime).setHeader('Cache-Control', 'private, no-store');
    res.send(data);
  }));

  // ---------- Export (req 18) ----------

  const sendCsv = (res: express.Response, name: string, csv: string) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send('﻿' + csv); // BOM so spreadsheet apps detect UTF-8
  };

  r.get('/teacher/classes/:id/export/results.csv', h((req, res) => {
    const c = ownClass(ctx, tid(req), id(req));
    sendCsv(res, `readbuddy-${c.code}-results.csv`, resultsCsv(ctx, c.id));
  }));

  r.get('/teacher/classes/:id/export/students.csv', h((req, res) => {
    const c = ownClass(ctx, tid(req), id(req));
    sendCsv(res, `readbuddy-${c.code}-students.csv`, studentsCsv(ctx, c.id));
  }));

  return r;
}
