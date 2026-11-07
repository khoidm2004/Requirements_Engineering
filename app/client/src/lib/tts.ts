/**
 * Read aloud with a computer voice (Spec B req 9), using the browser's Web Speech API.
 * Only the text is passed to the speech engine. `onWord` gets the index of the word being
 * spoken so the UI can highlight it; engines without word events get a timing estimate.
 */

export interface SpeakOptions {
  rate?: number;
  onWord?: (index: number) => void;
}

export const ttsAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'en-GB' && v.localService) ??
    voices.find((v) => v.lang === 'en-GB') ??
    voices.find((v) => v.lang.startsWith('en'))
  );
}

let generation = 0;
let fallbackTimer: number | undefined;

export function stopSpeaking() {
  generation++;
  window.clearTimeout(fallbackTimer);
  if (ttsAvailable()) window.speechSynthesis.cancel();
}

/** Speaks text; resolves when finished or interrupted by another call. */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  stopSpeaking();
  const gen = generation;
  return new Promise((resolve) => {
    if (!ttsAvailable() || !text.trim()) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = opts.rate ?? 1;

    const starts: number[] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) starts.push(m.index);

    let gotBoundary = false;
    const emit = (i: number) => gen === generation && opts.onWord?.(i);
    u.onboundary = (e) => {
      if (e.name && e.name !== 'word') return;
      gotBoundary = true;
      let idx = 0;
      for (let i = 0; i < starts.length; i++) if (starts[i] <= e.charIndex) idx = i;
      emit(idx);
    };
    u.onstart = () => {
      if (!opts.onWord) return;
      emit(0);
      const words = text.split(/\s+/).filter(Boolean);
      let i = 0;
      const tick = () => {
        if (gotBoundary || gen !== generation) return;
        emit(i);
        const ms = (words[i].length * 70 + 200) / (opts.rate ?? 1);
        if (++i < words.length) fallbackTimer = window.setTimeout(tick, ms);
      };
      fallbackTimer = window.setTimeout(() => !gotBoundary && tick(), 350);
    };
    const done = () => {
      window.clearTimeout(fallbackTimer);
      emit(-1);
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  });
}

// Chrome loads voices asynchronously.
if (ttsAvailable()) window.speechSynthesis.getVoices();
