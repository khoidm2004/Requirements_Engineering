import { randomInt } from 'node:crypto';

export const EXERCISE_TYPES = ['E1', 'E2', 'E3', 'E4', 'E5'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];
/** FR-CNT-03 — types covered by the shared (seeded) library. E4 comes only from teachers (FR-CNT-05). */
export const SHARED_TYPES = ['E1', 'E2', 'E3', 'E5'] as const satisfies readonly ExerciseType[];
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;
export const LANGUAGES = ['en', 'fi'] as const;
export type Language = (typeof LANGUAGES)[number];

/**
 * FR-EX-06 — Adaptive difficulty.
 * `accuracies` are the accuracies (0..1) of the child's completed exercises of ONE type,
 * oldest first, recorded at the CURRENT level since the last level change.
 *  - ≥ 85 % in 3 consecutive exercises → +1
 *  - < 50 % in 2 consecutive exercises → −1
 *  - level is clamped to 1..10
 */
export function nextLevel(current: number, accuracies: number[]): number {
  const last3 = accuracies.slice(-3);
  const last2 = accuracies.slice(-2);
  let level = current;
  if (last3.length === 3 && last3.every((a) => a >= 0.85)) level = current + 1;
  else if (last2.length === 2 && last2.every((a) => a < 0.5)) level = current - 1;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));
}

/**
 * FR-MOT-01 — Stars. Every completed exercise earns at least 1 star.
 * ≥ 90 % → 3, ≥ 70 % → 2, otherwise (including < 50 %) → 1.
 */
export function starsFor(correct: number, items: number): number {
  const acc = items > 0 ? correct / items : 0;
  if (acc >= 0.9) return 3;
  if (acc >= 0.7) return 2;
  return 1;
}

/** FR-EX-07 — Initial placement from age: 6–7 → 1, 8–9 → 3, 10–12 → 5. */
export function initialLevel(birthYear: number, now = new Date()): number {
  const age = now.getFullYear() - birthYear;
  if (age >= 10) return 5;
  if (age >= 8) return 3;
  return 1;
}

/** FR-ACC-03 — 6-character class code; ambiguous characters (0/O, 1/I/L) excluded. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generateClassCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/** §2.3 — a teacher manages up to 10 classes of up to 35 children. */
export const MAX_CLASSES = 10;
export const MAX_STUDENTS_PER_CLASS = 35;

/**
 * FR-ACC-04 / A-5 — student numbers are unique platform-wide. They are compared without
 * surrounding whitespace and case-insensitively, so "ab-12" and "AB-12" are the same number.
 */
export const STUDENT_NUMBER_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,19}$/;
export function normalizeStudentNumber(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toUpperCase();
  return STUDENT_NUMBER_RE.test(s) ? s : null;
}

/** FR-ACC-05 — names match case-insensitively; extra spaces are ignored. */
export function normalizeName(v: string): string {
  return v.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fi');
}

/** FR-ACC-05 — after 5 consecutive failed attempts the student number is locked for 5 minutes. */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 5;

/** FR-ACC-06 — idle timeouts. */
export const CHILD_IDLE_MS = 20 * 60 * 1000;
export const TEACHER_IDLE_MS = 30 * 60 * 1000;

/** FR-ACC-02 / FR-ACC-07 */
export const VERIFY_TOKEN_HOURS = 24;
export const RESET_TOKEN_HOURS = 1;

/** FR-SUP-02..06 — per-child settings and their allowed values. */
export const SETTING_OPTIONS = {
  rate: [0.6, 0.8, 1.0, 1.2],
  font: ['Lexend', 'OpenDyslexic', 'Atkinson Hyperlegible', 'Arial'],
  fontSize: [18, 22, 26, 32],
  lineSpacing: [1.5, 2.0, 2.5],
  letterSpacing: ['normal', 'wide'],
  background: ['cream', 'lightyellow', 'lightblue', 'lightgreen', 'white'],
  lineFocus: [false, true],
  syllableColours: [false, true],
} as const;

export type ChildSettings = {
  [K in keyof typeof SETTING_OPTIONS]: (typeof SETTING_OPTIONS)[K][number];
};

export const DEFAULT_SETTINGS: ChildSettings = {
  rate: 1.0,
  font: 'Lexend',
  fontSize: 22,
  lineSpacing: 1.5,
  letterSpacing: 'normal',
  background: 'cream',
  lineFocus: false,
  syllableColours: false,
};

/** Merge a partial update into settings, rejecting values outside the allowed sets. */
export function mergeSettings(current: Partial<ChildSettings>, patch: Record<string, unknown>): ChildSettings {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS, ...current };
  for (const [k, v] of Object.entries(patch)) {
    const allowed = (SETTING_OPTIONS as Record<string, readonly unknown[]>)[k];
    if (!allowed) throw new RuleError(`Unknown setting: ${k}`);
    if (!allowed.includes(v)) throw new RuleError(`Invalid value for ${k}`);
    out[k] = v;
  }
  return out as ChildSettings;
}

/** FR-EX-08 — resume within 24 hours. */
export const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

/** FR-EX-03 — exercises E1–E4 contain 5–10 items. */
export const MIN_ITEMS = 5;
export const MAX_ITEMS = 10;

/** FR-CNT-02 / FR-EX-01 E5 — passage of 40–250 words with exactly 3 questions. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** FR-CNT-05 — picture label of 1–5 words. */
export function isValidLabel(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const n = countWords(v);
  return n >= 1 && n <= 5 && v.trim().length <= 60;
}

export class RuleError extends Error {
  status = 400;
}

/**
 * FR-EX-10 — "Today's practice": 3 exercises. Teacher assignments that are still open come first
 * (earliest due date first); the rest are filled from the exercise types where the child's
 * accuracy is lowest (types never practised count as 0 % so that they are tried).
 */
export function pickPracticeTypes(
  accuracyByType: Partial<Record<ExerciseType, number>>,
  alreadyChosen: number,
  available: readonly ExerciseType[] = EXERCISE_TYPES,
): ExerciseType[] {
  const need = Math.max(0, 3 - alreadyChosen);
  return [...available]
    .sort((a, b) => (accuracyByType[a] ?? 0) - (accuracyByType[b] ?? 0) || a.localeCompare(b))
    .slice(0, need);
}
