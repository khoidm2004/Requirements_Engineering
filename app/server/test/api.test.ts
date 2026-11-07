import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { openDb, type DB } from '../src/db.js';
import type { Ctx } from '../src/context.js';
import { memoryStorage } from '../src/storage.js';
import { seedContent } from '../src/content/seed.js';
import { answerKey, type Content, type ExerciseType } from '../src/domain/rules.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);

let db: DB;
let app: Express;
let clock: number;

beforeEach(() => {
  db = openDb();
  seedContent(db);
  clock = Date.UTC(2026, 10, 1);
  const ctx: Ctx = { db, storage: memoryStorage(), now: () => clock };
  app = createApp(ctx);
});

async function teacher(email = 't@school.test') {
  const agent = request.agent(app);
  await agent.post('/api/auth/teacher/register').send({ email, name: 'Ms Teacher', password: 'secret123' }).expect(201);
  return agent;
}

async function classWithStudent(t: request.Agent, number = 'S001', name = 'Anna Smith') {
  const cls = (await t.post('/api/teacher/classes').send({ name: '2B' }).expect(201)).body;
  const st = (await t.post(`/api/teacher/classes/${cls.id}/students`).send({ name, number }).expect(201)).body;
  return { cls, st };
}

async function student(number = 'S001', name = 'Anna Smith') {
  const agent = request.agent(app);
  await agent.post('/api/auth/student/login').send({ number, name }).expect(200);
  return agent;
}

/** Builds answers: the first `right` correct, the rest wrong. */
function answersFor(ex: { type: ExerciseType; content: Content }, right: number) {
  return answerKey(ex.type, ex.content).map((a, i) => ({ given: i < right ? a : 'nope', ms: 1000 }));
}

describe('teacher accounts (req 1)', () => {
  it('registers, logs in and out', async () => {
    const t = await teacher();
    expect((await t.get('/api/auth/me')).body).toMatchObject({ kind: 'teacher', teacher: { name: 'Ms Teacher' } });
    await t.post('/api/auth/logout').expect(200);
    expect((await t.get('/api/auth/me')).body.kind).toBeNull();
    await t.post('/api/auth/teacher/login').send({ email: 'T@school.test', password: 'secret123' }).expect(200);
    expect((await t.get('/api/auth/me')).body.kind).toBe('teacher');
  });

  it('rejects wrong passwords, weak passwords and taken e-mails', async () => {
    await teacher();
    await request(app).post('/api/auth/teacher/login').send({ email: 't@school.test', password: 'nope' }).expect(401);
    await request(app).post('/api/auth/teacher/register').send({ email: 'x@y.z', name: 'X', password: 'short' }).expect(400);
    await request(app).post('/api/auth/teacher/register').send({ email: 't@school.test', name: 'X', password: 'secret123' }).expect(409);
  });

  it('slows down repeated wrong logins', async () => {
    for (let i = 0; i < 10; i++) await request(app).post('/api/auth/student/login').send({ number: 'X', name: 'Y' }).expect(401);
    await request(app).post('/api/auth/student/login').send({ number: 'X', name: 'Y' }).expect(429);
    clock += 11 * 60 * 1000;
    await request(app).post('/api/auth/student/login').send({ number: 'X', name: 'Y' }).expect(401);
  });

  it('ends sessions after 8 hours without activity', async () => {
    const t = await teacher();
    clock += 8 * 3600 * 1000 + 1;
    expect((await t.get('/api/auth/me')).body.kind).toBeNull();
  });

  it('blocks teacher routes for students and visitors', async () => {
    const t = await teacher();
    await classWithStudent(t);
    const s = await student();
    await s.get('/api/teacher/classes').expect(401);
    await request(app).get('/api/teacher/classes').expect(401);
    await t.get('/api/student/home').expect(401);
  });
});

