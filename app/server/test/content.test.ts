import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db.js';
import { seedContent } from '../src/content/seed.js';
import { validatePassage } from '../src/routes/teacher.js';
import { SHARED_TYPES } from '../src/domain/rules.js';

/** Structure checks for the seeded types (FR-EX-01, FR-EX-03). */
function checkItems(type: string, content: { items?: Array<Record<string, unknown>> }) {
  const items = content.items ?? [];
  if (items.length < 5 || items.length > 10) return false;
  const strs = (a: unknown, min: number, max: number) =>
    Array.isArray(a) && a.length >= min && a.length <= max && a.every((x) => typeof x === 'string' && x.length > 0);
  return items.every((it) =>
    type === 'E1' ? typeof it.answer === 'string' && typeof it.say === 'string' && strs(it.options, 3, 6) && (it.options as string[]).includes(it.answer)
    : type === 'E2' ? typeof it.word === 'string' && strs(it.syllables, 1, 8) && (it.syllables as string[]).join('') === it.word
    : type === 'E3' ? typeof it.word === 'string' && strs(it.options, 4, 4) && (it.options as string[]).includes(it.word)
    : false,
  );
}

describe('seed content library (FR-CNT-03, A-4)', () => {
  const db = openDb();
  const first = seedContent(db);
  const rows = db.prepare('SELECT * FROM exercises').all() as Array<{ id: number; type: string; level: number; language: string; content: string; seed_key: string; active: number }>;

  it('is idempotent: re-seeding updates rows in place instead of duplicating them', () => {
    expect(first.upserted).toBe(rows.length);
    const again = seedContent(db);
    expect(again).toEqual({ upserted: rows.length, retired: 0 });
    expect((db.prepare('SELECT COUNT(*) AS n FROM exercises').get() as { n: number }).n).toBe(rows.length);
  });

  it('retires shared rows that are no longer in the seed', () => {
    const d = openDb();
    seedContent(d);
    d.prepare("INSERT INTO exercises (type, level, language, title, content, seed_key) VALUES ('E1', 1, 'en', 'old', '{}', 'E1:en:1:99')").run();
    expect(seedContent(d).retired).toBe(1);
    expect(d.prepare("SELECT active FROM exercises WHERE seed_key = 'E1:en:1:99'").get()).toEqual({ active: 0 });
  });

  it('FR-CNT-03: E1, E2, E3 and E5 exist at every level 1–10 in English and Finnish', () => {
    for (const lang of ['en', 'fi'])
      for (const type of SHARED_TYPES)
        for (let l = 1; l <= 10; l++) expect(rows.some((r) => r.type === type && r.language === lang && r.level === l), `${type} ${lang} ${l}`).toBe(true);
  });

  it('FR-CNT-03: E4 is not part of the shared library', () => {
    expect(rows.filter((r) => r.type === 'E4')).toHaveLength(0);
  });

  it('every exercise is valid (5–10 items; E5 passages of 40–250 words with 3 questions)', () => {
    for (const r of rows) {
      const c = JSON.parse(r.content);
      if (r.type === 'E5') expect(() => validatePassage(c), `exercise ${r.seed_key}`).not.toThrow();
      else expect(checkItems(r.type, c), `exercise ${r.seed_key}`).toBe(true);
    }
  });

  it('E1 option count grows from 3 to 6 with level', () => {
    const e1 = rows.filter((r) => r.type === 'E1');
    const opts = (l: number) => JSON.parse(e1.find((r) => r.level === l)!.content).items[0].options.length;
    expect(opts(1)).toBe(3);
    expect(opts(10)).toBe(6);
  });

  it('options within an item are unique', () => {
    for (const r of rows.filter((r) => r.type === 'E1' || r.type === 'E3')) {
      for (const it of JSON.parse(r.content).items) expect(new Set(it.options).size, `exercise ${r.seed_key}`).toBe(it.options.length);
    }
  });
});
