import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import { TYPES, TYPE_INFO, type Exercise, type ExerciseType, type PicturesContent, type StoriesContent } from '../lib/types';
import { ExercisePlayer } from '../components/ExercisePlayer';
import { ErrorBox, Loading, useLoad } from '../components/Ui';
import type { ClassSummary } from './TeacherHome';

export function itemCount(e: Exercise) {
  return e.type === 'stories' ? (e.content as StoriesContent).questions.length : (e.content as PicturesContent).items.length;
}

/** Full-screen preview of an exercise exactly as kids see it (nothing is saved). */
export function Preview({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={`Preview: ${exercise.title}`}>
      <div className="overlay__panel kid-preview">
        <ExercisePlayer exercise={exercise} preview onExit={onClose} />
      </div>
    </div>
  );
}

function AssignDialog({ exercise, classes, defaultClass, onClose }: { exercise: Exercise; classes: ClassSummary[]; defaultClass?: number; onClose: (done: boolean) => void }) {
  const [classId, setClassId] = useState<number>(defaultClass ?? classes[0]?.id);
  const [who, setWho] = useState<'all' | 'some'>('all');
  const [picked, setPicked] = useState<number[]>([]);
  const [due, setDue] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const students = useLoad(
    () => (classId ? get<{ students: Array<{ id: number; name: string; levels: Record<ExerciseType, number> }> }>(`/teacher/classes/${classId}`) : Promise.resolve({ students: [] })),
    [classId],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await post('/teacher/assignments', { classId, exerciseId: exercise.id, studentIds: who === 'all' ? undefined : picked, dueDate: due || undefined });
      onClose(true);
    } catch (x) {
      setErr(x);
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="assign-title">
      <form className="overlay__panel card form" onSubmit={submit}>
        <h2 id="assign-title">Assign “{exercise.title}”</h2>
        {classes.length === 0 ? <p>Create a class first.</p> : (
          <>
            <label className="field">
              <span>Class</span>
              <select value={classId} onChange={(e) => { setClassId(Number(e.target.value)); setPicked([]); }}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <fieldset className="field">
              <legend>Who</legend>
              <label className="check"><input type="radio" checked={who === 'all'} onChange={() => setWho('all')} /> Whole class</label>
              <label className="check"><input type="radio" checked={who === 'some'} onChange={() => setWho('some')} /> Chosen students</label>
            </fieldset>
            {who === 'some' && (
              <div className="pick-list">
                {!students.data ? <Loading /> : students.data.students.map((s) => (
                  <label key={s.id} className="check">
                    <input type="checkbox" checked={picked.includes(s.id)}
                      onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))} />
                    {s.name} <span className="muted small">({TYPE_INFO[exercise.type].label} level {s.levels[exercise.type]})</span>
                  </label>
                ))}
              </div>
            )}
            <label className="field">
              <span>Due date (optional)</span>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
          </>
        )}
        <ErrorBox error={err} />
        <div className="row">
          <button className="btn btn--primary" disabled={!classId || (who === 'some' && picked.length === 0)}>Assign</button>
          <button type="button" className="btn" onClick={() => onClose(false)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export function Library() {
  const [params] = useSearchParams();
  const defaultClass = params.get('class') ? Number(params.get('class')) : undefined;
  const ex = useLoad(() => get<Exercise[]>('/teacher/exercises'));
  const classes = useLoad(() => get<ClassSummary[]>('/teacher/classes'));
  const [type, setType] = useState<ExerciseType | ''>('');
  const [level, setLevel] = useState(0);
  const [source, setSource] = useState<'all' | 'shared' | 'mine'>('all');
  const [preview, setPreview] = useState<Exercise | null>(null);
  const [assign, setAssign] = useState<Exercise | null>(null);
  const [flash, setFlash] = useState('');

  const list = (ex.data ?? []).filter(
    (e) => (!type || e.type === type) && (!level || e.level === level) && (source === 'all' || (source === 'shared') === e.shared),
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1>Exercise library</h1>
        <Link to="/teacher/content" className="btn btn--primary">+ Add my own</Link>
      </div>
      {defaultClass && <p className="alert">Choose an exercise and press <strong>Assign</strong>.</p>}
      {flash && <p className="alert alert--ok" role="status">{flash}</p>}
      <div className="filters">
        <label className="field field--inline">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as ExerciseType | '')}>
            <option value="">All</option>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_INFO[t].label}</option>)}
          </select>
        </label>
        <label className="field field--inline">
          <span>Level</span>
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            <option value={0}>All</option>
            {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="field field--inline">
          <span>Source</span>
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            <option value="all">All</option>
            <option value="shared">Comes with ReadBuddy</option>
            <option value="mine">Mine</option>
          </select>
        </label>
        <span className="muted">{list.length} exercises</span>
      </div>
      <ErrorBox error={ex.error} />
      {!ex.data ? <Loading /> : (
        <div className="ex-grid">
          {list.map((e) => (
            <article key={e.id} className="ex-card">
              <div className="ex-card__icon" aria-hidden="true">{TYPE_INFO[e.type].icon}</div>
              <div className="ex-card__body">
                <h3>{e.title}</h3>
                <p className="muted small">
                  {TYPE_INFO[e.type].label} · level {e.level} · {itemCount(e)} questions · {e.timeLimitS}s each{!e.shared && ' · mine'}
                </p>
              </div>
              <div className="ex-card__actions">
                <button type="button" className="btn btn--small" onClick={() => setPreview(e)}>Preview</button>
                <button type="button" className="btn btn--small btn--primary" onClick={() => setAssign(e)}>Assign</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {preview && <Preview exercise={preview} onClose={() => setPreview(null)} />}
      {assign && classes.data && (
        <AssignDialog exercise={assign} classes={classes.data} defaultClass={defaultClass}
          onClose={(done) => { if (done) setFlash(`“${assign.title}” was assigned.`); setAssign(null); }} />
      )}
    </div>
  );
}
