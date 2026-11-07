/**
 * Text-to-speech (FR-SUP-01, FR-SUP-02, FR-EX-02).
 *
 * Provider: the browser's Web Speech API. Only the text is passed to the speech engine —
 * never a child identifier (NFR-PRV-04). A server-side TTS service with word timings
 * (assumption A-1, open issue OI-1) can replace this module behind the same interface.
 */

export type Lang = 'en' | 'fi';
const VOICE_LANG: Record<Lang, string> = { en: 'en-GB', fi: 'fi-FI' };

export interface SpeakOptions {
  lang: Lang;
  rate?: number;
  /** Called with the index of the word being spoken (words = text split on whitespace). */
  onWord?: (index: number) => void;
  onEnd?: () => void;
}

export const ttsAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function pickVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const want = VOICE_LANG[lang].toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === want) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(lang))
  );
}

/** Start offsets of each whitespace-separated word. */
export function wordOffsets(text: string): number[] {
  const out: number[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m.index);
  return out;
}

let fallbackTimer: number | undefined;
let generation = 0;

let seqId = 0;

export function stop() {
  seqId++;
  stopAudio();
}

function stopAudio() {
  generation++;
  window.clearTimeout(fallbackTimer);
  if (ttsAvailable()) window.speechSynthesis.cancel();
}

/** Speak text. Resolves when finished (or interrupted). */
export function speak(text: string, opts: SpeakOptions): Promise<void> {
  seqId++;
  return speakOne(text, opts);
}

function speakOne(text: string, opts: SpeakOptions): Promise<void> {
  stopAudio();
  const gen = generation;
  return new Promise((resolve) => {
    if (!ttsAvailable() || !text.trim()) {
      opts.onEnd?.();
      return resolve();
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = VOICE_LANG[opts.lang];
    const v = pickVoice(opts.lang);
    if (v) u.voice = v;
    u.rate = opts.rate ?? 1;
    const offsets = wordOffsets(text);
    let gotBoundary = false;
    let lastIdx = -1;
    const emit = (i: number) => {
      if (gen !== generation || i === lastIdx) return;
      lastIdx = i;
      opts.onWord?.(i);
    };
    u.onboundary = (e) => {
      if (e.name && e.name !== 'word') return;
      gotBoundary = true;
      let idx = 0;
      for (let i = 0; i < offsets.length; i++) if (offsets[i] <= e.charIndex) idx = i;
      emit(idx);
    };
    u.onstart = () => {
      if (!opts.onWord) return;
      emit(0);
      // Some engines do not emit word boundaries: estimate timing from word length instead.
      const words = text.split(/\s+/).filter(Boolean);
      let i = 0;
      const tick = () => {
        if (gotBoundary || gen !== generation) return;
        emit(i);
        const ms = (words[i].length * 65 + 180) / (opts.rate ?? 1);
        i++;
        if (i < words.length) fallbackTimer = window.setTimeout(tick, ms);
      };
      fallbackTimer = window.setTimeout(() => !gotBoundary && tick(), 400);
    };
    const done = () => {
      window.clearTimeout(fallbackTimer);
      if (gen === generation) {
        opts.onWord?.(-1);
        opts.onEnd?.();
      }
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  });
}

/** Speak several pieces in sequence (e.g. syllables, then the whole word — FR-SUP-07). */
export async function speakSequence(parts: string[], opts: SpeakOptions) {
  const my = ++seqId;
  for (const p of parts) {
    if (my !== seqId) return; // interrupted by another speak() or stop()
    await speakOne(p, { lang: opts.lang, rate: opts.rate });
  }
}

// Voices load asynchronously in Chrome.
if (ttsAvailable()) window.speechSynthesis.getVoices();
