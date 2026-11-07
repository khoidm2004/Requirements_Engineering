/**
 * Syllabification used by E2 (syllable exercise) and FR-SUP-07 (word help).
 *
 * Finnish: the standard rule-based algorithm (a consonant followed by a vowel starts a new
 * syllable; vowel sequences split unless they form a diphthong or long vowel).
 * English: English syllabification is not rule-based, so E2 content carries hand-annotated
 * splits; for arbitrary words (word help) a vowel-group heuristic is used.
 */

const FI_VOWELS = 'aeiouyäöå';
const FI_DIPHTHONGS = new Set([
  'ai', 'ei', 'oi', 'ui', 'yi', 'äi', 'öi', 'au', 'eu', 'iu', 'ou', 'äy', 'ey', 'iy', 'öy', 'ie', 'uo', 'yö',
]);

const isFiVowel = (c: string) => FI_VOWELS.includes(c.toLowerCase());

export function syllabifyFi(word: string): string[] {
  const w = word;
  const lower = w.toLowerCase();
  const breaks: number[] = [];
  for (let i = 1; i < w.length; i++) {
    const prev = lower[i - 1];
    const cur = lower[i];
    const next = lower[i + 1];
    // Consonant + vowel starts a syllable (if something precedes it)
    if (!isFiVowel(cur) && next !== undefined && isFiVowel(next) && i > 0) {
      // ensure the syllable before contains a vowel
      const before = lower.slice(breaks.at(-1) ?? 0, i);
      if ([...before].some(isFiVowel)) breaks.push(i);
      continue;
    }
    if (isFiVowel(prev) && isFiVowel(cur)) {
      const pair = prev + cur;
      const syllStart = breaks.at(-1) ?? 0;
      const vowelsInSyll = [...lower.slice(syllStart, i)].filter(isFiVowel).length;
      const long = prev === cur;
      // Diphthongs ie/uo/yö only in the first syllable
      const firstOnly = pair === 'ie' || pair === 'uo' || pair === 'yö';
      const ok = (long || (FI_DIPHTHONGS.has(pair) && (!firstOnly || syllStart === 0))) && vowelsInSyll < 2;
      if (!ok) breaks.push(i);
    }
  }
  return splitAt(w, breaks);
}

const EN_VOWELS = 'aeiouy';
export function syllabifyEnHeuristic(word: string): string[] {
  const w = word;
  const lower = w.toLowerCase();
  // indices of vowel-group starts
  const groups: Array<[number, number]> = [];
  for (let i = 0; i < lower.length; i++) {
    const v = EN_VOWELS.includes(lower[i]) && !(lower[i] === 'y' && i === 0);
    if (v) {
      const start = i;
      while (i + 1 < lower.length && EN_VOWELS.includes(lower[i + 1])) i++;
      groups.push([start, i]);
    }
  }
  // silent final e
  const last = groups.at(-1);
  if (groups.length > 1 && last && last[0] === lower.length - 1 && lower.endsWith('e') && !lower.endsWith('le')) {
    groups.pop();
  }
  if (groups.length <= 1) return [w];
  const breaks: number[] = [];
  for (let g = 1; g < groups.length; g++) {
    const prevEnd = groups[g - 1][1];
    const start = groups[g][0];
    const consonants = start - prevEnd - 1;
    // V-CV: break before single consonant; VC-CV: break between consonants
    breaks.push(consonants <= 1 ? prevEnd + 1 : prevEnd + 1 + Math.floor(consonants / 2));
  }
  return splitAt(w, breaks);
}

function splitAt(w: string, breaks: number[]): string[] {
  const out: string[] = [];
  let s = 0;
  for (const b of breaks) {
    if (b > s && b < w.length) {
      out.push(w.slice(s, b));
      s = b;
    }
  }
  out.push(w.slice(s));
  return out;
}

export function syllabify(word: string, language: 'en' | 'fi'): string[] {
  return language === 'fi' ? syllabifyFi(word) : syllabifyEnHeuristic(word);
}
