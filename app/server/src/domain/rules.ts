import { randomInt } from 'node:crypto';

/** Spec B req 6: letters, words, sentences, stories — plus the sentence–picture exercises of req 5. */
export const TYPES = ['letters', 'words', 'sentences', 'pictures', 'stories'] as const;
export type ExerciseType = (typeof TYPES)[number];
export const isType = (v: unknown): v is ExerciseType => typeof v === 'string' && (TYPES as readonly string[]).includes(v);

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

/** Req 15: every question has a time limit (seconds). Teacher texts may set their own. */
export const TIME_LIMITS: Record<ExerciseType, number> = {
  letters: 15,
  words: 20,
  sentences: 30,
  pictures: 30,
  stories: 60,
};

export class RuleError extends Error {}

// ---------- Content ----------

export type Picture = { emoji: string } | { imageId: number };

export interface LettersContent { items: Array<{ target: string; say: string; options: string[] }> }
export interface WordsContent { items: Array<{ target: string; options: string[] }> }
export interface SentencesContent { items: Array<{ sentence: string; answer: string; options: string[] }> }
export interface PicturesContent { items: Array<{ sentence: string; picture: Picture }> }
export interface StoriesContent { text: string; questions: Array<{ question: string; answer: string; options: string[] }> }
export type Content = (LettersContent | WordsContent | SentencesContent | PicturesContent | StoriesContent) & {
  timeLimitS?: number;
};

/** The correct answer for each question, in order. For pictures the answer is the item index. */
export function answerKey(type: ExerciseType, content: Content): string[] {
  switch (type) {
    case 'letters':
    case 'words':
      return (content as WordsContent).items.map((i) => i.target);
    case 'sentences':
      return (content as SentencesContent).items.map((i) => i.answer);
    case 'pictures':
      return (content as PicturesContent).items.map((_, i) => String(i));
    case 'stories':
      return (content as StoriesContent).questions.map((q) => q.answer);
  }
}

export const timeLimitS = (type: ExerciseType, content: Content) => content.timeLimitS ?? TIME_LIMITS[type];

const text = (v: unknown, field: string, max = 300): string => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new RuleError('invalid_' + field);
  return v.trim();
};

function options(v: unknown, answer: string): string[] {
  if (!Array.isArray(v) || v.length < 2 || v.length > 4) throw new RuleError('invalid_options');
  const out = v.map((o) => text(o, 'options', 80));
  if (new Set(out.map((o) => o.toLowerCase())).size !== out.length) throw new RuleError('duplicate_options');
  if (!out.includes(answer)) throw new RuleError('answer_not_in_options');
  return out;
}

/** Validates and normalises exercise content (used for seeds and teacher-made exercises). */
export function validateContent(type: ExerciseType, c: unknown): Content {
  if (!c || typeof c !== 'object') throw new RuleError('invalid_content');
  const raw = c as Record<string, unknown>;
  const extra: { timeLimitS?: number } = {};
  if (raw.timeLimitS !== undefined) {
    const n = raw.timeLimitS;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 10 || n > 300) throw new RuleError('invalid_time_limit');
    extra.timeLimitS = n;
  }
  const list = (v: unknown, field: string, min: number, max: number) => {
    if (!Array.isArray(v) || v.length < min || v.length > max) throw new RuleError('invalid_' + field);
    return v as Array<Record<string, unknown>>;
  };
  switch (type) {
    case 'letters':
      return {
        ...extra,
        items: list(raw.items, 'items', 1, 20).map((i) => {
          const target = text(i.target, 'target', 10);
          return { target, say: text(i.say ?? target, 'say', 80), options: options(i.options, target) };
        }),
      };
    case 'words':
      return {
        ...extra,
        items: list(raw.items, 'items', 1, 20).map((i) => {
          const target = text(i.target, 'target', 40);
          return { target, options: options(i.options, target) };
        }),
      };
    case 'sentences':
      return {
        ...extra,
        items: list(raw.items, 'items', 1, 20).map((i) => {
          const sentence = text(i.sentence, 'sentence', 200);
          if (!sentence.includes('___')) throw new RuleError('sentence_needs_gap');
          const answer = text(i.answer, 'answer', 40);
          return { sentence, answer, options: options(i.options, answer) };
        }),
      };
    case 'pictures':
      return {
        ...extra,
        items: list(raw.items, 'items', 2, 6).map((i) => {
          const p = i.picture as Record<string, unknown> | undefined;
          let picture: Picture;
          if (p && typeof p.emoji === 'string' && p.emoji.length <= 16) picture = { emoji: p.emoji };
          else if (p && Number.isInteger(p.imageId)) picture = { imageId: p.imageId as number };
          else throw new RuleError('invalid_picture');
          return { sentence: text(i.sentence, 'sentence', 200), picture };
        }),
      };
    case 'stories':
      return {
        ...extra,
        text: text(raw.text, 'text', 5000),
        questions: list(raw.questions, 'questions', 1, 8).map((q) => {
          const answer = text(q.answer, 'answer', 120);
          return { question: text(q.question, 'question', 200), answer, options: options(q.options, answer) };
        }),
      };
  }
}

