import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { DB } from './db.js';
import type { ImageStore } from './images.js';
import { CHILD_IDLE_MS, TEACHER_IDLE_MS } from './domain/rules.js';

export interface Mailer {
  send(to: string, subject: string, body: string): void;
}

/** Development mailer: stores mail in the outbox table (viewable at /dev/outbox) and logs it. */
export function outboxMailer(db: DB, log = process.env.NODE_ENV !== 'test'): Mailer {
  return {
    send(to, subject, body) {
      db.prepare('INSERT INTO outbox (to_addr, subject, body) VALUES (?, ?, ?)').run(to, subject, body);
      if (log) console.log(`[mail] to=${to} subject="${subject}"\n${body}\n`);
    },
  };
}

export interface Ctx {
  db: DB;
  mailer: Mailer;
  images: ImageStore;
  baseUrl: string;
  now: () => number;
}

export interface Teacher {
  id: number;
  email: string;
  name: string;
  email_verified: number;
}

export interface Auth {
  token: string;
  teacher?: Teacher;
  studentId?: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: Auth;
  }
}

export const SESSION_COOKIE = 'rb_session';

export const newToken = () => randomBytes(32).toString('base64url');

export function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setCookie(res: Response, name: string, value: string, maxAgeS?: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const age = maxAgeS === undefined ? '' : `; Max-Age=${maxAgeS}`;
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict${age}${secure}`);
}

export function startSession(ctx: Ctx, req: Request, res: Response, who: { teacherId?: number; studentId?: number }) {
  // One session per browser: signing in replaces whoever was signed in before (shared classroom devices).
  const old = parseCookies(req)[SESSION_COOKIE];
  if (old) ctx.db.prepare('DELETE FROM sessions WHERE token = ?').run(old);
  const token = newToken();
  ctx.db
    .prepare('INSERT INTO sessions (token, teacher_id, student_id, kind, last_seen) VALUES (?, ?, ?, ?, ?)')
    .run(token, who.teacherId ?? null, who.studentId ?? null, who.studentId ? 'child' : 'teacher', ctx.now());
  setCookie(res, SESSION_COOKIE, token);
  return token;
}

export function endSession(ctx: Ctx, req: Request, res: Response) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) ctx.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  setCookie(res, SESSION_COOKIE, '', 0);
}

/** Loads the session and enforces idle timeouts (FR-ACC-06). */
export function sessionMiddleware(ctx: Ctx): RequestHandler {
  return (req, _res, next) => {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return next();
    const s = ctx.db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) as
      | { teacher_id: number | null; student_id: number | null; kind: string; last_seen: number }
      | undefined;
    if (!s) return next();
    const idle = s.kind === 'child' ? CHILD_IDLE_MS : TEACHER_IDLE_MS;
    if (ctx.now() - s.last_seen > idle) {
      ctx.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return next();
    }
    // Background polling (e.g. /api/auth/me) must not count as interaction.
    if (req.get('X-Activity') !== 'passive') {
      ctx.db.prepare('UPDATE sessions SET last_seen = ? WHERE token = ?').run(ctx.now(), token);
    }
    if (s.kind === 'child') req.auth = { token, studentId: s.student_id! };
    else {
      const teacher = ctx.db.prepare('SELECT id, email, name, email_verified FROM teachers WHERE id = ?').get(s.teacher_id) as
        | Teacher
        | undefined;
      if (teacher) req.auth = { token, teacher };
    }
    next();
  };
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

/** NFR-SEC-04 — teacher-only routes. */
export const requireTeacher: RequestHandler = (req, _res, next) => {
  if (!req.auth?.teacher) return next(new HttpError(401, 'not_logged_in'));
  next();
};

/** FR-ACC-02 — classes and students can be managed only after the e-mail address is verified. */
export const requireVerifiedTeacher: RequestHandler = (req, _res, next) => {
  const t = req.auth?.teacher;
  if (!t) return next(new HttpError(401, 'not_logged_in'));
  if (!t.email_verified) return next(new HttpError(403, 'email_not_verified'));
  next();
};

export const requireChild: RequestHandler = (req, _res, next) => {
  if (!req.auth?.studentId) return next(new HttpError(401, 'not_logged_in'));
  next();
};

/** Wrap a sync/async handler so thrown errors reach the error middleware. */
export const h =
  (fn: (req: Request, res: Response) => unknown): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = fn(req, res);
      if (r instanceof Promise) r.catch(next);
    } catch (e) {
      next(e);
    }
  };

export const iso = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);

/** Small validation helpers. */
export function str(v: unknown, field: string, { min = 1, max = 200 } = {}): string {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) throw new HttpError(400, 'invalid_' + field);
  return v.trim();
}
export function int(v: unknown, field: string, min: number, max: number): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw new HttpError(400, 'invalid_' + field);
  return n;
}
export function language(v: unknown): 'en' | 'fi' {
  if (v !== 'en' && v !== 'fi') throw new HttpError(400, 'invalid_language');
  return v;
}
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
