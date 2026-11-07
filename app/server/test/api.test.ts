import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb, type DB } from '../src/db.js';
import { createApp } from '../src/app.js';
import { outboxMailer, type Ctx } from '../src/context.js';
import { seedContent } from '../src/content/seed.js';
import { runDailyJobs } from '../src/jobs.js';
import type { ImageStore } from '../src/images.js';

const PW = 'correct-horse-battery';
type Agent = ReturnType<typeof request.agent>;

let db: DB;
let clock: number;
let ctx: Ctx;
let app: ReturnType<typeof createApp>;
let stored: string[];
let removed: string[];
let failUploadAfter: number;

/** In-memory stand-in for the image host (FR-CNT-05, A-6). */
function memoryImages(): ImageStore {
  return {
    origin: null,
    async put() {
      if (stored.length >= failUploadAfter) throw new Error('host down');
      const ref = `img${stored.length + 1}`;
      stored.push(ref);
      return { ref, url: `/media/${ref}.png` };
    },
    async remove(ref) {
      removed.push(ref);
    },
  };
}

beforeEach(() => {
  db = openDb();
  seedContent(db);
  clock = Date.parse('2026-11-02T10:00:00Z');
  stored = [];
  removed = [];
  failUploadAfter = Infinity;
  ctx = { db, mailer: outboxMailer(db, false), images: memoryImages(), baseUrl: 'http://test', now: () => clock };
  app = createApp(ctx);
});

const lastMailToken = () => {
  const m = db.prepare('SELECT body FROM outbox ORDER BY id DESC LIMIT 1').get() as { body: string };
  return /token=([\w-]+)/.exec(m.body)![1];
};

async function teacher(email = 'teacher@example.com', { verify = true } = {}) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: PW, name: 'Ms Virtanen' }).expect(201);
  if (verify) await agent.post('/api/auth/verify').send({ token: lastMailToken() }).expect(200);
  await agent.post('/api/auth/teacher-login').send({ email, password: PW }).expect(200);
  return agent;
}

async function newClass(t: Agent, name = '2B') {
  return (await t.post('/api/teacher/classes').send({ name }).expect(201)).body as { id: number; code: string };
}

function enrol(t: Agent, classId: number, over: Record<string, unknown> = {}) {
  return t.post(`/api/teacher/classes/${classId}/students`).send({ name: 'Mia Korhonen', studentNumber: 'S100', language: 'en', birthYear: 2019, ...over });
}

/** A teacher with one class and one enrolled student, plus a signed-in child agent. */
async function setup(over: Record<string, unknown> = {}) {
  const t = await teacher();
  const cls = await newClass(t);
  const { id: studentId } = (await enrol(t, cls.id, over).expect(201)).body;
  const child = request.agent(app);
  await child.post('/api/auth/student-login').send({ studentNumber: over.studentNumber ?? 'S100', name: over.name ?? 'Mia Korhonen' }).expect(200);
  return { t, cls, studentId, child };
}

const PNG = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]).toString('base64');
const e4Body = (over: Record<string, unknown> = {}) => ({
  sentence: 'The cat sits in the box.',
  level: 1,
  language: 'en',
  confirmNoPeople: true,
  pictures: [
    { image: PNG, label: 'a cat in a box' },
    { image: PNG, label: 'a dog in a box' },
    { image: PNG, label: 'a cat on a bed' },
  ],
  ...over,
});

/** Completes one exercise of each type with full accuracy, so these types drop out of "lowest accuracy". */
async function practise(agent: Agent, types: string[]) {
  for (const type of types) {
    const id = (db.prepare("SELECT id FROM exercises WHERE type = ? AND level = 1 AND language = 'en' AND seed_key IS NOT NULL").get(type) as { id: number }).id;
    await complete(agent, id, 5, 5);
  }
}

const complete = (agent: Agent, exerciseId: number, correct: number, items = 10, clientId?: string) =>
  agent.post('/api/child/results').send({ exerciseId, items, correct, durationS: 120, clientId }).expect(201);