describe('classes and students (req 2–4)', () => {
  it('creates a class with a code and adds students by name + number', async () => {
    const t = await teacher();
    const { cls } = await classWithStudent(t);
    expect(cls.code).toMatch(/^[A-Z0-9]{6}$/);
    const list = (await t.get('/api/teacher/classes')).body;
    expect(list[0]).toMatchObject({ name: '2B', students: 1 });
    await t.post(`/api/teacher/classes/${cls.id}/students`).send({ name: 'Other', number: 's001' }).expect(409);
    await t.post(`/api/teacher/classes/${cls.id}/students`).send({ name: 'Bad', number: 'has space' }).expect(400);
  });

  it('lets kids sign in with student number and name', async () => {
    const t = await teacher();
    await classWithStudent(t);
    const s = request.agent(app);
    await s.post('/api/auth/student/login').send({ number: 'S001', name: 'Wrong Name' }).expect(401);
    await s.post('/api/auth/student/login').send({ number: 's001', name: '  anna   smith ' }).expect(200);
    const me = (await s.get('/api/auth/me')).body;
    expect(me).toMatchObject({ kind: 'student', student: { name: 'Anna Smith', className: '2B', points: 0 } });
    expect(me.student.settings.font).toBe('OpenDyslexic');
  });

  it("does not show another teacher's classes or students", async () => {
    const t1 = await teacher();
    const { cls, st } = await classWithStudent(t1);
    const t2 = await teacher('other@school.test');
    await t2.get(`/api/teacher/classes/${cls.id}`).expect(404);
    await t2.get(`/api/teacher/students/${st.id}`).expect(404);
    await t2.post(`/api/teacher/classes/${cls.id}/students`).send({ name: 'X', number: 'X1' }).expect(404);
    await t2.delete(`/api/teacher/students/${st.id}`).expect(404);
  });
});

describe('practice (req 6, 7, 12, 14, 15)', () => {
  it('serves an exercise at the kid’s level and moves the level automatically', async () => {
    const t = await teacher();
    await classWithStudent(t);
    const s = await student();
    const ex = (await s.get('/api/student/practice/words').expect(200)).body;
    expect(ex).toMatchObject({ type: 'words', level: 1, timeLimitS: 20 });

    const res = (await s.post('/api/student/results').send({ exerciseId: ex.id, answers: answersFor(ex, ex.content.items.length), durationMs: 9000 }).expect(201)).body;
    expect(res).toMatchObject({ correct: ex.content.items.length, level: 1, newLevel: 2 });
    expect(res.points).toBeGreaterThan(10 * ex.content.items.length);

    const next = (await s.get('/api/student/practice/words')).body;
    expect(next.level).toBe(2);
    const bad = (await s.post('/api/student/results').send({ exerciseId: next.id, answers: answersFor(next, 0), durationMs: 1 })).body;
    expect(bad).toMatchObject({ correct: 0, points: 0, newLevel: 1 });
    expect(bad.answers[0]).toMatchObject({ correct: false, answer: answerKey(next.type, next.content)[0] });

    const home = (await s.get('/api/student/home')).body;
    expect(home.levels.words).toBe(1);
    expect(home.points).toBe(res.points);
    expect(home.rank).toBe(1);
  });

  it('validates submitted answers', async () => {
    const t = await teacher();
    await classWithStudent(t);
    const s = await student();
    const ex = (await s.get('/api/student/practice/letters')).body;
    await s.post('/api/student/results').send({ exerciseId: ex.id, answers: [] }).expect(400);
    await s.post('/api/student/results').send({ exerciseId: ex.id, answers: 'x' }).expect(400);
    await s.post('/api/student/results').send({ exerciseId: 999999, answers: [] }).expect(404);
    await s.get('/api/student/practice/nonsense').expect(400);
  });

  it('shows a class leaderboard (req 14)', async () => {
    const t = await teacher();
    const { cls } = await classWithStudent(t);
    await t.post(`/api/teacher/classes/${cls.id}/students`).send({ name: 'Ben', number: 'S002' }).expect(201);
    const ben = await student('S002', 'Ben');
    const ex = (await ben.get('/api/student/practice/letters')).body;
    await ben.post('/api/student/results').send({ exerciseId: ex.id, answers: answersFor(ex, 3), durationMs: 1000 }).expect(201);

    const anna = await student();
    const board = (await anna.get('/api/student/leaderboard')).body;
    expect(board.map((b: { name: string }) => b.name)).toEqual(['Ben', 'Anna Smith']);
    expect(board[1].me).toBe(true);
    const week = (await anna.get('/api/student/leaderboard?period=week')).body;
    expect(week[0].points).toBe(board[0].points);
    expect((await t.get(`/api/teacher/classes/${cls.id}/leaderboard`)).body).toHaveLength(2);
  });

  it('saves kid settings (req 10)', async () => {
    const t = await teacher();
    await classWithStudent(t);
    const s = await student();
    const saved = (await s.put('/api/student/settings').send({ font: 'Lexend', fontSize: 30, background: '#000000', textColor: '#FFFFFF' }).expect(200)).body;
    expect(saved).toMatchObject({ font: 'Lexend', fontSize: 30, textColor: '#ffffff' });
    expect((await s.get('/api/auth/me')).body.student.settings.fontSize).toBe(30);
    await s.put('/api/student/settings').send({ fontSize: 'big' }).expect(400);
  });
});

