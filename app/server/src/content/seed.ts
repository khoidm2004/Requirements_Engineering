import type { DB } from '../db.js';
import { syllabifyFi } from '../../../shared/syllables.js';
import { E1, E2, E3, E5, type Lang } from './banks.js';

/** Deterministic PRNG so the seed library is reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rand = () => number;
const shuffle = <T>(arr: readonly T[], r: Rand): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const band = (level: number) => (level <= 3 ? 0 : level <= 6 ? 1 : 2);
/** FR-EX-03: 5–10 items, growing with level. */
export const itemCount = (level: number) => Math.min(10, 5 + Math.floor((level - 1) / 2));

export function makeE1(lang: Lang, level: number, r: Rand) {
  const nOptions = 3 + Math.floor((level - 1) / 3); // 3..6 (FR-EX-01)
  const pool = E1[lang][band(level)];
  const all = E1[lang].flat();
  const targets = shuffle(pool, r).slice(0, itemCount(level));
  return {
    items: targets.map(([answer, say]) => {
      // Distractors from the same band first (harder to discriminate), then any band.
      const same = shuffle(pool.filter(([a]) => a !== answer), r).map(([a]) => a);
      const other = shuffle(all.filter(([a]) => a !== answer && !same.includes(a)), r).map(([a]) => a);
      const distractors = [...same, ...other].slice(0, nOptions - 1);
      return { answer, say, options: shuffle([answer, ...distractors], r) };
    }),
  };
}

export function makeE2(lang: Lang, level: number, r: Rand) {
  const words = shuffle(E2[lang][band(level)], r).slice(0, itemCount(level));
  return {
    items: words.map((w) => {
      const syllables = lang === 'en' ? w.split('-') : syllabifyFi(w);
      return { word: syllables.join(''), syllables };
    }),
  };
}

export function makeE3(lang: Lang, level: number, r: Rand) {
  const groups = shuffle(E3[lang][band(level)], r).slice(0, itemCount(level));
  return { items: groups.map(([word, ...d]) => ({ word, options: shuffle([word, ...d.slice(0, 3)], r) })) };
}

export const TITLES: Record<string, Record<Lang, string>> = {
  E1: { en: 'Letters and sounds', fi: 'Kirjaimet ja äänteet' },
  E2: { en: 'Syllables', fi: 'Tavut' },
  E3: { en: 'Find the word', fi: 'Etsi sana' },
};

/**
 * FR-CNT-03 / A-4 / C-5 — seeds the shared library: E1, E2, E3 (2 variants per level) and one E5
 * passage per level, levels 1–10, English and Finnish. E4 is not part of the shared library.
 * Every row has a stable seed key, so re-running the seed on redeploy updates the baseline in place
 * (results and assignments keep pointing at the same rows) and deactivates rows no longer in it.
 */
export function seedContent(db: DB): { upserted: number; retired: number } {
  const upsert = db.prepare(
    `INSERT INTO exercises (type, level, language, title, content, seed_key) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(seed_key) DO UPDATE SET type = excluded.type, level = excluded.level, language = excluded.language,
       title = excluded.title, content = excluded.content, active = 1`,
  );
  const keys: string[] = [];
  const add = (type: string, level: number, lang: Lang, title: string, content: unknown, key: string) => {
    upsert.run(type, level, lang, title, JSON.stringify(content), key);
    keys.push(key);
  };
  const makers = { E1: makeE1, E2: makeE2, E3: makeE3 } as const;
  db.exec('BEGIN');
  try {
    for (const lang of ['en', 'fi'] as const) {
      for (const [type, make] of Object.entries(makers)) {
        for (let level = 1; level <= 10; level++) {
          for (let v = 1; v <= 2; v++) {
            const r = rng(level * 1000 + v * 100 + type.charCodeAt(1) + (lang === 'fi' ? 7 : 0));
            add(type, level, lang, `${TITLES[type][lang]} ${level}.${v}`, make(lang, level, r), `${type}:${lang}:${level}:${v}`);
          }
        }
      }
      for (const p of E5[lang]) add('E5', p.level, lang, p.title, { passage: p.text, questions: p.questions }, `E5:${lang}:${p.level}`);
    }
    const placeholders = keys.map(() => '?').join(',');
    const { changes } = db
      .prepare(`UPDATE exercises SET active = 0 WHERE seed_key IS NOT NULL AND active = 1 AND seed_key NOT IN (${placeholders})`)
      .run(...keys);
    db.exec('COMMIT');
    return { upserted: keys.length, retired: Number(changes) };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
