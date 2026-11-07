import { Router } from 'express';
import { type Ctx, h, HttpError, requireChild, int } from '../context.js';
import { MAX_ITEMS, mergeSettings, RESUME_WINDOW_MS } from '../domain/rules.js';
import { canStudentOpen, getLevels, getSettings, loadExerciseForStudent, recordResult, todaysPractice } from '../services.js';

/** Child-facing API. A child sees only their own data (NFR-SEC-04, FR-MOT-03). */
export function childRoutes(ctx: Ctx) {
  const r = Router();
  const { db } = ctx;
  r.use('/child', requireChild);

  r.get('/child/me', h((req, res) => {
    const id = req.auth!.studentId!;
    const s = db.prepare('SELECT id, name, language, stars FROM students WHERE id = ?').get(id);
    res.json({ ...s, settings: getSettings(db, id), levels: getLevels(db, id) });
  }));

  // FR-SUP-02..06 — the child changes their own reading settings
  r.patch('/child/settings', h((req, res) => {
    const id = req.auth!.studentId!;
    const merged = mergeSettings(getSettings(db, id), req.body ?? {});
    db.prepare('UPDATE students SET settings = ? WHERE id = ?').run(JSON.stringify(merged), id);
    res.json(merged);
  }));

  // FR-EX-10
  r.get('/child/today', h((req, res) => {
    res.json(todaysPractice(db, req.auth!.studentId!, ctx.now()));
  }));

  // FR-EX-08 — returns saved progress (resume from the same item within 24 h)
  r.get('/child/exercises/:id', h((req, res) => {
    res.json(loadExerciseForStudent(db, req.auth!.studentId!, Number(req.params.id), ctx.now(), RESUME_WINDOW_MS));
  }));

  r.put('/child/exercises/:id/progress', h((req, res) => {
    const studentId = req.auth!.studentId!;
    const id = Number(req.params.id);
    if (!canStudentOpen(db, studentId, id)) throw new HttpError(404, 'exercise_not_found');
    const state = JSON.stringify(req.body ?? {});
    if (state.length > 20_000) throw new HttpError(413, 'too_large');
    db.prepare('INSERT OR REPLACE INTO progress (student_id, exercise_id, state, updated_at) VALUES (?, ?, ?, ?)').run(studentId, id, state, ctx.now());
    res.json({ ok: true });
  }));

  // FR-PRG-01 — record a completed exercise
  r.post('/child/results', h((req, res) => {
    const b = req.body ?? {};
    const out = recordResult(db, req.auth!.studentId!, {
      exerciseId: int(b.exerciseId, 'exerciseId', 1, Number.MAX_SAFE_INTEGER),
      items: int(b.items, 'items', 1, MAX_ITEMS),
      correct: int(b.correct, 'correct', 0, MAX_ITEMS),
      durationS: int(b.durationS, 'durationS', 0, 24 * 3600),
      clientId: typeof b.clientId === 'string' && b.clientId.length <= 64 ? b.clientId : undefined,
    }, ctx.now());
    res.status(201).json(out);
  }));

  return r;
}
