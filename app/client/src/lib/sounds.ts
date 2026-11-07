/** Short synthesized feedback sounds (FR-EX-04) — no audio files, no network. */
let ctx: AudioContext | null = null;

function tone(freqs: number[], dur: number, type: OscillatorType = 'sine', gain = 0.18) {
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = type;
      o.frequency.value = f;
      const start = t0 + i * dur;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(gain, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur * 1.6);
      o.connect(g).connect(ctx!.destination);
      o.start(start);
      o.stop(start + dur * 1.7);
    });
  } catch {
    /* audio not available */
  }
}

/** Rising major arpeggio for a correct answer. */
export const playCorrect = () => tone([523.25, 659.25, 783.99], 0.11, 'triangle');
/** Soft, neutral two-note "let's try again" — deliberately not a buzzer. */
export const playTryAgain = () => tone([440, 392], 0.13, 'sine', 0.12);
/** Little fanfare at the end of an exercise. */
export const playFinish = () => tone([523.25, 659.25, 783.99, 1046.5], 0.12, 'triangle');
