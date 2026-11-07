import express, { type ErrorRequestHandler } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type Ctx, HttpError, sessionMiddleware } from './context.js';
import { RuleError } from './domain/rules.js';
import { authRoutes } from './routes/auth.js';
import { teacherRoutes } from './routes/teacher.js';
import { imageRoutes, studentRoutes } from './routes/student.js';

export function createApp(ctx: Ctx, opts: { staticDir?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'",
    );
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });

  app.use(express.json({ limit: '200kb' }));
  app.use(sessionMiddleware(ctx));

  const api = express.Router();
  api.use(authRoutes(ctx));
  api.use(teacherRoutes(ctx));
  api.use(studentRoutes(ctx));
  api.use(imageRoutes(ctx));
  api.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', api);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not_found')));

  if (opts.staticDir && existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(opts.staticDir!, 'index.html')));
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
    if (err instanceof RuleError) return res.status(400).json({ error: err.message });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'file_too_large' });
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  };
  app.use(onError);
  return app;
}