describe('accounts and authentication', () => {
  it('FR-ACC-00: one API for both roles; the session reports the role for navigation', async () => {
    const { t, child } = await setup();
    expect((await t.get('/api/auth/me')).body).toMatchObject({ kind: 'teacher', teacher: { name: 'Ms Virtanen', email_verified: true } });
    expect((await child.get('/api/auth/me')).body).toMatchObject({ kind: 'child', child: { name: 'Mia Korhonen', language: 'en' } });
    expect((await request(app).get('/api/auth/me')).body).toEqual({ kind: 'none' });
  });

  it('FR-ACC-01: registration creates an unverified account and sends a verification e-mail', async () => {
    await request(app).post('/api/auth/register').send({ email: 'a@b.fi', password: PW, name: 'Anna' }).expect(201);
    expect(db.prepare('SELECT email_verified FROM teachers').get()).toEqual({ email_verified: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM outbox').get()).toEqual({ n: 1 });
    expect((await request(app).post('/api/auth/register').send({ email: 'A@b.fi', password: PW, name: 'Anna' })).body.error).toBe('email_in_use');
    expect((await request(app).post('/api/auth/register').send({ email: 'x@b.fi', password: PW })).body.error).toBe('invalid_name');
  });

  it('NFR-SEC-02/03: passwords are bcrypt-hashed; short and breached passwords are rejected', async () => {
    expect((await request(app).post('/api/auth/register').send({ email: 'a@b.fi', password: 'short', name: 'A' })).body.error).toBe('password_too_short');
    expect((await request(app).post('/api/auth/register').send({ email: 'a@b.fi', password: 'password123', name: 'A' })).body.error).toBe('password_breached');
    await request(app).post('/api/auth/register').send({ email: 'a@b.fi', password: PW, name: 'A' });
    const { password_hash } = db.prepare('SELECT password_hash FROM teachers').get() as { password_hash: string };
    expect(password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('FR-ACC-02: an unverified teacher cannot create classes; the link expires after 24 h', async () => {
    const t = await teacher('u@e.fi', { verify: false });
    const token = lastMailToken();
    expect((await t.post('/api/teacher/classes').send({ name: '1A' })).body.error).toBe('email_not_verified');
    clock += 25 * 3600_000;
    expect((await t.post('/api/auth/verify').send({ token })).body.error).toBe('invalid_or_expired_token');
    await t.post('/api/auth/teacher-login').send({ email: 'u@e.fi', password: PW }).expect(200);
    await t.post('/api/auth/resend-verification').expect(200);
    await t.post('/api/auth/verify').send({ token: lastMailToken() }).expect(200);
    await t.post('/api/auth/teacher-login').send({ email: 'u@e.fi', password: PW }).expect(200);
    await t.post('/api/teacher/classes').send({ name: '1A' }).expect(201);
  });

  it('FR-ACC-03: classes get unique 6-character codes', async () => {
    const t = await teacher();
    const codes = new Set<string>();
    for (let i = 0; i < 10; i++) codes.add((await newClass(t, `C${i}`)).code);
    expect(codes.size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[A-Z2-9]{6}$/);
    expect((await t.post('/api/teacher/classes').send({ name: 'C11' })).body.error).toBe('max_classes');
  });

  it('FR-ACC-04 / FR-EX-07: enrolment with name, number, language, birth year; duplicates rejected; level from age', async () => {
    const t = await teacher();
    const cls = await newClass(t);
    await enrol(t, cls.id, { birthYear: 2016 }).expect(201); // age 10 → level 5
    const dup = await enrol(t, cls.id, { studentNumber: ' s100 ', name: 'Other' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('student_number_in_use');
    expect((await enrol(t, cls.id, { studentNumber: 'S2', language: 'sv' })).body.error).toBe('invalid_language');
    expect((await enrol(t, cls.id, { studentNumber: 'S3', birthYear: 1990 })).body.error).toBe('invalid_birth_year');
    const roster = (await t.get(`/api/teacher/classes/${cls.id}/overview`)).body.students;
    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({ name: 'Mia Korhonen', studentNumber: 'S100', levels: { E1: 5, E5: 5 } });
  });

  it('FR-ACC-05: child signs in with student number + name, name case-insensitive', async () => {
    await setup();
    const a = request.agent(app);
    await a.post('/api/auth/student-login').send({ studentNumber: 's100', name: '  mia  KORHONEN ' }).expect(200);
    expect((await a.get('/api/child/me')).body.name).toBe('Mia Korhonen');
  });

  it('FR-ACC-05 / NFR-SEC-06: the same generic error whether the number or the name is wrong', async () => {
    await setup();
    const wrongName = await request(app).post('/api/auth/student-login').send({ studentNumber: 'S100', name: 'Mira' });
    const unknownNumber = await request(app).post('/api/auth/student-login').send({ studentNumber: 'S999', name: 'Mia Korhonen' });
    expect(wrongName.status).toBe(401);
    expect(unknownNumber.status).toBe(401);
    expect(wrongName.body).toEqual(unknownNumber.body);
    expect(wrongName.body).toEqual({ error: 'invalid_login' });
  });

  it('FR-ACC-05: 5 failures lock the number for 5 minutes; unknown numbers lock the same way (NFR-SEC-06)', async () => {
    await setup();
    for (const number of ['S100', 'NOPE1']) {
      for (let i = 0; i < 4; i++) expect((await request(app).post('/api/auth/student-login').send({ studentNumber: number, name: 'x' })).status).toBe(401);
      expect((await request(app).post('/api/auth/student-login').send({ studentNumber: number, name: 'x' })).status).toBe(423);
    }
    // Locked even with the right name …
    expect((await request(app).post('/api/auth/student-login').send({ studentNumber: 'S100', name: 'Mia Korhonen' })).status).toBe(423);
    // … until 5 minutes have passed.
    clock += 5 * 60_000 + 1000;
    await request(app).post('/api/auth/student-login').send({ studentNumber: 'S100', name: 'Mia Korhonen' }).expect(200);
  });

  it('FR-ACC-09: the roster marks locked students and the teacher can unlock at once (counter reset)', async () => {
    const { t, cls, studentId } = await setup();
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/student-login').send({ studentNumber: 'S100', name: 'x' });
    expect((await t.get(`/api/teacher/classes/${cls.id}/overview`)).body.students[0].locked).toBe(true);
    expect((await t.get(`/api/teacher/students/${studentId}`)).body.student.locked).toBe(true);
    await t.post(`/api/teacher/students/${studentId}/unlock`).expect(200);
    expect((await t.get(`/api/teacher/classes/${cls.id}/overview`)).body.students[0].locked).toBe(false);
    expect(db.prepare('SELECT COUNT(*) AS n FROM login_attempts').get()).toEqual({ n: 0 });
    await request(app).post('/api/auth/student-login').send({ studentNumber: 'S100', name: 'Mia Korhonen' }).expect(200);
  });

  it('FR-ACC-06: child session expires after 20 min idle, teacher after 30 min', async () => {
    const { t, child } = await setup();
    clock += 19 * 60_000;
    await child.get('/api/child/me').expect(200);
    clock += 21 * 60_000;
    await child.get('/api/child/me').expect(401);
    clock += 0;
    const t2 = await teacher('t2@e.fi');
    clock += 29 * 60_000;
    await t2.get('/api/teacher/classes').expect(200);
    clock += 31 * 60_000;
    await t2.get('/api/teacher/classes').expect(401);
    await t.get('/api/teacher/classes').expect(401);
  });

  it('passive polling does not keep a session alive', async () => {
    const { child } = await setup();
    clock += 15 * 60_000;
    await child.get('/api/auth/me').set('X-Activity', 'passive').expect(200);
    clock += 6 * 60_000;
    expect((await child.get('/api/auth/me')).body.kind).toBe('none');
  });

  it('FR-ACC-07: password reset link goes only to verified addresses, is single-use and valid 1 h', async () => {
    await teacher();
    await request(app).post('/api/auth/forgot').send({ email: 'teacher@example.com' }).expect(200);
    const token = lastMailToken();
    await request(app).post('/api/auth/reset').send({ token, password: 'new-password-123' }).expect(200);
    expect((await request(app).post('/api/auth/reset').send({ token, password: 'other-password-123' })).body.error).toBe('invalid_or_expired_token');
    await request(app).post('/api/auth/teacher-login').send({ email: 'teacher@example.com', password: 'new-password-123' }).expect(200);

    await request(app).post('/api/auth/forgot').send({ email: 'teacher@example.com' });
    const late = lastMailToken();
    clock += 61 * 60_000;
    expect((await request(app).post('/api/auth/reset').send({ token: late, password: 'late-password-123' })).body.error).toBe('invalid_or_expired_token');

    await teacher('unverified@e.fi', { verify: false });
    const before = (db.prepare('SELECT COUNT(*) AS n FROM outbox').get() as { n: number }).n;
    await request(app).post('/api/auth/forgot').send({ email: 'unverified@e.fi' }).expect(200);
    expect((db.prepare('SELECT COUNT(*) AS n FROM outbox').get() as { n: number }).n).toBe(before);
  });

  it('FR-ACC-08 / DR-04: removing a student deletes all their data and logs it for the backup purge', async () => {
    const { t, studentId, child } = await setup();
    const ex = (await child.get('/api/child/today')).body[0];
    await complete(child, ex.exerciseId, 8);
    await t.delete(`/api/teacher/students/${studentId}`).expect(200);
    for (const table of ['students', 'results', 'levels', 'assignment_targets', 'progress'])
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get(), table).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE student_id IS NOT NULL').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT subject FROM deletion_log').all()).toEqual([{ subject: `student:${studentId}` }]);
    await child.get('/api/child/me').expect(401);
    // The number can be enrolled again.
    const cls = (await t.get('/api/teacher/classes')).body[0];
    await enrol(t, cls.id).expect(201);
  });

  it('DR-04: deleting a teacher account needs the password and removes classes, students and pictures', async () => {
    const { t } = await setup();
    await t.post('/api/teacher/e4').send(e4Body()).expect(201);
    expect((await t.delete('/api/teacher/account').send({ password: 'wrong-password' })).status).toBe(401);
    await t.delete('/api/teacher/account').send({ password: PW }).expect(200);
    for (const table of ['teachers', 'classes', 'students', 'results'])
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get(), table).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM exercises WHERE teacher_id IS NOT NULL').get()).toEqual({ n: 0 });
    expect(removed.sort()).toEqual(['img1', 'img2', 'img3']);
  });

  it('NFR-SEC-04: a teacher sees only their own classes and students; a child cannot use teacher routes', async () => {
    const { cls, studentId, child } = await setup();
    const other = await teacher('other@e.fi');
    await other.get(`/api/teacher/classes/${cls.id}/overview`).expect(404);
    await other.get(`/api/teacher/students/${studentId}`).expect(404);
    await other.delete(`/api/teacher/students/${studentId}`).expect(404);
    await other.post(`/api/teacher/students/${studentId}/unlock`).expect(404);
    await other.get(`/api/teacher/classes/${cls.id}/export.json`).expect(404);
    await child.get('/api/teacher/classes').expect(401);
    await request(app).get('/api/child/me').expect(401);
  });
});

describe('exercises', () => {
  it('FR-EX-10 / FR-EX-01: today\'s practice has 3 different types; E4 is not offered without teacher items', async () => {
    const { child } = await setup();
    const today = (await child.get('/api/child/today')).body as Array<{ type: string; exerciseId: number }>;
    expect(today).toHaveLength(3);
    expect(new Set(today.map((x) => x.type)).size).toBe(3);
    expect(today.map((x) => x.type)).not.toContain('E4');
  });

  it('FR-PRG-01 / FR-MOT-01 / FR-EX-06: result recorded, stars awarded, level rises after 3 × ≥ 85 %', async () => {
    const { child, studentId } = await setup();
    const id = (db.prepare("SELECT id FROM exercises WHERE type = 'E1' AND level = 1 AND language = 'en' LIMIT 1").get() as { id: number }).id;
    expect((await complete(child, id, 9)).body).toMatchObject({ stars: 3, levelChange: 0 });
    await complete(child, id, 9);
    expect((await complete(child, id, 10)).body.levelChange).toBe(1);
    const r = db.prepare('SELECT * FROM results WHERE student_id = ? ORDER BY id LIMIT 1').get(studentId) as Record<string, unknown>;
    expect(r).toMatchObject({ type: 'E1', level: 1, items: 10, correct: 9, duration_s: 120, wcpm: null });
    expect((await child.get('/api/child/me')).body).toMatchObject({ stars: 9, levels: { E1: 2 } });
    expect((await complete(child, id, 2)).body.stars).toBe(1);
  });

  it('NFR-REL-03: resending the same result after reconnect does not duplicate it', async () => {
    const { child } = await setup();
    const ex = (await child.get('/api/child/today')).body[0];
    await complete(child, ex.exerciseId, 5, 10, 'abc-1');
    expect((await complete(child, ex.exerciseId, 5, 10, 'abc-1')).body.duplicate).toBe(true);
    expect(db.prepare('SELECT COUNT(*) AS n FROM results').get()).toEqual({ n: 1 });
  });

  it('FR-EX-08: progress can be resumed within 24 h only', async () => {
    const { child } = await setup();
    const ex = (await child.get('/api/child/today')).body[0];
    await child.put(`/api/child/exercises/${ex.exerciseId}/progress`).send({ index: 3, results: [true, false, true], elapsedMs: 5000 }).expect(200);
    expect((await child.get('/api/child/exercises/' + ex.exerciseId)).body.progress).toMatchObject({ index: 3 });
    expect((await child.get('/api/child/today')).body.find((x: { exerciseId: number }) => x.exerciseId === ex.exerciseId).inProgress).toBe(true);
    clock += 25 * 3600_000;
    await child.post('/api/auth/student-login').send({ studentNumber: 'S100', name: 'Mia Korhonen' }).expect(200);
    expect((await child.get('/api/child/exercises/' + ex.exerciseId)).body.progress).toBeNull();
  });

  it('FR-SUP-02..06: settings persist (child or teacher) and invalid values are rejected', async () => {
    const { t, child, studentId } = await setup();
    await child.patch('/api/child/settings').send({ font: 'OpenDyslexic', background: 'lightblue', syllableColours: true }).expect(200);
    expect((await child.patch('/api/child/settings').send({ fontSize: 99 })).status).toBe(400);
    await t.patch(`/api/teacher/students/${studentId}/settings`).send({ rate: 0.8 }).expect(200);
    expect((await child.get('/api/child/me')).body.settings).toMatchObject({ font: 'OpenDyslexic', background: 'lightblue', syllableColours: true, rate: 0.8 });
  });

  it('FR-EX-07: the teacher can override levels', async () => {
    const { t, child, studentId } = await setup();
    await t.put(`/api/teacher/students/${studentId}/levels`).send({ E3: 7 }).expect(200);
    expect((await child.get('/api/child/me')).body.levels.E3).toBe(7);
    expect((await t.put(`/api/teacher/students/${studentId}/levels`).send({ E9: 1 })).status).toBe(400);
    expect((await t.put(`/api/teacher/students/${studentId}/levels`).send({ E1: 11 })).status).toBe(400);
  });

  it('FR-EX-01: exercises are served in the child\'s language', async () => {
    const { child } = await setup({ language: 'fi' });
    for (const it of (await child.get('/api/child/today')).body) {
      expect((await child.get('/api/child/exercises/' + it.exerciseId)).body.language).toBe('fi');
    }
  });
});

describe('teacher content', () => {
  const passage = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
  const text = { title: 'Our trip', language: 'en', level: 1, passage, questions: [0, 1, 2].map((i) => ({ q: `Q${i}?`, options: ['a', 'b', 'c'], answer: 1 })) };

  it('FR-CNT-02: level and language are required; passage 40–250 words with 3 questions', async () => {
    const t = await teacher();
    expect((await t.post('/api/teacher/texts').send({ ...text, level: undefined })).body.error).toBe('invalid_level');
    expect((await t.post('/api/teacher/texts').send({ ...text, language: undefined })).body.error).toBe('invalid_language');
    expect((await t.post('/api/teacher/texts').send({ ...text, passage: 'too short' })).body.error).toBe('passage_length');
    expect((await t.post('/api/teacher/texts').send({ ...text, questions: text.questions.slice(0, 2) })).body.error).toBe('three_questions_required');
    await t.post('/api/teacher/texts').send(text).expect(201);
  });

  it('FR-CNT-02: a teacher text is offered to the teacher\'s children at matching level and language only', async () => {
    const { t, child } = await setup(); // English, E5 level 1
    const { id } = (await t.post('/api/teacher/texts').send(text).expect(201)).body;
    await t.post('/api/teacher/texts').send({ ...text, level: 2 }).expect(201);
    await t.post('/api/teacher/texts').send({ ...text, language: 'fi' }).expect(201);
    await practise(child, ['E1', 'E2', 'E3']);
    const today = (await child.get('/api/child/today')).body as Array<{ type: string; exerciseId: number }>;
    expect(today.find((x) => x.type === 'E5')?.exerciseId).toBe(id);

    const t2 = await teacher('t2@e.fi');
    const c2 = await newClass(t2);
    await enrol(t2, c2.id, { studentNumber: 'X1', name: 'Leo' }).expect(201);
    const other = request.agent(app);
    await other.post('/api/auth/student-login').send({ studentNumber: 'X1', name: 'Leo' }).expect(200);
    await other.get(`/api/child/exercises/${id}`).expect(404);
    expect((await other.get('/api/child/today')).body.map((x: { exerciseId: number }) => x.exerciseId)).not.toContain(id);
  });

  it('FR-CNT-01: an assigned text comes first in today\'s practice and is marked done when completed', async () => {
    const { t, cls, child } = await setup();
    const { id } = (await t.post('/api/teacher/texts').send({ ...text, level: 6 }).expect(201)).body;
    await t.post(`/api/teacher/classes/${cls.id}/assignments`).send({ items: [{ exerciseId: id }], dueDate: '2026-11-10' }).expect(201);
    const today = (await child.get('/api/child/today')).body;
    expect(today[0]).toMatchObject({ exerciseId: id, assigned: true, dueDate: '2026-11-10' });
    await complete(child, id, 3, 3);
    const list = (await t.get(`/api/teacher/classes/${cls.id}/assignments`)).body;
    expect(list[0]).toMatchObject({ exerciseId: id, targets: 1, done: 1 });
  });

  it('FR-CNT-01: assignments can target selected children and shared types', async () => {
    const { t, cls, studentId, child } = await setup();
    await enrol(t, cls.id, { studentNumber: 'S200', name: 'Leo' }).expect(201);
    await t.post(`/api/teacher/classes/${cls.id}/assignments`).send({ items: [{ type: 'E2', level: 4 }], studentIds: [studentId] }).expect(201);
    expect((await t.get(`/api/teacher/classes/${cls.id}/assignments`)).body[0]).toMatchObject({ type: 'E2', level: 4, targets: 1 });
    const first = (await child.get('/api/child/today')).body[0];
    expect(first).toMatchObject({ type: 'E2', assigned: true });
    expect((await t.post(`/api/teacher/classes/${cls.id}/assignments`).send({ items: [{ type: 'E2' }], studentIds: [99999] })).body.error).toBe('student_not_in_class');
  });

  it('FR-CNT-05: an E4 item stores only picture references and labels; the child sees sentence + 3 pictures', async () => {
    const { t, child } = await setup();
    const { id } = (await t.post('/api/teacher/e4').send(e4Body()).expect(201)).body;
    const row = db.prepare('SELECT content FROM exercises WHERE id = ?').get(id) as { content: string };
    expect(row.content).not.toContain('base64');
    expect(JSON.parse(row.content).pictures.map((p: { ref: string }) => p.ref)).toEqual(['img1', 'img2', 'img3']);

    await practise(child, ['E1', 'E2', 'E3']);
    const today = (await child.get('/api/child/today')).body as Array<{ type: string; exerciseId: number }>;
    expect(today.find((x) => x.type === 'E4')?.exerciseId).toBe(id); // offered once items exist at the child's level
    const ex = (await child.get(`/api/child/exercises/${id}`)).body;
    expect(ex.type).toBe('E4');
    const item = ex.content.items[0];
    expect(item.sentence).toBe('The cat sits in the box.');
    expect(item.pictures).toHaveLength(3);
    expect(item.pictures[item.answer].label).toBe('a cat in a box');
    expect(JSON.stringify(ex)).not.toContain('img1"'); // refs are not exposed, only URLs
    await complete(child, id, 1, ex.content.items.length);
  });

  it('FR-EX-03 / FR-CNT-05: E4 items of the same level and language are played together (max 10)', async () => {
    const { t, child } = await setup();
    const ids: number[] = [];
    for (let i = 0; i < 12; i++) ids.push((await t.post('/api/teacher/e4').send(e4Body({ sentence: `Sentence ${i}.` })).expect(201)).body.id);
    await t.post('/api/teacher/e4').send(e4Body({ level: 2 })).expect(201);
    await t.post('/api/teacher/e4').send(e4Body({ language: 'fi' })).expect(201);
    const ex = (await child.get(`/api/child/exercises/${ids[5]}`)).body;
    expect(ex.content.items).toHaveLength(10);
    expect(ex.content.items[0].id).toBe(ids[5]);
    expect(ex.content.items.every((i: { id: number }) => ids.includes(i.id))).toBe(true);
    // Resuming keeps the same set of items.
    await child.put(`/api/child/exercises/${ids[5]}/progress`).send({ index: 2, results: [true, true], elapsedMs: 1, itemIds: ex.content.itemIds });
    await t.post('/api/teacher/e4').send(e4Body({ sentence: 'New one.' })).expect(201);
    expect((await child.get(`/api/child/exercises/${ids[5]}`)).body.content.itemIds).toEqual(ex.content.itemIds);
  });

  it('FR-EX-01: E4 is offered only at the child\'s current level and language', async () => {
    const { t, child } = await setup(); // English, level 1
    await t.post('/api/teacher/e4').send(e4Body({ level: 2 })).expect(201);
    await t.post('/api/teacher/e4').send(e4Body({ language: 'fi' })).expect(201);
    await practise(child, ['E1', 'E2', 'E3']);
    expect((await child.get('/api/child/today')).body.map((x: { type: string }) => x.type)).not.toContain('E4');
  });

  it('FR-CNT-05: invalid uploads are rejected with a clear error and nothing is stored', async () => {
    const t = await teacher();
    const bad = async (over: Record<string, unknown>) => (await t.post('/api/teacher/e4').send(e4Body(over))).body.error;
    const pics = e4Body().pictures;
    expect(await bad({ confirmNoPeople: false })).toBe('confirm_no_people');
    expect(await bad({ pictures: pics.slice(0, 2) })).toBe('three_pictures_required');
    expect(await bad({ pictures: [pics[0], pics[1], { image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', label: 'gif' }] })).toBe('image_type');
    expect(await bad({ pictures: [pics[0], pics[1], { image: 'data:image/png;base64,' + Buffer.alloc(16).toString('base64'), label: 'fake png' }] })).toBe('image_type');
    const big = 'data:image/png;base64,' + Buffer.concat([Buffer.from(PNG.split(',')[1], 'base64'), Buffer.alloc(2 * 1024 * 1024)]).toString('base64');
    expect(await bad({ pictures: [pics[0], pics[1], { image: big, label: 'big' }] })).toBe('image_too_large');
    expect(await bad({ pictures: [pics[0], pics[1], { image: PNG, label: 'one two three four five six' }] })).toBe('invalid_label');
    expect(await bad({ pictures: [pics[0], pics[1], { image: PNG, label: '' }] })).toBe('invalid_label');
    expect(await bad({ sentence: '' })).toBe('invalid_sentence');
    expect(await bad({ level: 11 })).toBe('invalid_level');
    expect(stored).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM exercises WHERE type = 'E4'").get()).toEqual({ n: 0 });
  });

  it('FR-CNT-05: if the image host fails midway, uploaded pictures are removed and no exercise is created', async () => {
    const t = await teacher();
    failUploadAfter = 2;
    expect((await t.post('/api/teacher/e4').send(e4Body())).body.error).toBe('upload_failed');
    expect(removed.sort()).toEqual(['img1', 'img2']);
    expect(db.prepare("SELECT COUNT(*) AS n FROM exercises WHERE type = 'E4'").get()).toEqual({ n: 0 });
  });

  it('E4 uploads need a teacher session before the large body is read', async () => {
    expect((await request(app).post('/api/teacher/e4').send(e4Body())).status).toBe(401);
  });

  it('teacher content can be hidden, assigned directly, and deleted (E4 pictures removed from the host)', async () => {
    const { t, cls, child } = await setup();
    const { id } = (await t.post('/api/teacher/e4').send(e4Body()).expect(201)).body;
    await t.post(`/api/teacher/classes/${cls.id}/assignments`).send({ items: [{ exerciseId: id }] }).expect(201);
    expect((await child.get('/api/child/today')).body[0]).toMatchObject({ exerciseId: id, type: 'E4', assigned: true });
    await t.patch(`/api/teacher/content/${id}`).send({ active: false }).expect(200);
    await child.get(`/api/child/exercises/${id}`).expect(404);
    expect((await t.get('/api/teacher/e4')).body[0]).toMatchObject({ id, active: 0, content: { pictures: [{ url: '/media/img1.png', label: 'a cat in a box' }, {}, {}] } });
    await t.delete(`/api/teacher/content/${id}`).expect(200);
    expect(removed.sort()).toEqual(['img1', 'img2', 'img3']);
    const other = await teacher('o@e.fi');
    const { id: textId } = (await t.post('/api/teacher/texts').send(text).expect(201)).body;
    await other.delete(`/api/teacher/content/${textId}`).expect(404);
  });

  it('FR-CNT-03: teachers cannot assign or change shared-library rows through the API', async () => {
    const { t, cls } = await setup();
    const shared = (db.prepare("SELECT id FROM exercises WHERE seed_key IS NOT NULL LIMIT 1").get() as { id: number }).id;
    expect((await t.post(`/api/teacher/classes/${cls.id}/assignments`).send({ items: [{ exerciseId: shared }] })).body.error).toBe('exercise_not_found');
    await t.patch(`/api/teacher/content/${shared}`).send({ active: false }).expect(404);
    await t.delete(`/api/teacher/content/${shared}`).expect(404);
  });
});

describe('progress and reporting', () => {
  it('FR-PRG-02: child detail has 12 weeks with time, count and accuracy per type, and current levels', async () => {
    const { t, child, studentId } = await setup();
    const ex = (await child.get('/api/child/today')).body[0];
    await complete(child, ex.exerciseId, 6);
    const d = (await t.get(`/api/teacher/students/${studentId}`)).body;
    expect(d.weeks).toHaveLength(12);
    const last = d.weeks[11];
    expect(last).toMatchObject({ minutes: 2, exercises: 1 });
    expect(last.accuracy[ex.type]).toBeCloseTo(0.6);
    expect(d.levels).toMatchObject({ E1: 1 });
    expect(d.student).toMatchObject({ name: 'Mia Korhonen', studentNumber: 'S100' });
  });

  it('FR-PRG-03: overview has number, 7-day time and count, levels, inactivity and lock indicators', async () => {
    const { t, cls, child } = await setup();
    await enrol(t, cls.id, { studentNumber: 'S200', name: 'Leo' }).expect(201);
    const ex = (await child.get('/api/child/today')).body[0];
    await complete(child, ex.exerciseId, 6);
    const rows = (await t.get(`/api/teacher/classes/${cls.id}/overview`)).body.students;
    expect(rows.map((r: { name: string }) => r.name)).toEqual(['Leo', 'Mia Korhonen']);
    expect(rows[1]).toMatchObject({ studentNumber: 'S100', minutes7: 2, exercises7: 1, inactive: false, locked: false });
    expect(rows[0]).toMatchObject({ inactive: true, exercises7: 0 });
    clock += 8 * 86_400_000;
    await t.post('/api/auth/teacher-login').send({ email: 'teacher@example.com', password: PW });
    expect((await t.get(`/api/teacher/classes/${cls.id}/overview`)).body.students[1].inactive).toBe(true);
  });

  it('FR-PRG-04: the overview can be exported as CSV (formula cells neutralised)', async () => {
    const { t, cls } = await setup();
    await enrol(t, cls.id, { studentNumber: 'S200', name: '=HYPERLINK("x")' }).expect(201);
    const res = await t.get(`/api/teacher/classes/${cls.id}/overview.csv`).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Name,Student number,Minutes (7 days),Exercises (7 days),Level E1,Level E2,Level E3,Level E4,Level E5,Not practised in 7 days,Login locked');
    expect(lines).toContain('Mia Korhonen,S100,0,0,1,1,1,1,1,yes,no');
    expect(lines.find((l) => l.includes('HYPERLINK'))).toMatch(/^"'=HYPERLINK\(""x""\)"/);
  });

  it('DR-06: the class export contains the stored data of every student', async () => {
    const { t, cls, child } = await setup();
    const ex = (await child.get('/api/child/today')).body[0];
    await complete(child, ex.exerciseId, 7);
    const data = (await t.get(`/api/teacher/classes/${cls.id}/export.json`).expect(200)).body;
    expect(data.class).toMatchObject({ name: '2B', code: cls.code });
    expect(data.students[0]).toMatchObject({ studentNumber: 'S100', name: 'Mia Korhonen', birthYear: 2019, language: 'en', stars: 2 });
    expect(data.students[0].results).toHaveLength(1);
    expect(data.students[0]).toHaveProperty('settings.font', 'Lexend');
    expect(data.students[0]).toHaveProperty('levels.E1', 1);
  });
});

describe('DR-05 inactivity deletion', () => {
  it('notifies the teacher 30 days before deleting a child with no login for 24 months', async () => {
    const { studentId } = await setup();
    const MONTH = 30 * 86_400_000;
    clock += 23 * MONTH - 86_400_000;
    expect(runDailyJobs(ctx).notified).toBe(0);
    clock += 2 * 86_400_000;
    expect(runDailyJobs(ctx)).toMatchObject({ notified: 1, deletedStudents: 0 });
    const mail = db.prepare('SELECT to_addr, body FROM outbox ORDER BY id DESC LIMIT 1').get() as { to_addr: string; body: string };
    expect(mail.to_addr).toBe('teacher@example.com');
    expect(mail.body).toContain('Mia Korhonen (S100)');
    expect(runDailyJobs(ctx).notified).toBe(0); // only once
    clock += 31 * 86_400_000;
    expect(runDailyJobs(ctx).deletedStudents).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM students WHERE id = ?').get(studentId)).toEqual({ n: 0 });
  });

  it('a login after the notice cancels the deletion', async () => {
    await setup();
    clock += 24 * 30 * 86_400_000;
    expect(runDailyJobs(ctx).notified).toBe(1);
    await request(app).post('/api/auth/student-login').send({ studentNumber: 'S100', name: 'Mia Korhonen' }).expect(200);
    clock += 31 * 86_400_000;
    expect(runDailyJobs(ctx).deletedStudents).toBe(0);
  });
});
