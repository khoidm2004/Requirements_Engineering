import { Router } from 'express';
import {
  type Ctx, h, HttpError, requireTeacher, requireVerifiedTeacher, str, int, language, endSession,
} from '../context.js';
import { verify } from '../domain/passwords.js';
import {
  EXERCISE_TYPES, MAX_CLASSES, MAX_STUDENTS_PER_CLASS, countWords, generateClassCode, isValidLabel, mergeSettings,
  normalizeStudentNumber, type ExerciseType,
} from '../domain/rules.js';
import { checkImageDataUrl, type StoredImage } from '../images.js';
import {
  assertStudentAccess, classOverview, deleteStudent, deleteTeacher, e4ImageRefs, exportClassData, getLevels, getSettings,
  overviewCsv, placeStudent, setLevel, studentDashboard,
} from '../services.js';

/** FR-CNT-02 / FR-EX-01 E5 — 40–250 words and exactly 3 multiple-choice text questions. */
export function validatePassage(b: Record<string, unknown>) {
  const passage = str(b.passage, 'passage', { max: 3000 });
  const words = countWords(passage);
  if (words < 40 || words > 250) throw new HttpError(400, 'passage_length');
  const qs = b.questions;
  if (!Array.isArray(qs) || qs.length !== 3) throw new HttpError(400, 'three_questions_required');
  const questions = qs.map((q: { q?: unknown; options?: unknown; answer?: unknown }) => {
    const text = str(q?.q, 'question', { max: 300 });
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) throw new HttpError(400, 'invalid_options');
    const options = q.options.map((o) => str(o, 'option', { max: 150 }));
    const answer = int(q.answer, 'answer', 0, options.length - 1);
    return { q: text, options, answer };
  });
  return { passage, questions };
}

