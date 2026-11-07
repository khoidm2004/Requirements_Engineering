import express, { type ErrorRequestHandler } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type Ctx, HttpError, sessionMiddleware } from './context.js';
import { RuleError } from './domain/rules.js';
import { authRoutes } from './routes/auth.js';
import { teacherRoutes } from './routes/teacher.js';
import { childRoutes } from './routes/child.js';

export function createApp(ctx: Ctx, opts: { staticDir?: string; mediaDir?: string; devTools?: boolean } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers. No third-party scripts, analytics or tracking (NFR-PRV-03); pictures may come
  // from the E4 image host (FR-CNT-05).
  const imgSrc = ["'self'", 'data:', ctx.images.origin].filter(Boolean).join(' ');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; img-src ${imgSrc}; style-src 'self' 'unsafe-inline'; font-src 'self'; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'`,
    );
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });

  app.use(sessionMiddleware(ctx));
  // E4 uploads carry three pictures of up to 2 MB each as data URLs; only signed-in teachers get the
  // larger body limit. Everything else is limited to 100 kB.
  app.post('/api/teacher/e4', (req, _res, next) => next(req.auth?.teacher ? undefined : new HttpError(401, 'not_logged_in')));
  app.use('/api/teacher/e4', express.json({ limit: '9mb' }));
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use(authRoutes(ctx));
  api.use(teacherRoutes(ctx));
  api.use(childRoutes(ctx));
  api.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', api);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not_found')));

  if (opts.mediaDir) app.use('/media', express.static(opts.mediaDir, { maxAge: '7d', index: false, fallthrough: false }));

  if (opts.devTools) {
    // Development only: read the mail outbox (verification and reset links).
    app.get('/dev/outbox', (_req, res) => {
      res.json(ctx.db.prepare('SELECT * FROM outbox ORDER BY id DESC LIMIT 50').all());
    });
  }

  if (opts.staticDir && existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir, { maxAge: '1h', index: false }));
    app.get(/^(?!\/(api|media)\/).*/, (_req, res) => res.sendFile(join(opts.staticDir!, 'index.html')));
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
    if (err instanceof RuleError) return res.status(400).json({ error: err.message });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
    if (err?.status === 404 || err?.statusCode === 404) return res.status(404).end();
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  };
  app.use(onError);
  return app;
}