describe('teacher content and assignments (req 5)', () => {
  it('adds own texts that the teacher’s kids can play', async () => {
    const t = await teacher();
    await classWithStudent(t);
    const story = {
      type: 'stories', level: 2, title: 'Our trip',
      content: { text: 'We went to the zoo.', timeLimitS: 45, questions: [{ question: 'Where?', answer: 'zoo', options: ['zoo', 'park'] }] },
    };
    const { id } = (await t.post('/api/teacher/exercises').send(story).expect(201)).body;
    await t.post('/api/teacher/exercises').send({ ...story, content: { text: 'x', questions: [] } }).expect(400);

    const s = await student();
    const ex = (await s.get(`/api/student/exercises/${id}`).expect(200)).body;
    expect(ex).toMatchObject({ title: 'Our trip', timeLimitS: 45, shared: false });
    expect((await s.get('/api/student/texts')).body.some((x: { id: number }) => x.id === id)).toBe(true);

    // another teacher's kid cannot see it
    const t2 = await teacher('b@school.test');
    await classWithStudent(t2, 'S999', 'Zed');
    const z = await student('S999', 'Zed');
    await z.get(`/api/student/exercises/${id}`).expect(404);

    // archive: gone from lists, results kept
    await t.delete(`/api/teacher/exercises/${id}`).expect(200);
    await s.get(`/api/student/exercises/${id}`).expect(404);
    expect((await t.get('/api/teacher/exercises')).body.some((x: { id: number }) => x.id === id)).toBe(false);
  });

  it('uploads pictures for sentence–picture exercises', async () => {
    const t = await teacher();
    await classWithStudent(t);
    await t.post('/api/teacher/images').set('Content-Type', 'image/png').send(Buffer.from('<svg/>')).expect(415);
    const a = (await t.post('/api/teacher/images').set('Content-Type', 'image/png').send(PNG).expect(201)).body.id;
    const b = (await t.post('/api/teacher/images').set('Content-Type', 'image/png').send(PNG).expect(201)).body.id;
    const { id } = (
      await t.post('/api/teacher/exercises').send({
        type: 'pictures', level: 1, title: 'Our class pets',
        content: { items: [{ sentence: 'This is Rex.', picture: { imageId: a } }, { sentence: 'This is Tom.', picture: { imageId: b } }] },
      }).expect(201)
    ).body;

    const s = await student();
    const img = await s.get(`/api/images/${a}`).expect(200);
    expect(img.headers['content-type']).toBe('image/png');
    const ex = (await s.get(`/api/student/exercises/${id}`)).body;
    expect(ex.content.items[0].picture).toEqual({ imageId: a });

    const t2 = await teacher('b@school.test');
    await t2.get(`/api/images/${a}`).expect(404);
    await t2.post('/api/teacher/exercises').send({
      type: 'pictures', level: 1, title: 'Stolen',
      content: { items: [{ sentence: 'a', picture: { imageId: a } }, { sentence: 'b', picture: { emoji: '🐱' } }] },
    }).expect(400);
    await request(app).get(`/api/images/${a}`).expect(401);
  });

  it('assigns exercises to the class or to chosen kids', async () => {
    const t = await teacher();
    const { cls, st } = await classWithStudent(t);
    const ben = (await t.post(`/api/teacher/classes/${cls.id}/students`).send({ name: 'Ben', number: 'S002' })).body;
    const lib = (await t.get('/api/teacher/exercises')).body;
    const story = lib.find((e: { type: string; level: number }) => e.type === 'stories' && e.level === 4);

    await t.post('/api/teacher/assignments').send({ classId: cls.id, exerciseId: story.id, dueDate: '2026-11-20' }).expect(201);
    await t.post('/api/teacher/assignments').send({ classId: cls.id, exerciseId: lib[0].id, studentIds: [ben.id] }).expect(201);
    await t.post('/api/teacher/assignments').send({ classId: cls.id, exerciseId: lib[0].id, studentIds: [99999] }).expect(400);
    await t.post('/api/teacher/assignments').send({ classId: cls.id, exerciseId: lib[0].id, dueDate: 'soon' }).expect(400);

    const anna = await student();
    let home = (await anna.get('/api/student/home')).body;
    expect(home.assignments).toHaveLength(1);
    const a = home.assignments[0];
    expect(a).toMatchObject({ exerciseId: story.id, dueDate: '2026-11-20' });

    // assigned exercise at another level does not move the kid's level
    const ex = (await anna.get(`/api/student/exercises/${story.id}`)).body;
    const res = (await anna.post('/api/student/results').send({ exerciseId: ex.id, assignmentId: a.id, answers: answersFor(ex, 3), durationMs: 5 }).expect(201)).body;
    expect(res).toMatchObject({ level: 1, newLevel: 1 });
    home = (await anna.get('/api/student/home')).body;
    expect(home.assignments).toHaveLength(0);

    const list = (await t.get(`/api/teacher/classes/${cls.id}/assignments`)).body;
    expect(list.find((x: { id: number }) => x.id === a.id)).toMatchObject({ assigned: 2, done: 1 });
    await anna.post('/api/student/results').send({ exerciseId: ex.id, assignmentId: list[0].id, answers: answersFor(ex, 1) }).expect(400);
    await t.delete(`/api/teacher/assignments/${a.id}`).expect(200);
    expect(st.id).toBeGreaterThan(0);
  });
});

