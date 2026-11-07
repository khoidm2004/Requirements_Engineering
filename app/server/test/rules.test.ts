import { describe, it, expect } from 'vitest';
import {
  nextLevel, starsFor, initialLevel, generateClassCode, mergeSettings, DEFAULT_SETTINGS,
  pickPracticeTypes, countWords, normalizeStudentNumber, normalizeName, isValidLabel,
} from '../src/domain/rules.js';
import { checkTeacherPassword } from '../src/domain/passwords.js';
import { syllabifyFi, syllabifyEnHeuristic } from '../../shared/syllables.js';

describe('FR-EX-06 adaptive difficulty', () => {
  it('rule 1: ≥ 85 % in 3 consecutive exercises → +1', () => {
    expect(nextLevel(4, [0.85, 0.9, 1])).toBe(5);
    expect(nextLevel(4, [0.5, 0.85, 0.9, 1])).toBe(5);
  });
  it('rule 1 needs three in a row', () => {
    expect(nextLevel(4, [0.9, 1])).toBe(4);
    expect(nextLevel(4, [0.9, 0.84, 1])).toBe(4);
  });
  it('rule 2: < 50 % in 2 consecutive exercises → −1', () => {
    expect(nextLevel(4, [0.4, 0.49])).toBe(3);
    expect(nextLevel(4, [0.4, 0.5])).toBe(4);
    expect(nextLevel(4, [0.3])).toBe(4);
  });
  it('rule 3: upper boundary 10', () => {
    expect(nextLevel(10, [1, 1, 1])).toBe(10);
  });
  it('rule 3: lower boundary 1', () => {
    expect(nextLevel(1, [0, 0])).toBe(1);
  });
  it('no change in between', () => {
    expect(nextLevel(5, [0.6, 0.7, 0.8])).toBe(5);
    expect(nextLevel(5, [])).toBe(5);
  });
});

describe('FR-MOT-01 stars', () => {
  it.each([
    [10, 10, 3], [9, 10, 3], [8, 10, 2], [7, 10, 2], [6, 10, 1], [5, 10, 1], [2, 10, 1], [0, 10, 1],
  ])('%i/%i correct → %i stars', (c, n, s) => expect(starsFor(c, n)).toBe(s));
});

describe('FR-EX-07 initial placement', () => {
  const now = new Date('2026-09-01');
  it.each([[2020, 1], [2019, 1], [2018, 3], [2017, 3], [2016, 5], [2014, 5]])('born %i → level %i', (y, l) =>
    expect(initialLevel(y, now)).toBe(l));
});

describe('FR-ACC-03 class code', () => {
  it('is 6 unambiguous characters', () => {
    for (let i = 0; i < 200; i++) expect(generateClassCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });
});

describe('FR-ACC-04/05 student number and name', () => {
  it('normalises student numbers (trim, upper case) and rejects odd input', () => {
    expect(normalizeStudentNumber(' ab-123 ')).toBe('AB-123');
    expect(normalizeStudentNumber('12345')).toBe('12345');
    expect(normalizeStudentNumber('')).toBeNull();
    expect(normalizeStudentNumber('a b')).toBeNull();
    expect(normalizeStudentNumber('-12')).toBeNull();
    expect(normalizeStudentNumber('x'.repeat(21))).toBeNull();
    expect(normalizeStudentNumber(123)).toBeNull();
  });
  it('compares names case-insensitively, ignoring extra spaces (also ä/ö)', () => {
    expect(normalizeName('  Äiti  Möttönen ')).toBe(normalizeName('äiti möttönen'));
    expect(normalizeName('Mia')).not.toBe(normalizeName('Mira'));
  });
});

describe('FR-CNT-05 picture labels', () => {
  it('accepts 1–5 words', () => {
    expect(isValidLabel('a red ball')).toBe(true);
    expect(isValidLabel('ball')).toBe(true);
    expect(isValidLabel('one two three four five')).toBe(true);
    expect(isValidLabel('one two three four five six')).toBe(false);
    expect(isValidLabel('   ')).toBe(false);
    expect(isValidLabel(undefined)).toBe(false);
  });
});

describe('NFR-SEC-03 teacher password', () => {
  it('requires ≥ 10 characters', () => expect(checkTeacherPassword('short123')).toBe('too_short'));
  it('rejects breached passwords', () => expect(checkTeacherPassword('Password123')).toBe('breached'));
  it('accepts a good password', () => expect(checkTeacherPassword('purple-otter-lamp')).toBeNull());
});

describe('FR-SUP settings', () => {
  it('merges valid values', () => {
    expect(mergeSettings({}, { font: 'OpenDyslexic', fontSize: 32 })).toEqual({ ...DEFAULT_SETTINGS, font: 'OpenDyslexic', fontSize: 32 });
  });
  it('rejects values outside the allowed sets', () => {
    expect(() => mergeSettings({}, { fontSize: 40 })).toThrow();
    expect(() => mergeSettings({}, { rate: 2 })).toThrow();
    expect(() => mergeSettings({}, { color: 'red' })).toThrow();
  });
  it('defaults match the specification', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ rate: 1, font: 'Lexend', fontSize: 22, lineSpacing: 1.5, letterSpacing: 'normal', background: 'cream', syllableColours: false });
  });
});

describe('FR-EX-10 practice type selection', () => {
  it('fills up to 3 with lowest-accuracy types, untried first', () => {
    expect(pickPracticeTypes({ E1: 0.9, E2: 0.5, E3: 0.7, E4: 0.95, E5: 0.6 }, 0)).toEqual(['E2', 'E5', 'E3']);
    expect(pickPracticeTypes({ E1: 0.9, E2: 0.5, E3: 0.7, E4: 0.95 }, 0)).toEqual(['E5', 'E2', 'E3']);
    expect(pickPracticeTypes({}, 2)).toHaveLength(1);
    expect(pickPracticeTypes({}, 3)).toHaveLength(0);
  });
});

describe('syllabification', () => {
  it.each([
    ['kissa', 'kis-sa'], ['talo', 'ta-lo'], ['koira', 'koi-ra'], ['aamu', 'aa-mu'], ['hyvää', 'hy-vää'],
    ['lukea', 'lu-ke-a'], ['banaani', 'ba-naa-ni'], ['mansikka', 'man-sik-ka'], ['strategia', 'stra-te-gi-a'],
  ])('fi %s → %s', (w, s) => expect(syllabifyFi(w).join('-')).toBe(s));
  it.each([['banana', 'ba-na-na'], ['rabbit', 'rab-bit'], ['cake', 'cake'], ['cat', 'cat']])('en %s → %s', (w, s) =>
    expect(syllabifyEnHeuristic(w).join('-')).toBe(s));
});

describe('countWords', () => {
  it('counts whitespace-separated words', () => expect(countWords('  one two\nthree  ')).toBe(3));
});
