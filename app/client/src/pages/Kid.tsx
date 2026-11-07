import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { api, errorText, get, post, put } from '../lib/api';
import { useSession } from '../lib/session';
import { COLOUR_THEMES, DEFAULT_SETTINGS, FONTS, settingsStyle } from '../lib/settings';
import { speak } from '../lib/tts';
import { TYPES, TYPE_INFO, type Exercise, type ExerciseType, type Levels, type ResultResponse, type Settings, type StudentMe } from '../lib/types';
import { ExercisePlayer } from '../components/ExercisePlayer';
import { ReadAloud } from '../components/ReadAloud';
import { TopBar } from '../components/TopBar';
import { ErrorBox, Loading, fmtDate, fmtDuration, useLoad } from '../components/Ui';

interface KidCtx {
  student: StudentMe;
  settings: Settings;
  setSettings: (s: Settings) => void;
}
const useKid = () => useOutletContext<KidCtx>();

/** Applies the kid's own font, size and colours to everything in the kid area (req 10). */
export function KidShell() {
  const { me } = useSession();
  const student = me?.kind === 'student' ? me.student : null;
  const [settings, setSettings] = useState<Settings>(student?.settings ?? DEFAULT_SETTINGS);
  useEffect(() => {
    document.body.classList.add('kid-mode');
    return () => document.body.classList.remove('kid-mode');
  }, []);
  if (!student) return <Loading />;
  return (
    <div className="kid" style={settingsStyle(settings)}>
      <TopBar home="/kid">
        <NavLink to="/kid" end>🏠 <span>Home</span></NavLink>
        <NavLink to="/kid/record">🎤 <span>Read aloud</span></NavLink>
        <NavLink to="/kid/leaderboard">🏆 <span>Leaderboard</span></NavLink>
        <NavLink to="/kid/settings">🎨 <span>My settings</span></NavLink>
      </TopBar>
      <main className="kid__main">
        <Outlet context={{ student, settings, setSettings } satisfies KidCtx} />
      </main>
    </div>
  );
}

