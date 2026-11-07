import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { type Ctx, EMAIL_RE, HttpError, endSession, failureLimiter, h, startSession, str } from '../context.js';
import { checkPassword, normaliseName, parseSettings } from '../domain/rules.js';

const LOGIN_MAX_FAILS = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

export function authRoutes(ctx: Ctx) {
  const r = Router();
  const limiter = failureLimiter(LOGIN_MAX_FAILS, LOGIN_WINDOW_MS, ctx.now);
  const ipKey = (ip: string | undefined, kind: string) => `${kind}:${ip ?? '?'}`;

  r.get('/auth/me', h((req, res) => {
    const a = req.auth;
    if (a?.teacherId) {
      const t = ctx.db.prepare('SELECT id, name, email FROM teachers WHERE id = ?').get(a.teacherId);
      if (t) return res.json({ kind: 'teacher', teacher: t });
    }
    if (a?.studentId) {
      const s = ctx.db
        .prepare(
          `SELECT s.id, s.name, s.student_number AS number, s.points, s.settings, c.name AS className
             FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ?`,
        )
        .get(a.studentId) as { settings: string } | undefined;
      if (s) return res.json({ kind: 'student', student: { ...s, settings: parseSettings(s.settings) } });
    }
    res.json({ kind: null });
  }));

  // Spec B does not say how teachers get accounts: open self-registration (assumption, architecture §3).
  r.post('/auth/teacher/register', h(async (req, res) => {
    const email = str(req.body?.email, 'email', { max: 200 }).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'invalid_email');
    const name = str(req.body?.name, 'name', { max: 100 });
    const password = checkPassword(req.body?.password);
    if (ctx.db.prepare('SELECT 1 FROM teachers WHERE email = ?').get(email)) throw new HttpError(409, 'email_taken');
    const hash = await bcrypt.hash(password, 10);
    const { lastInsertRowid } = ctx.db
      .prepare('INSERT INTO teachers (email, name, password_hash) VALUES (?, ?, ?)')
      .run(email, name, hash);
    startSession(ctx, res, { teacherId: Number(lastInsertRowid) });
    res.status(201).json({ ok: true });
  }));

  r.post('/auth/teacher/login', h(async (req, res) => {
    const key = ipKey(req.ip, 'teacher');
    if (limiter.blocked(key)) throw new HttpError(429, 'too_many_attempts');
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const t = ctx.db.prepare('SELECT id, password_hash FROM teachers WHERE email = ?').get(email) as
      | { id: number; password_hash: string }
      | undefined;
    if (!t || !(await bcrypt.compare(password, t.password_hash))) {
      limiter.fail(key);
      throw new HttpError(401, 'wrong_login');
    }
    limiter.reset(key);
    ctx.db.prepare("UPDATE teachers SET last_login_at = datetime('now') WHERE id = ?").run(t.id);
    startSession(ctx, res, { teacherId: t.id });
    res.json({ ok: true });
  }));

  // Req 4: kids sign in with their student number and name.
  r.post('/auth/student/login', h((req, res) => {
    const key = ipKey(req.ip, 'student');
    if (limiter.blocked(key)) throw new HttpError(429, 'too_many_attempts');
    const number = String(req.body?.number ?? '').trim();
    const name = String(req.body?.name ?? '');
    const s = ctx.db.prepare('SELECT id, name FROM students WHERE student_number = ?').get(number) as
      | { id: number; name: string }
      | undefined;
    if (!s || normaliseName(s.name) !== normaliseName(name)) {
      limiter.fail(key);
      throw new HttpError(401, 'wrong_login');
    }
    limiter.reset(key);
    ctx.db.prepare("UPDATE students SET last_login_at = datetime('now') WHERE id = ?").run(s.id);
    startSession(ctx, res, { studentId: s.id });
    res.json({ ok: true });
  }));

  r.post('/auth/logout', h((req, res) => {
    endSession(ctx, req, res);
    res.json({ ok: true });
  }));

  return r;
}
