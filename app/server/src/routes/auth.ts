import { Router } from 'express';
import { type Ctx, h, HttpError, str, EMAIL_RE, newToken, iso, startSession, endSession, requireTeacher } from '../context.js';
import { checkTeacherPassword, hash, verify } from '../domain/passwords.js';
import {
  LOCK_MINUTES, MAX_FAILED_ATTEMPTS, RESET_TOKEN_HOURS, VERIFY_TOKEN_HOURS, normalizeName, normalizeStudentNumber,
} from '../domain/rules.js';
import { getSettings, lockedUntil } from '../services.js';

export function authRoutes(ctx: Ctx) {
  const r = Router();
  const { db } = ctx;
  const HOUR = 3600_000;

  function sendVerification(teacherId: number, email: string) {
    const token = newToken();
    db.prepare("INSERT INTO tokens (token, teacher_id, type, expires_at) VALUES (?, ?, 'verify', ?)").run(
      token, teacherId, iso(ctx.now() + VERIFY_TOKEN_HOURS * HOUR),
    );
    ctx.mailer.send(
      email,
      'ReadBuddy: verify your e-mail address',
      `Welcome to ReadBuddy!\n\nPlease verify your e-mail address by opening this link within ${VERIFY_TOKEN_HOURS} hours:\n${ctx.baseUrl}/verify?token=${token}\n`,
    );
  }

  function consumeToken(token: unknown, type: 'verify' | 'reset') {
    if (typeof token !== 'string') throw new HttpError(400, 'invalid_token');
    const t = db.prepare('SELECT * FROM tokens WHERE token = ? AND type = ?').get(token, type) as
      | { teacher_id: number; expires_at: string; used: number }
      | undefined;
    if (!t || t.used || t.expires_at < iso(ctx.now())) throw new HttpError(400, 'invalid_or_expired_token');
    db.prepare('UPDATE tokens SET used = 1 WHERE token = ?').run(token);
    return t.teacher_id;
  }

  // FR-ACC-01 — teacher registration (account starts unverified)
  r.post('/auth/register', h((req, res) => {
    const { email, password, name } = req.body ?? {};
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) throw new HttpError(400, 'invalid_email');
    const pwErr = checkTeacherPassword(password);
    if (pwErr) throw new HttpError(400, 'password_' + pwErr);
    const teacherName = str(name, 'name', { max: 100 });
    if (db.prepare('SELECT 1 FROM teachers WHERE email = ?').get(email.trim())) throw new HttpError(409, 'email_in_use');
    const { lastInsertRowid } = db
      .prepare('INSERT INTO teachers (email, password_hash, name) VALUES (?, ?, ?)')
      .run(email.trim(), hash(password), teacherName);
    sendVerification(Number(lastInsertRowid), email.trim());
    res.status(201).json({ ok: true });
  }));

  // FR-ACC-02 — e-mail verification (link valid 24 h)
  r.post('/auth/verify', h((req, res) => {
    const teacherId = consumeToken(req.body?.token, 'verify');
    db.prepare('UPDATE teachers SET email_verified = 1 WHERE id = ?').run(teacherId);
    res.json({ ok: true });
  }));

  r.post('/auth/resend-verification', requireTeacher, h((req, res) => {
    const t = req.auth!.teacher!;
    if (!t.email_verified) sendVerification(t.id, t.email);
    res.json({ ok: true });
  }));

  // FR-ACC-00 — teacher form on the home page. Unverified teachers may sign in; FR-ACC-02 limits what they can do.
  r.post('/auth/teacher-login', h((req, res) => {
    const { email, password } = req.body ?? {};
    const t = db.prepare('SELECT id, password_hash FROM teachers WHERE email = ?').get(String(email ?? '').trim()) as
      | { id: number; password_hash: string }
      | undefined;
    if (!t || typeof password !== 'string' || !verify(password, t.password_hash)) throw new HttpError(401, 'invalid_credentials');
    startSession(ctx, req, res, { teacherId: t.id });
    res.json({ ok: true });
  }));

  /**
   * FR-ACC-05 — child login with student number + name (name case-insensitive).
   * NFR-SEC-06 — one generic error whichever field is wrong, and failures are counted per typed
   * student number even when it does not exist, so neither the error nor the lockout reveals
   * whether a number is enrolled.
   */
  r.post('/auth/student-login', h((req, res) => {
    const number = normalizeStudentNumber(req.body?.studentNumber);
    const name = typeof req.body?.name === 'string' ? normalizeName(req.body.name) : '';
    if (!number || !name) throw new HttpError(401, 'invalid_login');
    const now = ctx.now();
    if (lockedUntil(db, number, now)) throw new HttpError(423, 'locked');
    const s = db.prepare('SELECT id, name FROM students WHERE student_number = ?').get(number) as { id: number; name: string } | undefined;
    if (!s || normalizeName(s.name) !== name) {
      const prev = db.prepare('SELECT failed, locked_until FROM login_attempts WHERE student_number = ?').get(number) as
        | { failed: number; locked_until: string | null }
        | undefined;
      // A lock that has expired starts a fresh count.
      const fails = (prev && !prev.locked_until ? prev.failed : 0) + 1;
      const lock = fails >= MAX_FAILED_ATTEMPTS ? iso(now + LOCK_MINUTES * 60_000) : null;
      db.prepare(
        `INSERT INTO login_attempts (student_number, failed, locked_until, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(student_number) DO UPDATE SET failed = excluded.failed, locked_until = excluded.locked_until, updated_at = excluded.updated_at`,
      ).run(number, lock ? 0 : fails, lock, now);
      if (lock) throw new HttpError(423, 'locked');
      throw new HttpError(401, 'invalid_login');
    }
    db.prepare('DELETE FROM login_attempts WHERE student_number = ?').run(number);
    db.prepare('UPDATE students SET last_login_at = ?, inactivity_notified_at = NULL WHERE id = ?').run(iso(now), s.id);
    startSession(ctx, req, res, { studentId: s.id });
    res.json({ ok: true });
  }));

  r.post('/auth/logout', h((req, res) => {
    endSession(ctx, req, res);
    res.json({ ok: true });
  }));

  r.get('/auth/me', h((req, res) => {
    const a = req.auth;
    if (a?.teacher) return res.json({ kind: 'teacher', teacher: { ...a.teacher, email_verified: !!a.teacher.email_verified } });
    if (a?.studentId) {
      const s = db.prepare('SELECT id, name, language FROM students WHERE id = ?').get(a.studentId) as Record<string, unknown>;
      return res.json({ kind: 'child', child: { ...s, settings: getSettings(db, a.studentId) } });
    }
    res.json({ kind: 'none' });
  }));

  // FR-ACC-07 — password reset via single-use link valid 1 h, to a verified address only.
  r.post('/auth/forgot', h((req, res) => {
    const email = String(req.body?.email ?? '').trim();
    const t = db.prepare('SELECT id, email FROM teachers WHERE email = ? AND email_verified = 1').get(email) as
      | { id: number; email: string }
      | undefined;
    if (t) {
      const token = newToken();
      db.prepare("INSERT INTO tokens (token, teacher_id, type, expires_at) VALUES (?, ?, 'reset', ?)").run(
        token, t.id, iso(ctx.now() + RESET_TOKEN_HOURS * HOUR),
      );
      ctx.mailer.send(
        t.email,
        'ReadBuddy: reset your password',
        `Open this link within ${RESET_TOKEN_HOURS} hour to choose a new password. The link can be used once.\n${ctx.baseUrl}/reset?token=${token}\n\nIf you did not ask for this, you can ignore this message.`,
      );
    }
    res.json({ ok: true }); // same answer whether or not the address exists
  }));

  r.post('/auth/reset', h((req, res) => {
    const pwErr = checkTeacherPassword(req.body?.password);
    if (pwErr) throw new HttpError(400, 'password_' + pwErr);
    const teacherId = consumeToken(req.body?.token, 'reset');
    db.prepare('UPDATE teachers SET password_hash = ? WHERE id = ?').run(hash(req.body.password), teacherId);
    db.prepare('DELETE FROM sessions WHERE teacher_id = ?').run(teacherId);
    res.json({ ok: true });
  }));

  return r;
}
