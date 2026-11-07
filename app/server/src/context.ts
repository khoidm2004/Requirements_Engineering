import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { DB } from './db.js';
import type { Storage } from './storage.js';

export interface Ctx {
  db: DB;
  storage: Storage;
  now: () => number;
}

export interface Auth {
  token: string;
  teacherId?: number;
  studentId?: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: Auth;
  }
}

export const SESSION_COOKIE = 'rb_session';
/** Sessions end after 8 hours without activity. */
export const SESSION_IDLE_MS = 8 * 3600 * 1000;

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setCookie(res: Response, value: string, maxAgeS?: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const age = maxAgeS === undefined ? '' : `; Max-Age=${maxAgeS}`;
  res.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict${age}${secure}`);
}

export function startSession(ctx: Ctx, res: Response, who: { teacherId?: number; studentId?: number }) {
  const token = randomBytes(32).toString('base64url');
  const now = ctx.now();
  ctx.db
    .prepare('INSERT INTO sessions (token, teacher_id, student_id, created_at, last_seen) VALUES (?, ?, ?, ?, ?)')
    .run(token, who.teacherId ?? null, who.studentId ?? null, now, now);
  setCookie(res, token);
}

export function endSession(ctx: Ctx, req: Request, res: Response) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) ctx.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  setCookie(res, '', 0);
}

export function sessionMiddleware(ctx: Ctx): RequestHandler {
  return (req, _res, next) => {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return next();
    const s = ctx.db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) as
      | { teacher_id: number | null; student_id: number | null; last_seen: number }
      | undefined;
    if (!s) return next();
    if (ctx.now() - s.last_seen > SESSION_IDLE_MS) {
      ctx.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return next();
    }
    ctx.db.prepare('UPDATE sessions SET last_seen = ? WHERE token = ?').run(ctx.now(), token);
    req.auth = { token, teacherId: s.teacher_id ?? undefined, studentId: s.student_id ?? undefined };
    next();
  };
}

export const requireTeacher: RequestHandler = (req, _res, next) =>
  next(req.auth?.teacherId ? undefined : new HttpError(401, 'not_logged_in'));

export const requireStudent: RequestHandler = (req, _res, next) =>
  next(req.auth?.studentId ? undefined : new HttpError(401, 'not_logged_in'));

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

/**
 * Small in-memory limiter for login attempts (kid login is only number + name, so
 * guessing has to be slowed down). Counts failures per key within a window.
 */
export function failureLimiter(max: number, windowMs: number, now: () => number) {
  const hits = new Map<string, number[]>();
  const recent = (key: string) => (hits.get(key) ?? []).filter((t) => now() - t < windowMs);
  return {
    blocked: (key: string) => recent(key).length >= max,
    fail: (key: string) => hits.set(key, [...recent(key), now()]),
    reset: (key: string) => hits.delete(key),
  };
}

// ---------- Validation helpers ----------

export function str(v: unknown, field: string, { min = 1, max = 200 } = {}): string {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) throw new HttpError(400, 'invalid_' + field);
  return v.trim();
}

export function int(v: unknown, field: string, min: number, max: number): number {
  const n = typeof v === 'string' && v !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw new HttpError(400, 'invalid_' + field);
  return n;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
