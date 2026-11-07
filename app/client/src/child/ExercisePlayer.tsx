import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { speak, speakSequence, stop } from '../lib/tts';
import { playCorrect, playTryAgain } from '../lib/sounds';
import { SpeakButton, SpeakerIcon } from '../components/Speak';
import { ReadingText } from '../components/ReadingText';
import { DEFAULT_SETTINGS, type ChildSettings } from '../lib/constants';

type Lang = 'en' | 'fi';
interface E1Item { answer: string; say: string; options: string[] }
interface E2Item { word: string; syllables: string[] }
interface E3Item { word: string; options: string[] }
/** FR-CNT-05 — teacher item: sentence + 3 uploaded pictures; the label is the picture's text alternative. */
interface E4Item { id: number; sentence: string; pictures: Array<{ url: string; label: string }>; answer: number }
interface E5Content { passage: string; questions: Array<{ q: string; options: string[]; answer: number }> }

export interface Exercise {
  id: number;
  type: 'E1' | 'E2' | 'E3' | 'E4' | 'E5';
  level: number;
  language: Lang;
  title: string;
  content: { items?: unknown[]; itemIds?: number[] } & Partial<E5Content>;
  progress: SavedProgress | null;
}

export interface SavedProgress {
  index: number;
  results: boolean[];
  elapsedMs: number;
  /** E4 only: the teacher items making up this run, so a resumed exercise has the same items. */
  itemIds?: number[];
}

export interface Finished {
  items: number;
  correct: number;
  durationS: number;
}

type Phase = 'answer' | 'correct' | 'reveal';

/** Correct boundaries (indices between letters) for an E2 word. */
function syllableBreaks(syl: string[]): number[] {
  const out: number[] = [];
  let n = 0;
  for (let i = 0; i < syl.length - 1; i++) out.push((n += syl[i].length));
  return out;
}

/**
 * Plays one exercise (FR-EX-01..05, FR-EX-08).
 * - spoken instruction at start + "repeat instruction" button (FR-EX-02)
 * - immediate feedback, no red / no "wrong" (FR-EX-04)
 * - one more attempt before the answer is revealed (FR-EX-05); an item counts as correct
 *   only if answered correctly on the first attempt
 * - progress saved after every item so the child can leave and resume (FR-EX-08)
 * - no visible timer (NFR-US-05); duration is measured silently for FR-PRG-01
 */
