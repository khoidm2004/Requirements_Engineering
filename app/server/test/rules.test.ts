import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS, MAX_LEVEL, MIN_LEVEL, RuleError, answerKey, generateClassCode, nextLevel, normaliseName, parseSettings,
  score, validateContent, validateSettings,
} from '../src/domain/rules.js';
import { csvCell, toCsv } from '../src/services.js';
import { sniffAudio, sniffImage } from '../src/storage.js';

describe('nextLevel (req 7)', () => {
  it('goes up at 80 % or more', () => {
    expect(nextLevel(2, 4, 5)).toBe(3);
    expect(nextLevel(2, 5, 5)).toBe(3);
  });
  it('goes down under 50 %', () => {
    expect(nextLevel(3, 2, 5)).toBe(2);
    expect(nextLevel(3, 0, 5)).toBe(2);
  });
  it('stays between 50 % and 80 %', () => {
    expect(nextLevel(3, 3, 5)).toBe(3);
    expect(nextLevel(3, 1, 2)).toBe(3);
  });
  it('stays within 1–5', () => {
    expect(nextLevel(MAX_LEVEL, 5, 5)).toBe(MAX_LEVEL);
    expect(nextLevel(MIN_LEVEL, 0, 5)).toBe(MIN_LEVEL);
  });
});

describe('score (req 12, 14, 15)', () => {
  const content = validateContent('words', {
    items: [
      { target: 'cat', options: ['cat', 'cot', 'cut'] },
      { target: 'dog', options: ['dog', 'dig', 'dug'] },
    ],
  });

  it('marks answers and gives the right answer back', () => {
    const r = score('words', content, [{ given: 'cat', ms: 20000 }, { given: 'dig', ms: 1000 }]);
    expect(r.correct).toBe(1);
    expect(r.total).toBe(2);
    expect(r.marked[1]).toMatchObject({ given: 'dig', correct: false, answer: 'dog' });
  });

  it('gives 10 points per correct answer plus up to 5 for speed', () => {
    expect(score('words', content, [{ given: 'cat', ms: 0 }, { given: 'dog', ms: 0 }]).points).toBe(30);
    expect(score('words', content, [{ given: 'cat', ms: 20000 }, { given: null, ms: 20000 }]).points).toBe(10);
    // more time than the limit counts as the limit
    expect(score('words', content, [{ given: 'cat', ms: 999999 }, { given: 'x', ms: 0 }]).points).toBe(10);
  });

  it('treats a timed-out question (null) as wrong', () => {
    expect(score('words', content, [{ given: null, ms: 20000 }, { given: null, ms: 20000 }]).correct).toBe(0);
  });

  it('rejects the wrong number of answers', () => {
    expect(() => score('words', content, [{ given: 'cat', ms: 1 }])).toThrow(RuleError);
  });

  it('uses the item index as the answer for sentence–picture exercises', () => {
    const c = validateContent('pictures', { items: [{ sentence: 'a cat', picture: { emoji: '🐱' } }, { sentence: 'a dog', picture: { imageId: 3 } }] });
    expect(answerKey('pictures', c)).toEqual(['0', '1']);
  });
});

describe('validateContent', () => {
  it('requires the answer to be one of the options', () => {
    expect(() => validateContent('sentences', { items: [{ sentence: 'A ___.', answer: 'cat', options: ['dog', 'cow'] }] })).toThrow(
      'answer_not_in_options',
    );
  });
  it('requires a gap in sentences', () => {
    expect(() => validateContent('sentences', { items: [{ sentence: 'A cat.', answer: 'cat', options: ['cat', 'cow'] }] })).toThrow(
      'sentence_needs_gap',
    );
  });
  it('requires 1–8 questions for stories and accepts a time limit', () => {
    expect(() => validateContent('stories', { text: 'Hi.', questions: [] })).toThrow('invalid_questions');
    const c = validateContent('stories', {
      text: ' A story. ', timeLimitS: 90, questions: [{ question: 'Q?', answer: 'a', options: ['a', 'b'] }],
    });
    expect(c).toMatchObject({ text: 'A story.', timeLimitS: 90 });
    expect(() => validateContent('stories', { text: 'x', timeLimitS: 5, questions: [] })).toThrow('invalid_time_limit');
  });
  it('rejects duplicate options', () => {
    expect(() => validateContent('words', { items: [{ target: 'cat', options: ['cat', 'Cat'] }] })).toThrow('duplicate_options');
  });
  it('needs 2–6 pictures', () => {
    expect(() => validateContent('pictures', { items: [{ sentence: 'a', picture: { emoji: '🐱' } }] })).toThrow('invalid_items');
  });
});

describe('settings (req 10, 11)', () => {
  it('defaults to a dyslexia-friendly font', () => {
    expect(DEFAULT_SETTINGS.font).toBe('OpenDyslexic');
    expect(parseSettings('{}').font).toBe('OpenDyslexic');
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
  });
  it('validates values', () => {
    expect(validateSettings({ fontSize: 30, background: '#FFFFFF' })).toMatchObject({ fontSize: 30, background: '#ffffff' });
    expect(() => validateSettings({ fontSize: 100 })).toThrow('invalid_fontSize');
    expect(() => validateSettings({ font: 'Papyrus' })).toThrow('invalid_font');
    expect(() => validateSettings({ textColor: 'red' })).toThrow('invalid_textColor');
  });
});

describe('helpers', () => {
  it('makes 6-character class codes without look-alike characters', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const c = generateClassCode((x) => seen.has(x));
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      seen.add(c);
    }
  });
  it('compares names ignoring case and spaces', () => {
    expect(normaliseName('  Anna   SMITH ')).toBe(normaliseName('anna smith'));
  });
  it('escapes CSV cells and blocks spreadsheet formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=1+1')).toBe(`"'=1+1"`);
    expect(csvCell(null)).toBe('');
    expect(toCsv([['a', 1], ['b', 2]])).toBe('a,1\r\nb,2\r\n');
  });
  it('detects file types from content', () => {
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.mime).toBe('image/png');
    expect(sniffImage(Buffer.from('<svg></svg>'))).toBeNull();
    expect(sniffAudio(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0]))?.mime).toBe('audio/webm');
    expect(sniffAudio(Buffer.from('hello world'))).toBeNull();
  });
});