describe('recordings (req 13)', () => {
  it('saves a kid’s recording and lets only their teacher listen', async () => {
    const t = await teacher();
    const { st } = await classWithStudent(t);
    const s = await student();
    const text = (await s.get('/api/student/texts')).body[0];
    expect(text.level).toBe(1);
    await s.post('/api/student/recordings?durationMs=3000').set('Content-Type', 'audio/webm').send(Buffer.from('nope')).expect(415);
    const { id } = (await s.post(`/api/student/recordings?exerciseId=${text.id}&durationMs=3000`).set('Content-Type', 'audio/webm').send(WEBM).expect(201)).body;

    const mine = (await s.get('/api/student/recordings')).body;
    expect(mine[0]).toMatchObject({ id, title: text.title, durationMs: 3000, listened: 0 });
    await s.get(`/api/student/recordings/${id}/audio`).expect(200);

    let report = (await t.get(`/api/teacher/students/${st.id}`)).body;
    expect(report.recordings[0]).toMatchObject({ id, listenedAt: null });
    const audio = await t.get(`/api/teacher/recordings/${id}/audio`).expect(200);
    expect(audio.headers['content-type']).toBe('audio/webm');
    report = (await t.get(`/api/teacher/students/${st.id}`)).body;
    expect(report.recordings[0].listenedAt).not.toBeNull();

    const t2 = await teacher('b@school.test');
    await t2.get(`/api/teacher/recordings/${id}/audio`).expect(404);
  });
});

describe('reports and export (req 16, 18)', () => {
  async function withResults() {
    const t = await teacher();
    const { cls, st } = await classWithStudent(t, 'S001', '=HYPERLINK("x")');
    const s = await student('S001', '=HYPERLINK("x")');
    for (const type of ['letters', 'stories'] as const) {
      const ex = (await s.get(`/api/student/practice/${type}`)).body;
      await s.post('/api/student/results').send({ exerciseId: ex.id, answers: answersFor(ex, 2), durationMs: 60000 }).expect(201);
    }
    return { t, cls, st };
  }

  it('shows class and student progress', async () => {
    const { t, cls, st } = await withResults();
    const c = (await t.get(`/api/teacher/classes/${cls.id}`)).body;
    expect(c.students[0]).toMatchObject({ id: st.id, exercises: 2, timeMs: 120000 });
    expect(c.students[0].levels).toHaveProperty('letters');
    const r = (await t.get(`/api/teacher/students/${st.id}`)).body;
    expect(r.results).toHaveLength(2);
    expect(r.results[0].answers[0]).toHaveProperty('correct');
    expect(r.byType).toHaveLength(2);
  });

  it('exports CSV with formulas neutralised', async () => {
    const { t, cls } = await withResults();
    const res = await t.get(`/api/teacher/classes/${cls.id}/export/results.csv`).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain(`readbuddy-${cls.code}-results.csv`);
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toContain('student_number,name,completed_at_utc');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    const st = await t.get(`/api/teacher/classes/${cls.id}/export/students.csv`).expect(200);
    expect(st.text).toContain('level_letters');
  });

  it('removes a student and their data', async () => {
    const { t, cls, st } = await withResults();
    await t.delete(`/api/teacher/students/${st.id}`).expect(200);
    expect((await t.get(`/api/teacher/classes/${cls.id}`)).body.students).toHaveLength(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM results').get() as { n: number }).n).toBe(0);
  });
});
