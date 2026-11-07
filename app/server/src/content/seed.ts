import type { DB } from '../db.js';
import { tx } from '../db.js';
import { type ExerciseType, validateContent } from '../domain/rules.js';
import { LETTER_LEVELS, LETTER_WORDS, PICTURE_LEVELS, SENTENCE_LEVELS, STORY_LEVELS, WORD_LEVELS } from './bank.js';

/** Small deterministic PRNG so the seeded exercises are the same on every install. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SET_NAMES = ['A', 'B', 'C'];

export interface SeedExercise {
  type: ExerciseType;
  level: number;
  title: string;
  content: unknown;
}

export function buildSeedExercises(): SeedExercise[] {
  const out: SeedExercise[] = [];
  const rand = rng(20261031);

  LETTER_LEVELS.forEach((lv, li) => {
    for (let set = 0; set < 3; set++) {
      const targets = shuffle(lv.targets, rand).slice(0, 6);
      out.push({
        type: 'letters',
        level: li + 1,
        title: `Letter sounds ${li + 1}${SET_NAMES[set]}`,
        content: {
          items: targets.map((target) => {
            const group = lv.groups.find((g) => g.includes(target)) ?? lv.targets;
            let pool = group.filter((x) => x !== target);
            if (pool.length < lv.options - 1) pool = [...pool, ...lv.targets.filter((x) => x !== target && !pool.includes(x))];
            const options = shuffle([target, ...shuffle(pool, rand).slice(0, lv.options - 1)], rand);
            return { target, say: `${target}, as in ${LETTER_WORDS[target]}`, options };
          }),
        },
      });
    }
  });

  WORD_LEVELS.forEach((groups, li) => {
    for (let set = 0; set < 2; set++) {
      out.push({
        type: 'words',
        level: li + 1,
        title: `Word match ${li + 1}${SET_NAMES[set]}`,
        content: {
          items: shuffle(groups, rand).map((g, gi) => ({ target: g[(gi + set * 2) % g.length], options: shuffle(g, rand) })),
        },
      });
    }
  });

  SENTENCE_LEVELS.forEach((items, li) => {
    for (let set = 0; set < 2; set++) {
      out.push({
        type: 'sentences',
        level: li + 1,
        title: `Missing word ${li + 1}${SET_NAMES[set]}`,
        content: {
          items: items.slice(set * 5, set * 5 + 5).map(([sentence, answer, w1, w2]) => ({
            sentence, answer, options: shuffle([answer, w1, w2], rand),
          })),
        },
      });
    }
  });

  PICTURE_LEVELS.forEach((items, li) => {
    for (let set = 0; set < 2; set++) {
      out.push({
        type: 'pictures',
        level: li + 1,
        title: `Sentence and picture ${li + 1}${SET_NAMES[set]}`,
        content: { items: items.slice(set * 4, set * 4 + 4).map(([sentence, emoji]) => ({ sentence, picture: { emoji } })) },
      });
    }
  });

  STORY_LEVELS.forEach((stories, li) => {
    for (const s of stories) {
      out.push({
        type: 'stories',
        level: li + 1,
        title: s.title,
        content: {
          text: s.text,
          questions: s.questions.map(([question, answer, w1, w2]) => ({ question, answer, options: shuffle([answer, w1, w2], rand) })),
        },
      });
    }
  });

  return out;
}

/** Adds the shared exercises on first start. Returns how many were added. */
export function seedContent(db: DB): number {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM exercises WHERE teacher_id IS NULL').get() as { n: number };
  if (n > 0) return 0;
  const all = buildSeedExercises();
  const insert = db.prepare('INSERT INTO exercises (type, level, title, content) VALUES (?, ?, ?, ?)');
  tx(db, () => {
    for (const e of all) insert.run(e.type, e.level, e.title, JSON.stringify(validateContent(e.type, e.content)));
  });
  return all.length;
}