export function ExercisePlayer({
  exercise, settings = DEFAULT_SETTINGS, preview = false, onFinish, onExit,
}: {
  exercise: Exercise;
  settings?: ChildSettings;
  preview?: boolean;
  onFinish?: (r: Finished) => void;
  onExit?: () => void;
}) {
  const { t } = useI18n();
  const lang = exercise.language;
  const rate = settings.rate;
  const isPassage = exercise.type === 'E5';
  const items: unknown[] = useMemo(
    () => (isPassage ? exercise.content.questions ?? [] : exercise.content.items ?? []),
    [exercise, isPassage],
  );
  // Progress that no longer fits (e.g. a teacher item was removed meanwhile) starts the exercise afresh.
  const saved = exercise.progress && exercise.progress.index < items.length ? exercise.progress : null;
  const [index, setIndex] = useState(saved?.index ?? 0);
  const [results, setResults] = useState<boolean[]>(saved?.results ?? []);
  const [attempt, setAttempt] = useState(0);
  const [disabled, setDisabled] = useState<Array<string | number>>([]);
  const [phase, setPhase] = useState<Phase>('answer');
  const [splits, setSplits] = useState<number[]>([]);
  const started = useRef(Date.now());
  const elapsedBefore = useRef(saved?.elapsedMs ?? 0);
  const item = items[index];
  const instruction = t('ex.instr.' + exercise.type);

  const progressKey = `rb_progress_${exercise.id}`;
  const elapsed = () => elapsedBefore.current + (Date.now() - started.current);

  // Spoken instruction at the start of every exercise, then the first prompt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await speak(instruction, { lang, rate });
      if (!cancelled) speakPrompt(index);
    })();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function speakPrompt(i: number) {
    const it = items[i];
    if (!it) return;
    if (exercise.type === 'E1') speak((it as E1Item).say, { lang, rate });
    if (exercise.type === 'E3') speak((it as E3Item).word, { lang, rate });
  }

  function correctAnswer(): string | number {
    switch (exercise.type) {
      case 'E1': return (item as E1Item).answer;
      case 'E3': return (item as E3Item).word;
      case 'E4': return (item as E4Item).answer;
      case 'E5': return (item as E5Content['questions'][number]).answer;
      default: return syllableBreaks((item as E2Item).syllables).join(',');
    }
  }

  function speakCorrect() {
    switch (exercise.type) {
      case 'E1': return speak((item as E1Item).say, { lang, rate });
      case 'E3': return speak((item as E3Item).word, { lang, rate });
      case 'E2': return speakSequence([...(item as E2Item).syllables, (item as E2Item).word], { lang, rate: Math.min(rate, 0.9) });
      case 'E4': {
        const it = item as E4Item;
        return speak(it.pictures[it.answer].label, { lang, rate }); // FR-CNT-05: label read aloud on reveal
      }
      case 'E5': {
        const q = item as E5Content['questions'][number];
        return speak(q.options[q.answer], { lang, rate });
      }
    }
  }

  function persist(nextIndex: number, nextResults: boolean[]) {
    if (preview) return;
    const state: SavedProgress = { index: nextIndex, results: nextResults, elapsedMs: elapsed(), itemIds: exercise.content.itemIds };
    try {
      localStorage.setItem(progressKey, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    api('PUT', `/child/exercises/${exercise.id}/progress`, state).catch(() => {});
  }

  function answer(choice: string | number) {
    if (phase !== 'answer') return;
    const right = String(choice) === String(correctAnswer());
    if (right) {
      playCorrect();
      setPhase('correct');
      const r = [...results, attempt === 0];
      setResults(r);
      persist(index + 1, r);
      window.setTimeout(() => next(r), 1100);
    } else if (attempt === 0) {
      // FR-EX-05 — one more try
      playTryAgain();
      speak(t('ex.tryAgain'), { lang, rate });
      setAttempt(1);
      if (exercise.type !== 'E2') setDisabled((d) => [...d, choice]);
      else setSplits([]);
    } else {
      // Reveal the correct answer and say it aloud (FR-EX-04)
      setPhase('reveal');
      const r = [...results, false];
      setResults(r);
      persist(index + 1, r);
      speakCorrect();
    }
  }

  function next(r = results) {
    stop();
    if (index + 1 >= items.length) {
      try {
        localStorage.removeItem(progressKey);
      } catch {
        /* ignore */
      }
      onFinish?.({ items: items.length, correct: r.filter(Boolean).length, durationS: Math.round(elapsed() / 1000) });
      return;
    }
    const n = index + 1;
    setIndex(n);
    setAttempt(0);
    setDisabled([]);
    setSplits([]);
    setPhase('answer');
    window.setTimeout(() => speakPrompt(n), 150);
  }

  if (!item) return null;

  const optionClass = (value: string | number) => {
    const isCorrect = String(value) === String(correctAnswer());
    return [
      'opt',
      disabled.includes(value) ? 'opt--tried' : '',
      phase === 'correct' && isCorrect ? 'opt--correct' : '',
      phase === 'reveal' && isCorrect ? 'opt--reveal' : '',
    ].join(' ');
  };

  const textOptions = (options: string[], speakable: boolean) => (
    <div className={`opts ${options.length > 4 ? 'opts--many' : ''}`}>
      {options.map((o, i) => {
        const value = exercise.type === 'E5' ? i : o;
        return (
          <div className="opt-wrap" key={i}>
            <button type="button" className={optionClass(value)} disabled={disabled.includes(value) || phase !== 'answer'} onClick={() => answer(value)}>
              {o}
              {phase === 'correct' && String(value) === String(correctAnswer()) && <span className="burst" aria-hidden="true">⭐</span>}
            </button>
            {speakable && <SpeakButton text={o} lang={lang} rate={rate} />}
          </div>
        );
      })}
    </div>
  );

  let body: React.ReactNode;
  switch (exercise.type) {
    case 'E1': {
      const it = item as E1Item;
      body = (
        <>
          <button type="button" className="big-listen" onClick={() => speak(it.say, { lang, rate })} aria-label={t('ex.hearSound')}>
            <SpeakerIcon size={56} />
          </button>
          {textOptions(it.options, false)}
        </>
      );
      break;
    }
    case 'E3': {
      const it = item as E3Item;
      body = (
        <>
          <button type="button" className="big-listen" onClick={() => speak(it.word, { lang, rate })} aria-label={t('ex.hearWord')}>
            <SpeakerIcon size={56} />
          </button>
          {textOptions(it.options, false)}
        </>
      );
      break;
    }
    case 'E2': {
      const it = item as E2Item;
      const letters = [...it.word];
      const showBreaks = phase === 'reveal' || phase === 'correct' ? syllableBreaks(it.syllables) : splits;
      body = (
        <>
          <div className={`syl-word ${phase === 'correct' ? 'syl-word--correct' : ''} ${phase === 'reveal' ? 'syl-word--reveal' : ''}`} role="group" aria-label={t('ex.splitWord', { word: it.word })}>
            {letters.map((ch, i) => (
              <span key={i} className="syl-unit">
                <span className="syl-letter">{ch}</span>
                {i < letters.length - 1 && (
                  <button
                    type="button"
                    className={`syl-gap ${showBreaks.includes(i + 1) ? 'syl-gap--on' : ''}`}
                    aria-pressed={showBreaks.includes(i + 1)}
                    aria-label={t('ex.gap', { a: ch, b: letters[i + 1] })}
                    disabled={phase !== 'answer'}
                    onClick={() => setSplits((s) => (s.includes(i + 1) ? s.filter((x) => x !== i + 1) : [...s, i + 1]))}
                  >
                    <span aria-hidden="true" />
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="row row--center">
            <SpeakButton text={it.word} lang={lang} rate={rate} label={t('ex.hearWord')} />
            <button type="button" className="btn btn--primary btn--xl" disabled={phase !== 'answer'} onClick={() => answer([...splits].sort((a, b) => a - b).join(','))}>
              ✔ {t('ex.check')}
            </button>
          </div>
        </>
      );
      break;
    }
    case 'E4': {
      const it = item as E4Item;
      body = (
        <>
          <ReadingText key={index} text={it.sentence} lang={lang} rate={rate} lineFocus={false} syllableColours={settings.syllableColours} className="sentence" />
          <div className="opts opts--pics">
            {it.pictures.map((pic, i) => (
              <button
                key={i}
                type="button"
                className={optionClass(i) + ' opt--img'}
                disabled={disabled.includes(i) || phase !== 'answer'}
                onClick={() => answer(i)}
              >
                <img src={pic.url} alt={pic.label} draggable={false} />
                {phase === 'correct' && i === it.answer && <span className="burst" aria-hidden="true">⭐</span>}
              </button>
            ))}
          </div>
        </>
      );
      break;
    }
    case 'E5': {
      const q = item as E5Content['questions'][number];
      body = (
        <>
          <ReadingText text={exercise.content.passage ?? ''} lang={lang} rate={rate} lineFocus={settings.lineFocus} syllableColours={settings.syllableColours} className="passage" />
          <div className="question">
            <ReadingText key={index} text={q.q} lang={lang} rate={rate} syllableColours={settings.syllableColours} className="question__text" />
            {textOptions(q.options, true)}
          </div>
        </>
      );
      break;
    }
  }

  return (
    <div className={`player player--${exercise.type}`}>
      <div className="player__bar">
        {onExit && (
          <button type="button" className="icon-btn icon-btn--big" onClick={() => { stop(); onExit(); }} aria-label={t('ex.leave')} title={t('ex.leave')}>
            🏠
          </button>
        )}
        <div className="dots" aria-label={t('ex.progress', { n: index + 1, total: items.length })} role="img">
          {items.map((_, i) => (
            <span key={i} className={`dot ${i < results.length ? 'dot--done' : ''} ${i === index ? 'dot--now' : ''}`} />
          ))}
        </div>
        <button type="button" className="speak-btn speak-btn--labelled" onClick={() => speak(instruction, { lang, rate })} aria-label={t('ex.repeatInstruction')} title={t('ex.repeatInstruction')}>
          <SpeakerIcon /> <span aria-hidden="true">?</span>
        </button>
      </div>
      <p className="instruction">{instruction}</p>
      <div className="player__body" aria-live="polite">{body}</div>
      {phase === 'reveal' && (
        <div className="row row--center">
          <button type="button" className="btn btn--primary btn--xl" onClick={() => next()} autoFocus>
            {t('ex.next')} ▶
          </button>
        </div>
      )}
      {phase === 'correct' && <div className="cheer" aria-live="assertive">🎉 <span className="sr-only">{t('ex.correct')}</span></div>}
    </div>
  );
}