// ---------- Scoring, points and levels ----------

export interface Answer {
  given: string | null; // null = time ran out
  ms: number;
}

export const POINTS_PER_CORRECT = 10;
export const MAX_SPEED_BONUS = 5;

/** Req 12 + 14: mark each answer, and give points for correct answers (faster = small bonus). */
export function score(type: ExerciseType, content: Content, answers: Answer[]) {
  const key = answerKey(type, content);
  if (answers.length !== key.length) throw new RuleError('wrong_answer_count');
  const limitMs = timeLimitS(type, content) * 1000;
  let correct = 0;
  let points = 0;
  const marked = answers.map((a, i) => {
    const ok = a.given !== null && a.given === key[i];
    if (ok) {
      correct++;
      const ms = Math.min(Math.max(a.ms, 0), limitMs);
      points += POINTS_PER_CORRECT + Math.floor(MAX_SPEED_BONUS * (1 - ms / limitMs));
    }
    return { given: a.given, ms: Math.max(0, Math.round(a.ms)), correct: ok, answer: key[i] };
  });
  return { correct, total: key.length, points, marked };
}

/**
 * Req 7: the system figures out the level automatically.
 * 80 % or more correct → one level up; under 50 % → one level down; otherwise stay.
 */
export function nextLevel(level: number, correct: number, total: number): number {
  const pct = total ? correct / total : 0;
  if (pct >= 0.8) return Math.min(MAX_LEVEL, level + 1);
  if (pct < 0.5) return Math.max(MIN_LEVEL, level - 1);
  return level;
}

// ---------- Codes and names ----------

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
export function generateClassCode(exists: (code: string) => boolean): string {
  for (;;) {
    let c = '';
    for (let i = 0; i < 6; i++) c += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!exists(c)) return c;
  }
}

/** Names are compared ignoring case and extra spaces, so "anna  smith" matches "Anna Smith". */
export const normaliseName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export const STUDENT_NUMBER_RE = /^[A-Za-z0-9_-]{1,30}$/;

// ---------- Kid settings (req 10, 11) ----------

export const FONTS = ['OpenDyslexic', 'Lexend', 'Atkinson Hyperlegible', 'Arial', 'Verdana', 'Comic Sans MS'] as const;

export interface Settings {
  font: (typeof FONTS)[number];
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  textColor: string;
  background: string;
  highlight: string;
  speechRate: number;
}

/** Default: a dyslexia-friendly font (req 11) on a soft cream background. */
export const DEFAULT_SETTINGS: Settings = {
  font: 'OpenDyslexic',
  fontSize: 22,
  letterSpacing: 0.05,
  lineHeight: 1.8,
  textColor: '#1f2933',
  background: '#fdf6e3',
  highlight: '#ffd54f',
  speechRate: 0.9,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export function validateSettings(v: unknown): Settings {
  if (!v || typeof v !== 'object') throw new RuleError('invalid_settings');
  const s = { ...DEFAULT_SETTINGS, ...(v as Partial<Settings>) };
  const num = (n: unknown, min: number, max: number, f: string) => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new RuleError('invalid_' + f);
    return n;
  };
  if (!FONTS.includes(s.font)) throw new RuleError('invalid_font');
  for (const k of ['textColor', 'background', 'highlight'] as const) {
    if (typeof s[k] !== 'string' || !HEX.test(s[k])) throw new RuleError('invalid_' + k);
  }
  return {
    font: s.font,
    fontSize: num(s.fontSize, 14, 48, 'fontSize'),
    letterSpacing: num(s.letterSpacing, 0, 0.4, 'letterSpacing'),
    lineHeight: num(s.lineHeight, 1.2, 3, 'lineHeight'),
    textColor: s.textColor.toLowerCase(),
    background: s.background.toLowerCase(),
    highlight: s.highlight.toLowerCase(),
    speechRate: num(s.speechRate, 0.5, 1.5, 'speechRate'),
  };
}

export function parseSettings(json: string): Settings {
  try {
    return validateSettings(JSON.parse(json));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// ---------- Password ----------

export function checkPassword(pw: unknown): string {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 200) throw new RuleError('weak_password');
  return pw;
}