const Stars = ({ n }: { n: number }) => (
  <span className="stars" aria-label={`Level ${n} of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= n ? 'star star--on' : 'star'} aria-hidden="true">★</span>)}
  </span>
);

interface KidHomeData {
  points: number;
  rank: number;
  levels: Levels;
  assignments: Array<{ id: number; exerciseId: number; title: string; type: ExerciseType; level: number; dueDate: string | null }>;
}

export function KidHome() {
  const { student, settings } = useKid();
  const { data, error } = useLoad(() => get<KidHomeData>('/student/home'));
  const hello = `Hi ${student.name.split(' ')[0]}! What do you want to practise today?`;
  return (
    <div className="page">
      <div className="kid-hello">
        <h1>
          Hi {student.name.split(' ')[0]}! <span aria-hidden="true">👋</span>
        </h1>
        <button type="button" className="speak-btn" onClick={() => speak(hello, { rate: settings.speechRate })} aria-label="Read aloud">🔊</button>
        {data && (
          <div className="kid-stats">
            <span className="pill">⭐ {data.points} points</span>
            {data.rank > 0 && <span className="pill">🏆 #{data.rank} in {student.className}</span>}
          </div>
        )}
      </div>
      <ErrorBox error={error} />
      {!data ? <Loading /> : (
        <>
          {data.assignments.length > 0 && (
            <section className="kid-section">
              <h2>📬 From your teacher</h2>
              <div className="tiles">
                {data.assignments.map((a) => (
                  <Link key={a.id} to={`/kid/play/${a.exerciseId}?assignment=${a.id}`} className="tile tile--assignment">
                    <span className="tile__icon" aria-hidden="true">{TYPE_INFO[a.type].icon}</span>
                    <span className="tile__title">{a.title}</span>
                    <span className="tile__meta">{TYPE_INFO[a.type].label}{a.dueDate ? ` · by ${fmtDate(a.dueDate)}` : ''}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <section className="kid-section">
            <h2>🎯 Practise</h2>
            <div className="tiles">
              {TYPES.map((t) => (
                <Link key={t} to={`/kid/practice/${t}`} className={`tile tile--${t}`}>
                  <span className="tile__icon" aria-hidden="true">{TYPE_INFO[t].icon}</span>
                  <span className="tile__title">{TYPE_INFO[t].label}</span>
                  <span className="tile__meta">{TYPE_INFO[t].blurb}</span>
                  <Stars n={data.levels[t]} />
                </Link>
              ))}
              <Link to="/kid/record" className="tile tile--record">
                <span className="tile__icon" aria-hidden="true">🎤</span>
                <span className="tile__title">Read aloud</span>
                <span className="tile__meta">Record yourself reading for your teacher</span>
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function useSubmit(exercise: Exercise | null, assignmentId?: number) {
  const { refresh } = useSession();
  return async (answers: Array<{ given: string | null; ms: number }>, durationMs: number) => {
    if (!exercise) return null;
    try {
      const r = await post<ResultResponse>('/student/results', { exerciseId: exercise.id, assignmentId, answers, durationMs });
      refresh();
      return r;
    } catch {
      return null;
    }
  };
}

/** Req 7: an exercise of the chosen type at the kid's level. */
export function KidPractice() {
  const { type } = useParams();
  const { settings } = useKid();
  const nav = useNavigate();
  const [round, setRound] = useState(0);
  const { data, error } = useLoad(() => get<Exercise>(`/student/practice/${type}`), [type, round]);
  const submit = useSubmit(data);
  if (error) return <div className="page"><ErrorBox error={error} /><Link to="/kid">← Home</Link></div>;
  if (!data) return <Loading />;
  return (
    <ExercisePlayer key={`${data.id}-${round}`} exercise={data} rate={settings.speechRate} onSubmit={submit}
      onExit={() => nav('/kid')} onAgain={() => setRound((r) => r + 1)} />
  );
}

/** A specific exercise, e.g. one the teacher assigned. */
export function KidPlay() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { settings } = useKid();
  const nav = useNavigate();
  const assignment = params.get('assignment');
  const { data, error } = useLoad(() => get<Exercise>(`/student/exercises/${id}`), [id]);
  const submit = useSubmit(data, assignment ? Number(assignment) : undefined);
  if (error) return <div className="page"><ErrorBox error={error} /><Link to="/kid">← Home</Link></div>;
  if (!data) return <Loading />;
  return <ExercisePlayer exercise={data} rate={settings.speechRate} onSubmit={submit} onExit={() => nav('/kid')} />;
}

// ---------- Read aloud and record (req 13) ----------

interface Text { id: number; title: string; level: number; shared: boolean; text: string }
interface MyRecording { id: number; title: string; durationMs: number; listened: number; createdAt: string }

const MAX_RECORD_MS = 5 * 60 * 1000;

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

function Recorder({ exerciseId, onSaved }: { exerciseId: number; onSaved: () => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'recorded' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [ms, setMs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<number>(0);

  useEffect(() => () => {
    window.clearInterval(timer.current);
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const mime = pickMime();
  if (mime === null || !navigator.mediaDevices?.getUserMedia) {
    return <p className="alert">Recording does not work in this browser. Try Chrome, Edge, Firefox or Safari.</p>;
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const b = new Blob(chunks, { type: r.mimeType || mime || 'audio/webm' });
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        setState('recorded');
      };
      rec.current = r;
      r.start();
      startedAt.current = Date.now();
      setMs(0);
      setState('recording');
      timer.current = window.setInterval(() => {
        const d = Date.now() - startedAt.current;
        setMs(d);
        if (d >= MAX_RECORD_MS) stop();
      }, 250);
    } catch {
      setError('We could not use the microphone. Ask a grown-up to allow the microphone for this page.');
    }
  }

  function stop() {
    window.clearInterval(timer.current);
    setMs(Date.now() - startedAt.current);
    if (rec.current?.state === 'recording') rec.current.stop();
  }

  async function save() {
    if (!blob) return;
    setState('saving');
    try {
      await api('POST', `/student/recordings?exerciseId=${exerciseId}&durationMs=${Math.round(ms)}`, blob);
      setState('saved');
      onSaved();
    } catch (e) {
      setError(errorText(e));
      setState('recorded');
    }
  }

  const reset = () => {
    setBlob(null);
    setUrl(null);
    setState('idle');
  };

  return (
    <div className="recorder">
      {state === 'idle' && <button type="button" className="btn btn--record btn--big" onClick={start}>🎤 Start recording</button>}
      {state === 'recording' && (
        <>
          <span className="rec-dot" aria-hidden="true" /> <span aria-live="off">Recording… {fmtDuration(ms)}</span>
          <button type="button" className="btn btn--primary btn--big" onClick={stop} autoFocus>⏹ Stop</button>
        </>
      )}
      {(state === 'recorded' || state === 'saving') && url && (
        <>
          <audio controls src={url} />
          <button type="button" className="btn btn--primary btn--big" onClick={save} disabled={state === 'saving'}>💾 Save for my teacher</button>
          <button type="button" className="btn" onClick={reset} disabled={state === 'saving'}>🔁 Try again</button>
        </>
      )}
      {state === 'saved' && (
        <>
          <p className="alert alert--ok" role="status">Saved! Your teacher can listen to it. 🎉</p>
          <button type="button" className="btn" onClick={reset}>Record again</button>
        </>
      )}
      {error && <p className="alert alert--error" role="alert">{error}</p>}
    </div>
  );
}

export function KidRecord() {
  const { settings } = useKid();
  const texts = useLoad(() => get<Text[]>('/student/texts'));
  const mine = useLoad(() => get<MyRecording[]>('/student/recordings'));
  const [chosen, setChosen] = useState<Text | null>(null);

  return (
    <div className="page">
      <h1>🎤 Read aloud</h1>
      {!chosen ? (
        <>
          <p className="lead">Pick a text. Read it out loud and record yourself. Your teacher will listen to it later.</p>
          <ErrorBox error={texts.error} />
          {!texts.data ? <Loading /> : (
            <div className="tiles">
              {texts.data.map((t) => (
                <button key={t.id} type="button" className="tile" onClick={() => setChosen(t)}>
                  <span className="tile__icon" aria-hidden="true">📖</span>
                  <span className="tile__title">{t.title}</span>
                  <span className="tile__meta">Level {t.level}{t.shared ? '' : ' · from your teacher'}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="record-panel">
          <button type="button" className="btn btn--ghost" onClick={() => setChosen(null)}>← Choose another text</button>
          <h2>{chosen.title}</h2>
          <p className="muted">Tip: press 🔊 to hear the text first. Tap a word to hear just that word.</p>
          <div className="story"><ReadAloud text={chosen.text} rate={settings.speechRate} /></div>
          <Recorder key={chosen.id} exerciseId={chosen.id} onSaved={mine.reload} />
        </div>
      )}

      <section className="kid-section">
        <h2>My recordings</h2>
        {!mine.data ? <Loading /> : mine.data.length === 0 ? <p className="muted">No recordings yet.</p> : (
          <ul className="rec-list">
            {mine.data.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.title}</strong> <span className="muted">· {fmtDate(r.createdAt)} · {fmtDuration(r.durationMs)}</span>
                  {r.listened ? <span className="pill pill--ok">👂 Teacher listened</span> : null}
                </div>
                <audio controls preload="none" src={`/api/student/recordings/${r.id}/audio`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- Leaderboard (req 14) ----------

export function KidLeaderboard() {
  const { student } = useKid();
  const [period, setPeriod] = useState<'all' | 'week'>('week');
  const { data, error } = useLoad(
    () => get<Array<{ id: number; name: string; points: number; me: boolean }>>(`/student/leaderboard?period=${period}`),
    [period],
  );
  const medal = (i: number) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
  return (
    <div className="page page--narrow">
      <h1>🏆 Leaderboard · {student.className}</h1>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={period === 'week'} className={`tab ${period === 'week' ? 'tab--on' : ''}`} onClick={() => setPeriod('week')}>This week</button>
        <button role="tab" aria-selected={period === 'all'} className={`tab ${period === 'all' ? 'tab--on' : ''}`} onClick={() => setPeriod('all')}>All time</button>
      </div>
      <ErrorBox error={error} />
      {!data ? <Loading /> : (
        <ol className="board">
          {data.map((r, i) => (
            <li key={r.id} className={r.me ? 'board__me' : ''}>
              <span className="board__rank">{medal(i)}</span>
              <span className="board__name">{r.name}{r.me && ' (you)'}</span>
              <span className="board__points">⭐ {r.points}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="muted center">Practise to earn points: 10 for each right answer, plus a bonus for answering fast!</p>
    </div>
  );
}

// ---------- Settings (req 10, 11) ----------

export function KidSettings() {
  const { settings, setSettings } = useKid();
  const { refresh } = useSession();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<number>(0);

  const change = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      put('/student/settings', next).then(() => { setStatus('saved'); refresh(); }, () => setStatus('error'));
    }, 500);
  };

  const slider = (label: string, key: 'fontSize' | 'letterSpacing' | 'lineHeight' | 'speechRate', min: number, max: number, step: number, show: (v: number) => string) => (
    <label className="field">
      <span>{label}: <strong>{show(settings[key])}</strong></span>
      <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(e) => change({ [key]: Number(e.target.value) })} />
    </label>
  );

  return (
    <div className="page page--narrow">
      <h1>🎨 My settings</h1>
      <p className="muted" role="status">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : status === 'error' ? 'Could not save. Try again.' : 'Change anything — it saves by itself.'}</p>

      <section className="card">
        <h2>Font</h2>
        <div className="choice-grid">
          {FONTS.map((f) => (
            <button key={f.name} type="button" aria-pressed={settings.font === f.name}
              className={`choice ${settings.font === f.name ? 'choice--on' : ''}`} style={{ fontFamily: `'RB Emoji', ${f.stack}` }} onClick={() => change({ font: f.name })}>
              <span className="choice__sample">Aa Bb dbqp</span>
              <span className="choice__name">{f.name}{f.note ? ` – ${f.note}` : ''}</span>
            </button>
          ))}
        </div>
        {slider('Text size', 'fontSize', 16, 40, 1, (v) => `${v}px`)}
        {slider('Space between letters', 'letterSpacing', 0, 0.3, 0.01, (v) => (v < 0.04 ? 'small' : v < 0.12 ? 'medium' : 'large'))}
        {slider('Space between lines', 'lineHeight', 1.2, 3, 0.1, (v) => v.toFixed(1))}
      </section>

      <section className="card">
        <h2>Colours</h2>
        <div className="choice-grid">
          {COLOUR_THEMES.map((t) => {
            const on = settings.background === t.background && settings.textColor === t.textColor;
            return (
              <button key={t.name} type="button" aria-pressed={on} className={`choice ${on ? 'choice--on' : ''}`}
                style={{ background: t.background, color: t.textColor }} onClick={() => change({ background: t.background, textColor: t.textColor, highlight: t.highlight })}>
                <span className="choice__sample">Read me</span>
                <span className="choice__name">{t.name}</span>
              </button>
            );
          })}
        </div>
        <div className="colour-row">
          <label>Background <input type="color" value={settings.background} onChange={(e) => change({ background: e.target.value })} /></label>
          <label>Text <input type="color" value={settings.textColor} onChange={(e) => change({ textColor: e.target.value })} /></label>
          <label>Highlight <input type="color" value={settings.highlight} onChange={(e) => change({ highlight: e.target.value })} /></label>
        </div>
      </section>

      <section className="card">
        <h2>Reading voice</h2>
        {slider('Voice speed', 'speechRate', 0.5, 1.5, 0.1, (v) => (v < 0.8 ? 'slow' : v <= 1.1 ? 'normal' : 'fast'))}
        <div className="story">
          <ReadAloud text="The quick brown fox jumps over the lazy dog. Press the speaker to try the voice." rate={settings.speechRate} />
        </div>
      </section>

      <button type="button" className="btn" onClick={() => change({ ...DEFAULT_SETTINGS })}>Reset to default</button>
    </div>
  );
}
