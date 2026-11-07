import { describe, expect, it } from 'vitest';
import { buildSeedExercises, seedContent } from '../src/content/seed.js';
import { openDb } from '../src/db.js';
import { TYPES, answerKey, validateContent } from '../src/domain/rules.js';

describe('shared exercises (req 6, 17)', () => {
  const all = buildSeedExercises();

  it('has every exercise type at every level 1–5', () => {
    for (const type of TYPES) {
      for (let level = 1; level <= 5; level++) {
        expect(all.some((e) => e.type === type && e.level === level), `${type} ${level}`).toBe(true);
      }
    }
  });

  it('is valid content with unique titles', () => {
    for (const e of all) {
      const c = validateContent(e.type, e.content);
      expect(answerKey(e.type, c).length).toBeGreaterThan(0);
    }
    expect(new Set(all.map((e) => e.title)).size).toBe(all.length);
  });

  it('is the same on every install and seeds only once', () => {
    expect(JSON.stringify(buildSeedExercises())).toBe(JSON.stringify(all));
    const db = openDb();
    expect(seedContent(db)).toBe(all.length);
    expect(seedContent(db)).toBe(0);
  });
});
