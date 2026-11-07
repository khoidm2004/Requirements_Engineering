import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { del, get, post } from '../lib/api';
import { TYPES, TYPE_INFO, type ExerciseType, type Levels } from '../lib/types';
import { Card, ErrorBox, Loading, fmtDate, fmtDuration, useLoad } from '../components/Ui';

interface StudentRow {
  id: number; name: string; number: string; points: number; lastLogin: string | null; exercises: number;
  avgPct: number | null; lastExercise: string | null; timeMs: number; recordings: number; newRecordings: number; levels: Levels;
}
interface ClassDetail { id: number; name: string; code: string; createdAt: string; students: StudentRow[] }
interface AssignmentRow {
  id: number; dueDate: string | null; createdAt: string; studentId: number | null; studentName: string | null;
  exerciseId: number; title: string; type: ExerciseType; level: number; assigned: number; done: number;
}

type SortKey = 'name' | 'points' | 'exercises' | 'avgPct' | 'last';

export function ClassPage() {
  const { id } = useParams();
  const cls = useLoad(() => get<ClassDetail>(`/teacher/classes/${id}`), [id]);
  const assignments = useLoad(() => get<AssignmentRow[]>(`/teacher/classes/${id}/assignments`), [id]);
  const board = useLoad(() => get<Array<{ id: number; name: string; points: number }>>(`/teacher/classes/${id}/leaderboard?period=week`), [id]);
  const [form, setForm] = useState({ name: '', number: '' });
  const [err, setErr] = useState<unknown>(null);
  const [sort, setSort] = useState<SortKey>('name');

  async function add(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await post(`/teacher/classes/${id}/students`, form);
      setForm({ name: '', number: '' });
      cls.reload();
    } catch (x) {
      setErr(x);
    }
  }

  async function remove(s: StudentRow) {
    if (!confirm(`Remove ${s.name}? All their results and recordings will be deleted. This cannot be undone.`)) return;
    await del(`/teacher/students/${s.id}`);
    cls.reload();
  }

  async function unassign(a: AssignmentRow) {
    if (!confirm(`Remove the assignment “${a.title}”?`)) return;
    await del(`/teacher/assignments/${a.id}`);
    assignments.reload();
  }

  if (cls.error) return <div className="page"><ErrorBox error={cls.error} /></div>;
  if (!cls.data) return <Loading />;
  const c = cls.data;
  const last = (s: StudentRow) => s.lastExercise ?? s.lastLogin ?? '';
  const sorted = [...c.students].sort((a, b) => {
    switch (sort) {
      case 'name': return a.name.localeCompare(b.name);
      case 'points': return b.points - a.points;
      case 'exercises': return b.exercises - a.exercises;
      case 'avgPct': return (b.avgPct ?? -1) - (a.avgPct ?? -1);
      case 'last': return last(b).localeCompare(last(a));
    }
  });
  const th = (key: SortKey, label: string) => (
    <th aria-sort={sort === key ? 'descending' : undefined}>
      <button type="button" className="th-btn" onClick={() => setSort(key)}>{label}{sort === key ? ' ▾' : ''}</button>
    </th>
  );

  return (
    <div className="page">
      <p><Link to="/teacher">← Classes</Link></p>
      <div className="page-head">
        <h1>{c.name}</h1>
        <div className="class-code">Class code <span className="code code--big">{c.code}</span></div>
      </div>

      <Card
        title={`Students (${c.students.length})`}
        actions={
          <>
            <a className="btn btn--small" href={`/api/teacher/classes/${c.id}/export/students.csv`} download>⬇ Students CSV</a>
            <a className="btn btn--small" href={`/api/teacher/classes/${c.id}/export/results.csv`} download>⬇ All results CSV</a>
          </>
        }
      >
        <form onSubmit={add} className="inline-form">
          <label className="field">
            <span>Student name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={60} />
          </label>
          <label className="field">
            <span>Student number</span>
            <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} required maxLength={30} pattern="[A-Za-z0-9_\-]+" title="Letters, digits, - and _" />
          </label>
          <button className="btn btn--primary">Add student</button>
        </form>
        <ErrorBox error={err} />
        {c.students.length === 0 ? (
          <p className="muted">No students yet. Add them above — they sign in with their student number and name.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {th('name', 'Name')}
                  <th>Number</th>
                  {th('points', 'Points')}
                  {th('exercises', 'Exercises')}
                  {th('avgPct', 'Avg. score')}
                  <th className="levels-head">Levels<br />{TYPES.map((t) => <span key={t} title={TYPE_INFO[t].label} aria-label={TYPE_INFO[t].label}>{TYPE_INFO[t].icon}</span>)}</th>
                  <th>Time</th>
                  {th('last', 'Last active')}
                  <th>Recordings</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr key={s.id}>
                    <td><Link to={`/teacher/student/${s.id}`}>{s.name}</Link></td>
                    <td className="mono">{s.number}</td>
                    <td>{s.points}</td>
                    <td>{s.exercises}</td>
                    <td><Score pct={s.avgPct} /></td>
                    <td className="levels">{TYPES.map((t) => <span key={t} title={`${TYPE_INFO[t].label}: level ${s.levels[t]}`}>{s.levels[t]}</span>)}</td>
                    <td>{s.timeMs ? fmtDuration(s.timeMs) : '—'}</td>
                    <td>{fmtDate(last(s) || null)}</td>
                    <td>{s.recordings}{s.newRecordings > 0 && <span className="pill pill--new">{s.newRecordings} new</span>}</td>
                    <td><button type="button" className="btn btn--danger btn--small" onClick={() => remove(s)} aria-label={`Remove ${s.name}`}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid-2">
        <Card title="Assignments" actions={<Link className="btn btn--small btn--primary" to={`/teacher/library?class=${c.id}`}>+ Assign exercise</Link>}>
          <ErrorBox error={assignments.error} />
          {!assignments.data ? <Loading /> : assignments.data.length === 0 ? <p className="muted">Nothing assigned yet.</p> : (
            <ul className="assign-list">
              {assignments.data.map((a) => (
                <li key={a.id}>
                  <span aria-hidden="true">{TYPE_INFO[a.type].icon}</span>
                  <div className="assign-list__main">
                    <strong>{a.title}</strong> <span className="badge">L{a.level}</span>
                    <div className="muted small">
                      {a.studentName ?? 'Whole class'} · done {a.done}/{a.assigned}{a.dueDate ? ` · due ${fmtDate(a.dueDate)}` : ''}
                    </div>
                    <div className="meter" aria-hidden="true"><div style={{ width: `${(100 * a.done) / Math.max(1, a.assigned)}%` }} /></div>
                  </div>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => unassign(a)} aria-label={`Remove assignment ${a.title}`}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Leaderboard – this week">
          {!board.data ? <Loading /> : (
            <ol className="board board--small">
              {board.data.slice(0, 10).map((b, i) => (
                <li key={b.id}><span className="board__rank">{i + 1}.</span><span className="board__name">{b.name}</span><span className="board__points">⭐ {b.points}</span></li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

export function Score({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return <span className="muted">—</span>;
  const cls = pct >= 80 ? 'score--good' : pct >= 50 ? 'score--ok' : 'score--low';
  return <span className={`score ${cls}`}>{pct}%</span>;
}