export function teacherRoutes(ctx: Ctx) {
  const r = Router();
  const { db } = ctx;
  const teacher = requireTeacher;
  const verified = requireVerifiedTeacher;
  const me = (req: { auth?: { teacher?: { id: number } } }) => req.auth!.teacher!.id;

  const ownClass = (teacherId: number, classId: number) => {
    const c = db.prepare('SELECT id, name, code FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId) as
      | { id: number; name: string; code: string }
      | undefined;
    if (!c) throw new HttpError(404, 'class_not_found');
    return c;
  };

  // ---------------- Classes and students ----------------

  r.get('/teacher/classes', teacher, h((req, res) => {
    res.json(
      db
        .prepare(
          `SELECT cl.id, cl.name, cl.code, (SELECT COUNT(*) FROM students s WHERE s.class_id = cl.id) AS students
           FROM classes cl WHERE teacher_id = ? ORDER BY cl.name COLLATE NOCASE`,
        )
        .all(me(req)),
    );
  }));

  // FR-ACC-03 — create class with unique 6-character code (§2.3: up to 10 classes per teacher)
  r.post('/teacher/classes', verified, h((req, res) => {
    const name = str(req.body?.name, 'name', { max: 60 });
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM classes WHERE teacher_id = ?').get(me(req)) as { n: number };
    if (n >= MAX_CLASSES) throw new HttpError(400, 'max_classes');
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateClassCode();
      if (db.prepare('SELECT 1 FROM classes WHERE code = ?').get(code)) continue;
      const { lastInsertRowid } = db.prepare('INSERT INTO classes (teacher_id, name, code) VALUES (?, ?, ?)').run(me(req), name, code);
      return res.status(201).json({ id: Number(lastInsertRowid), name, code });
    }
    throw new HttpError(500, 'code_generation_failed');
  }));

  // FR-PRG-03 — class overview
  r.get('/teacher/classes/:id/overview', teacher, h((req, res) => {
    const cls = ownClass(me(req), Number(req.params.id));
    res.json({ class: cls, students: classOverview(db, cls.id, ctx.now()) });
  }));

  // FR-PRG-04 — CSV export of the class overview
  r.get('/teacher/classes/:id/overview.csv', teacher, h((req, res) => {
    const cls = ownClass(me(req), Number(req.params.id));
    const header = ['Name', 'Student number', 'Minutes (7 days)', 'Exercises (7 days)', ...EXERCISE_TYPES.map((t) => `Level ${t}`), 'Not practised in 7 days', 'Login locked'];
    const safe = cls.name.replace(/[^\p{L}\p{N}_-]+/gu, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="readbuddy-${safe}.csv"`);
    res.send('﻿' + overviewCsv(classOverview(db, cls.id, ctx.now()), header));
  }));

  // DR-06 — all stored data of the class's students as JSON
  r.get('/teacher/classes/:id/export.json', teacher, h((req, res) => {
    const cls = ownClass(me(req), Number(req.params.id));
    res.setHeader('Content-Disposition', `attachment; filename="readbuddy-class-${cls.code}.json"`);
    res.json(exportClassData(db, cls.id));
  }));

  // FR-ACC-04 — enrol a student (name, student number, language, birth year)
  r.post('/teacher/classes/:id/students', verified, h((req, res) => {
    const cls = ownClass(me(req), Number(req.params.id));
    const b = req.body ?? {};
    const name = str(b.name, 'student_name', { max: 60 });
    const number = normalizeStudentNumber(b.studentNumber);
    if (!number) throw new HttpError(400, 'invalid_student_number');
    const lang = language(b.language);
    const year = new Date(ctx.now()).getFullYear();
    const birthYear = int(b.birthYear, 'birth_year', year - 13, year - 5);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM students WHERE class_id = ?').get(cls.id) as { n: number };
    if (n >= MAX_STUDENTS_PER_CLASS) throw new HttpError(400, 'class_full');
    if (db.prepare('SELECT 1 FROM students WHERE student_number = ?').get(number)) throw new HttpError(409, 'student_number_in_use');
    db.exec('BEGIN');
    try {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO students (class_id, student_number, name, birth_year, language) VALUES (?, ?, ?, ?, ?)')
        .run(cls.id, number, name, birthYear, lang);
      const id = Number(lastInsertRowid);
      placeStudent(db, id, birthYear, new Date(ctx.now())); // FR-EX-07
      // A fresh enrolment starts with a clean failed-login count for its number.
      db.prepare('DELETE FROM login_attempts WHERE student_number = ?').run(number);
      db.exec('COMMIT');
      res.status(201).json({ id, studentNumber: number });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }));

  // FR-PRG-02 — per-child detail
  r.get('/teacher/students/:id', teacher, h((req, res) => {
    const s = assertStudentAccess(db, me(req), Number(req.params.id));
    res.json(studentDashboard(db, s.id, ctx.now()));
  }));

  // FR-ACC-08 — remove the student and delete all of their personal data
  r.delete('/teacher/students/:id', verified, h((req, res) => {
    const s = assertStudentAccess(db, me(req), Number(req.params.id));
    deleteStudent(db, s.id);
    res.json({ ok: true });
  }));

  // FR-ACC-09 — unlock immediately and reset the failed-attempt counter
  r.post('/teacher/students/:id/unlock', teacher, h((req, res) => {
    const s = assertStudentAccess(db, me(req), Number(req.params.id));
    db.prepare('DELETE FROM login_attempts WHERE student_number = ?').run(s.student_number);
    res.json({ ok: true });
  }));

  // FR-EX-07 — teacher overrides the level per exercise type
  r.put('/teacher/students/:id/levels', teacher, h((req, res) => {
    const s = assertStudentAccess(db, me(req), Number(req.params.id));
    const entries = Object.entries(req.body ?? {});
    for (const [type] of entries) if (!(EXERCISE_TYPES as readonly string[]).includes(type)) throw new HttpError(400, 'invalid_type');
    for (const [type, lvl] of entries) setLevel(db, s.id, type as ExerciseType, int(lvl, 'level', 1, 10));
    res.json({ levels: getLevels(db, s.id) });
  }));

  // FR-SUP-02..06 — teacher can set a child's reading settings (the child can too)
  r.patch('/teacher/students/:id/settings', teacher, h((req, res) => {
    const s = assertStudentAccess(db, me(req), Number(req.params.id));
    const merged = mergeSettings(getSettings(db, s.id), req.body ?? {});
    db.prepare('UPDATE students SET settings = ? WHERE id = ?').run(JSON.stringify(merged), s.id);
    res.json(merged);
  }));

  // ---------------- FR-CNT-02: teacher texts (E5) ----------------

  r.get('/teacher/texts', teacher, h((req, res) => {
    const rows = db
      .prepare("SELECT id, title, level, language, content, active, created_at AS createdAt FROM exercises WHERE teacher_id = ? AND type = 'E5' ORDER BY id DESC")
      .all(me(req)) as Array<{ content: string }>;
    res.json(rows.map((x) => ({ ...x, content: JSON.parse(x.content) })));
  }));

  r.post('/teacher/texts', verified, h((req, res) => {
    const b = req.body ?? {};
    const title = str(b.title, 'title', { max: 100 });
    const lang = language(b.language);
    const level = int(b.level, 'level', 1, 10);
    const content = validatePassage(b);
    const { lastInsertRowid } = db
      .prepare("INSERT INTO exercises (type, level, language, title, content, teacher_id) VALUES ('E5', ?, ?, ?, ?, ?)")
      .run(level, lang, title, JSON.stringify(content), me(req));
    res.status(201).json({ id: Number(lastInsertRowid) });
  }));

  // Show / hide a teacher text or E4 item (results are kept).
  r.patch('/teacher/content/:id', teacher, h((req, res) => {
    if (typeof req.body?.active !== 'boolean') throw new HttpError(400, 'invalid_active');
    const { changes } = db
      .prepare('UPDATE exercises SET active = ? WHERE id = ? AND teacher_id = ?')
      .run(req.body.active ? 1 : 0, Number(req.params.id), me(req));
    if (!changes) throw new HttpError(404, 'exercise_not_found');
    res.json({ ok: true });
  }));

  // Delete a teacher text or E4 item; E4 pictures are removed from the image host too.
  r.delete('/teacher/content/:id', teacher, h(async (req, res) => {
    const id = Number(req.params.id);
    const refs = e4ImageRefs(db, 'id = ? AND teacher_id = ?', id, me(req));
    const { changes } = db.prepare('DELETE FROM exercises WHERE id = ? AND teacher_id = ?').run(id, me(req));
    if (!changes) throw new HttpError(404, 'exercise_not_found');
    await Promise.all(refs.map((ref) => ctx.images.remove(ref)));
    res.json({ ok: true });
  }));

  // ---------------- FR-CNT-05: teacher sentence–picture items (E4) ----------------

  r.get('/teacher/e4', teacher, h((req, res) => {
    const rows = db
      .prepare("SELECT id, title, level, language, content, active, created_at AS createdAt FROM exercises WHERE teacher_id = ? AND type = 'E4' ORDER BY id DESC")
      .all(me(req)) as Array<{ content: string }>;
    res.json(
      rows.map((x) => {
        const c = JSON.parse(x.content) as { sentence: string; pictures: Array<{ url: string; label: string }> };
        return { ...x, content: { sentence: c.sentence, pictures: c.pictures.map((p) => ({ url: p.url, label: p.label })) } };
      }),
    );
  }));

  /**
   * Body: { sentence, level, language, confirmNoPeople: true, pictures: [{ image: dataURL, label }] × 3 }.
   * pictures[0] is the correct match. Everything is validated before any upload, and uploads made
   * before a failure are removed, so a rejected request never leaves a partial exercise.
   */
  r.post('/teacher/e4', verified, h(async (req, res) => {
    const b = req.body ?? {};
    const sentence = str(b.sentence, 'sentence', { max: 200 });
    const level = int(b.level, 'level', 1, 10);
    const lang = language(b.language);
    if (b.confirmNoPeople !== true) throw new HttpError(400, 'confirm_no_people');
    if (!Array.isArray(b.pictures) || b.pictures.length !== 3) throw new HttpError(400, 'three_pictures_required');
    const checked = b.pictures.map((p: { image?: unknown; label?: unknown }) => {
      if (!isValidLabel(p?.label)) throw new HttpError(400, 'invalid_label');
      const img = checkImageDataUrl(p.image);
      if (!img.ok) throw new HttpError(400, img.error);
      return { ...img, label: (p.label as string).trim().replace(/\s+/g, ' ') };
    });
    const stored: StoredImage[] = [];
    try {
      for (const c of checked) stored.push(await ctx.images.put(c.data, c.mime));
    } catch (e) {
      await Promise.all(stored.map((s) => ctx.images.remove(s.ref)));
      console.error('E4 picture upload failed', e);
      throw new HttpError(502, 'upload_failed');
    }
    const content = { sentence, pictures: stored.map((s, i) => ({ ref: s.ref, url: s.url, label: checked[i].label })) };
    const { lastInsertRowid } = db
      .prepare("INSERT INTO exercises (type, level, language, title, content, teacher_id) VALUES ('E4', ?, ?, ?, ?, ?)")
      .run(level, lang, sentence.slice(0, 100), JSON.stringify(content), me(req));
    res.status(201).json({ id: Number(lastInsertRowid) });
  }));

  // ---------------- FR-CNT-01: assignments ----------------

  r.get('/teacher/classes/:id/assignments', teacher, h((req, res) => {
    const cls = ownClass(me(req), Number(req.params.id));
    res.json(
      db
        .prepare(
          `SELECT a.id, a.type, a.level, a.exercise_id AS exerciseId, e.title AS exerciseTitle, a.due_date AS dueDate, a.created_at AS createdAt,
             (SELECT COUNT(*) FROM assignment_targets t WHERE t.assignment_id = a.id) AS targets,
             (SELECT COUNT(*) FROM assignment_targets t WHERE t.assignment_id = a.id AND t.result_id IS NOT NULL) AS done
           FROM assignments a LEFT JOIN exercises e ON e.id = a.exercise_id WHERE a.class_id = ? ORDER BY a.id DESC`,
        )
        .all(cls.id),
    );
  }));

  /** items: [{ type, level? } | { exerciseId }] — exerciseId must be this teacher's text or E4 item. */
  r.post('/teacher/classes/:id/assignments', teacher, h((req, res) => {
    const cls = ownClass(me(req), Number(req.params.id));
    const b = req.body ?? {};
    const items: Array<{ type?: string; level?: number | null; exerciseId?: number }> = Array.isArray(b.items) ? b.items : [];
    if (items.length < 1 || items.length > 10) throw new HttpError(400, 'invalid_items');
    if (b.dueDate !== undefined && b.dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.dueDate))) throw new HttpError(400, 'invalid_due_date');
    const members = (db.prepare('SELECT id FROM students WHERE class_id = ?').all(cls.id) as Array<{ id: number }>).map((m) => m.id);
    let targets = members;
    if (Array.isArray(b.studentIds) && b.studentIds.length > 0) {
      targets = b.studentIds.map(Number);
      if (!targets.every((id) => members.includes(id))) throw new HttpError(400, 'student_not_in_class');
    }
    if (targets.length === 0) throw new HttpError(400, 'no_students');
    const ids: number[] = [];
    db.exec('BEGIN');
    try {
      for (const it of items) {
        let type: string | null = null, level: number | null = null, exerciseId: number | null = null;
        if (it.exerciseId !== undefined) {
          const ex = db
            .prepare('SELECT id, type FROM exercises WHERE id = ? AND active = 1 AND teacher_id = ?')
            .get(Number(it.exerciseId), me(req)) as { id: number; type: string } | undefined;
          if (!ex) throw new HttpError(400, 'exercise_not_found');
          exerciseId = ex.id;
          type = ex.type;
        } else {
          if (!(EXERCISE_TYPES as readonly string[]).includes(String(it.type))) throw new HttpError(400, 'invalid_type');
          type = String(it.type);
          level = it.level === undefined || it.level === null ? null : int(it.level, 'level', 1, 10);
        }
        const { lastInsertRowid } = db
          .prepare('INSERT INTO assignments (teacher_id, class_id, type, level, exercise_id, due_date) VALUES (?, ?, ?, ?, ?, ?)')
          .run(me(req), cls.id, type, level, exerciseId, b.dueDate ?? null);
        const ins = db.prepare('INSERT INTO assignment_targets (assignment_id, student_id) VALUES (?, ?)');
        for (const s of targets) ins.run(lastInsertRowid, s);
        ids.push(Number(lastInsertRowid));
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.status(201).json({ ids });
  }));

  r.delete('/teacher/assignments/:id', teacher, h((req, res) => {
    const { changes } = db.prepare('DELETE FROM assignments WHERE id = ? AND teacher_id = ?').run(Number(req.params.id), me(req));
    if (!changes) throw new HttpError(404, 'assignment_not_found');
    res.json({ ok: true });
  }));

  // ---------------- DR-04: delete the teacher account (password re-entry required) ----------------

  r.delete('/teacher/account', teacher, h(async (req, res) => {
    const row = db.prepare('SELECT password_hash FROM teachers WHERE id = ?').get(me(req)) as { password_hash: string };
    if (typeof req.body?.password !== 'string' || !verify(req.body.password, row.password_hash)) throw new HttpError(401, 'invalid_credentials');
    await deleteTeacher(ctx, me(req));
    endSession(ctx, req, res);
    res.json({ ok: true });
  }));

  return r;
}
