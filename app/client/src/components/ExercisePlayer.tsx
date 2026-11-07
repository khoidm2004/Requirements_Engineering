import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Exercise, LettersContent, MarkedAnswer, PicturesContent, ResultResponse, SentencesContent, StoriesContent, WordsContent,
} from '../lib/types';
import { TYPE_INFO } from '../lib/types';
import { speak, stopSpeaking } from '../lib/tts';
import { PictureView } from './PictureView';
import { ReadAloud, SpeakButton } from './ReadAloud';

/** Clear instructions for each exercise type (req 8). */
export const INSTRUCTIONS: Record<Exercise['type'], { short: string; steps: string[] }> = {
  letters: {
    short: 'Listen to the sound. Tap the letter you hear.',
    steps: ['Press the speaker to hear the sound again.', 'Tap the letter that makes that sound.'],
  },
  words: {
    short: 'Listen to the word. Tap the word you hear.',
    steps: ['Press the speaker to hear the word again.', 'Look carefully: the words look alike!', 'Tap the word you heard.'],
  },
  sentences: {
    short: 'Read the sentence. Tap the word that fits in the gap.',
    steps: ['Read the sentence, or press the speaker to hear it.', 'Tap the word that makes the sentence right.'],
  },
  pictures: {
    short: 'Read the sentence. Tap the picture that matches it.',
    steps: ['Read the sentence, or press the speaker to hear it.', 'Tap the picture that shows the sentence.'],
  },
  stories: {
    short: 'Read the story. Then answer the questions.',
    steps: ['Read the story, or press the speaker to hear it.', 'Press “I’m ready” when you have read it.', 'Answer each question. You can still look at the story.'],
  },
};

const POINTS_PER_CORRECT = 10;
const MAX_SPEED_BONUS = 5;

interface Question {
  prompt?: string; // text shown and readable
  spoken?: string; // what the speaker button says
  autoSpeak?: boolean;
  options: Array<{ value: string; label: string; picture?: boolean }>;
  answer: string;
  answerLabel: string;
}

function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildQuestions(ex: Exercise): Question[] {
  switch (ex.type) {
    case 'letters':
      return (ex.content as LettersContent).items.map((i) => ({
        spoken: i.say, autoSpeak: true, answer: i.target, answerLabel: i.target,
        options: shuffle(i.options).map((o) => ({ value: o, label: o })),
      }));
    case 'words':
      return (ex.content as WordsContent).items.map((i) => ({
        spoken: i.target, autoSpeak: true, answer: i.target, answerLabel: i.target,
        options: shuffle(i.options).map((o) => ({ value: o, label: o })),
      }));
    case 'sentences':
      return (ex.content as SentencesContent).items.map((i) => ({
        prompt: i.sentence, spoken: i.sentence.replace(/_{3,}/g, 'blank'), answer: i.answer, answerLabel: i.answer,
        options: shuffle(i.options).map((o) => ({ value: o, label: o })),
      }));
    case 'pictures': {
      const items = (ex.content as PicturesContent).items;
      return items.map((i, idx) => ({
        prompt: i.sentence, spoken: i.sentence, answer: String(idx), answerLabel: 'this picture',
        options: shuffle(items.map((_, j) => ({ value: String(j), label: '', picture: true }))),
      }));
    }
    case 'stories':
      return (ex.content as StoriesContent).questions.map((q) => ({
        prompt: q.question, spoken: q.question, answer: q.answer, answerLabel: q.answer,
        options: shuffle(q.options).map((o) => ({ value: o, label: o })),
      }));
  }
}

type Phase = 'intro' | 'reading' | 'question' | 'feedback' | 'saving' | 'done';

export function ExercisePlayer({
  exercise, rate = 1, onSubmit, onExit, onAgain, preview = false,
}: {
  exercise: Exercise;
  rate?: number;
  /** Saves the result; returns null when it could not be saved. */
  onSubmit?: (answers: Array<{ given: string | null; ms: number }>, durationMs: number) => Promise<ResultResponse | null>;
  onExit: () => void;
  onAgain?: () => void;
  preview?: boolean;
}) {
  const questions = useMemo(() => buildQuestions(exercise), [exercise]);
  const info = INSTRUCTIONS[exercise.type];
  const limitMs = exercise.timeLimitS * 1000;
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<{ given: string | null; ms: number }>>([]);
  const [left, setLeft] = useState(limitMs);
  const [points, setPoints] = useState(0);
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const started = useRef(0);
  const qStart = useRef(0);
  const answeredFor = useRef(-1); // stops the timer and a click from both answering
  const nextBtn = useRef<HTMLButtonElement>(null);
  const q = questions[index];
  const last = answers[index];

  useEffect(() => () => stopSpeaking(), []);

  // Req 15: countdown for the current question.
  useEffect(() => {
    if (phase !== 'question') return;
    qStart.current = performance.now();
    setLeft(limitMs);
    if (q.autoSpeak && q.spoken) speak(q.spoken, { rate });
    const t = window.setInterval(() => {
      const remaining = limitMs - (performance.now() - qStart.current);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) answer(null);
    }, 200);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index]);

  useEffect(() => {
    if (phase === 'feedback') nextBtn.current?.focus();
  }, [phase]);

  function start() {
    started.current = performance.now();
    setPhase(exercise.type === 'stories' ? 'reading' : 'question');
  }

  function answer(given: string | null) {
    if (phase !== 'question' || answeredFor.current === index) return;
    answeredFor.current = index;
    const ms = Math.min(limitMs, Math.round(performance.now() - qStart.current));
    setAnswers((a) => [...a, { given, ms }]);
    const ok = given === q.answer;
    if (ok) {
      setPoints((p) => p + POINTS_PER_CORRECT + Math.floor(MAX_SPEED_BONUS * (1 - ms / limitMs)));
      speak('Correct!', { rate });
    } else {
      // Req 12: say it is wrong and show the right answer.
      const right = exercise.type === 'pictures' ? '' : ` The right answer is: ${q.answerLabel}.`;
      speak((given === null ? 'Time is up!' : 'Wrong.') + right, { rate });
    }
    setPhase('feedback');
  }

  async function next() {
    stopSpeaking();
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setPhase('question');
      return;
    }
    if (preview || !onSubmit) return setPhase('done');
    setPhase('saving');
    const r = await onSubmit(answers, Math.round(performance.now() - started.current));
    setResult(r);
    setSaveFailed(!r);
    setPhase('done');
  }

  const header = (
    <div className="player__head">
      <button type="button" className="btn btn--ghost" onClick={() => { stopSpeaking(); onExit(); }}>
        ← {preview ? 'Close preview' : 'Stop'}
      </button>
      <div className="player__title">
        <span aria-hidden="true">{TYPE_INFO[exercise.type].icon}</span> {exercise.title}
        <span className="badge">Level {exercise.level}</span>
      </div>
      {phase !== 'intro' && phase !== 'done' && (
        <div className="player__score" aria-label={`${points} points`}>⭐ {points}</div>
      )}
    </div>
  );

  if (phase === 'intro') {
    return (
      <div className="player">
        {header}
        <div className="player__body player__intro">
          <h1>{TYPE_INFO[exercise.type].label}</h1>
          <div className="instructions">
            <p className="instructions__main">
              {info.short} <SpeakButton text={info.short + ' ' + info.steps.join(' ')} rate={rate} label="Hear the instructions" />
            </p>
            <ol>
              {info.steps.map((s) => <li key={s}>{s}</li>)}
              <li>
                You have <strong>{exercise.timeLimitS} seconds</strong> for each question. Answer fast for bonus points!
              </li>
            </ol>
            <p className="muted">{questions.length} questions</p>
          </div>
          <button type="button" className="btn btn--primary btn--big" onClick={start} autoFocus>
            Start ▶
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done' || phase === 'saving') {
    const marked: MarkedAnswer[] =
      result?.answers ?? answers.map((a, i) => ({ ...a, correct: a.given === questions[i].answer, answer: questions[i].answer }));
    const correct = marked.filter((m) => m.correct).length;
    return (
      <div className="player">
        {header}
        <div className="player__body player__done" aria-live="polite">
          {phase === 'saving' ? (
            <p>Saving…</p>
          ) : (
            <>
              <div className="big-emoji" aria-hidden="true">{correct / questions.length >= 0.8 ? '🏆' : correct / questions.length >= 0.5 ? '👍' : '💪'}</div>
              <h1>
                {correct} of {questions.length} right
              </h1>
              {result && (
                <>
                  <p className="points-won">+{result.points} points · total ⭐ {result.totalPoints}</p>
                  {result.newLevel > result.level && <p className="level-up">Level up! You are now on level {result.newLevel} 🎉</p>}
                  {result.newLevel < result.level && <p>Next time we will make it a bit easier (level {result.newLevel}).</p>}
                  {result.newLevel === result.level && exercise.level === result.level && <p>You stay on level {result.level}. Keep practising!</p>}
                </>
              )}
              {saveFailed && <p className="alert alert--error" role="alert">Your result could not be saved. Check the internet connection.</p>}
              {preview && <p className="muted">Preview — nothing was saved.</p>}
              <ol className="review">
                {marked.map((m, i) => (
                  <li key={i} className={m.correct ? 'review--ok' : 'review--bad'}>
                    <span aria-hidden="true">{m.correct ? '✅' : '❌'}</span>{' '}
                    {exercise.type === 'pictures'
                      ? (questions[i].prompt ?? '')
                      : m.correct
                        ? labelFor(questions[i], m.answer)
                        : <>
                            {m.given === null ? 'No answer' : <s>{labelFor(questions[i], m.given)}</s>} → <strong>{labelFor(questions[i], m.answer)}</strong>
                          </>}
                  </li>
                ))}
              </ol>
              <div className="row">
                {onAgain && <button type="button" className="btn btn--primary btn--big" onClick={onAgain} autoFocus>Play again</button>}
                <button type="button" className="btn btn--big" onClick={onExit}>{preview ? 'Close' : 'Home'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const story = exercise.type === 'stories' ? (exercise.content as StoriesContent).text : null;
  const isCorrect = last && last.given === q.answer;
  const pct = left / limitMs;

  return (
    <div className="player">
      {header}
      <div className="player__body">
        <p className="instructions__main instructions__main--small">
          {phase === 'reading' ? 'Read the story. Press “I’m ready” when you are done.' : info.short}{' '}
          <SpeakButton text={info.short} rate={rate} label="Hear the instructions" />
        </p>

        {story && (
          <div className="story">
            <ReadAloud text={story} rate={rate} />
          </div>
        )}

        {phase === 'reading' ? (
          <button type="button" className="btn btn--primary btn--big" onClick={() => setPhase('question')}>
            I’m ready for the questions ▶
          </button>
        ) : (
          <>
            <div className="progress-row">
              <span>Question {index + 1} of {questions.length}</span>
              <div
                className={`timer ${pct < 0.25 ? 'timer--low' : ''}`}
                role="timer"
                aria-label={`${Math.ceil(left / 1000)} seconds left`}
              >
                <div className="timer__bar" style={{ width: `${pct * 100}%` }} />
                <span className="timer__text" aria-hidden="true">⏱ {Math.ceil(left / 1000)} s</span>
              </div>
            </div>

            <div className="question">
              {q.prompt ? (
                <ReadAloud
                  key={index}
                  text={phase === 'feedback' && exercise.type === 'sentences' ? q.prompt.replace(/_{3,}/, q.answer) : q.prompt}
                  spokenText={phase === 'feedback' ? undefined : q.spoken}
                  rate={rate}
                  className="question__prompt"
                />
              ) : (
                q.spoken && <SpeakButton text={q.spoken} rate={rate} label="Hear it again" big />
              )}
            </div>

            <div className={`options ${exercise.type === 'pictures' ? 'options--pictures' : ''} ${exercise.type === 'letters' ? 'options--letters' : ''}`}>
              {q.options.map((o, i) => {
                const state =
                  phase !== 'feedback' ? '' : o.value === q.answer ? 'option--right' : o.value === last?.given ? 'option--wrong' : 'option--faded';
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`option ${state}`}
                    disabled={phase === 'feedback'}
                    onClick={() => answer(o.value)}
                  >
                    {o.picture ? (
                      <PictureView picture={(exercise.content as PicturesContent).items[Number(o.value)].picture} alt={`Picture ${i + 1}`} />
                    ) : (
                      o.label
                    )}
                    {state === 'option--right' && <span className="option__mark" aria-label="right answer">✓</span>}
                    {state === 'option--wrong' && <span className="option__mark" aria-label="your answer, wrong">✗</span>}
                  </button>
                );
              })}
            </div>

            {phase === 'feedback' && (
              <div className={`feedback ${isCorrect ? 'feedback--ok' : 'feedback--bad'}`} role="alert">
                <p className="feedback__title">
                  {isCorrect ? '✅ Correct!' : last?.given === null ? '⏰ Time is up!' : '❌ Wrong!'}
                </p>
                {!isCorrect && (
                  <p>
                    The right answer is:{' '}
                    {exercise.type === 'pictures' ? 'the picture with the green tick.' : <strong className="feedback__answer">{q.answerLabel}</strong>}
                  </p>
                )}
                <button ref={nextBtn} type="button" className="btn btn--primary btn--big" onClick={next}>
                  {index + 1 < questions.length ? 'Next ▶' : 'See my score'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function labelFor(q: Question, value: string) {
  return q.options.find((o) => o.value === value)?.label || value;
}
