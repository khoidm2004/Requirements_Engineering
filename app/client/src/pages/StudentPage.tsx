import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, put } from '../lib/api';
import { TYPES, TYPE_INFO, type ExerciseType, type Levels, type MarkedAnswer } from '../lib/types';
import { Card, ErrorBox, Loading, fmtDate, fmtDateTime, fmtDuration, useLoad } from '../components/Ui';
import { Score } from './ClassPage';

interface Report {
  id: number; name: string; number: string; points: number; class: { id: number; name: string };
  levels: Levels;
  byType: Array<{ type: ExerciseType; exercises: number; avgPct: number | null; points: number }>;
  results: Array<{
    id: number; exerciseId: number; title: string; type: ExerciseType; level: number; correct: number; total: number;
    points: number; durationMs: number; answers: MarkedAnswer[]; assignmentId: number | null; completedAt: string;
  }>;
  recordings: Array<{ id: number; title: string; durationMs: number; listenedAt: string | null; createdAt: string }>;
}

export function StudentPage() {
  const { id } = useParams();
  const { data, error, reload } = useLoad(() => get<Report>(`/teacher/students/${id}`), [id]);
  const [open, setOpen] = useState<number | null>(null);

  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!data) return <Loading />;
  const s = data;
  const stat = (t: ExerciseType) => s.byType.find((b) => b.type === t);
  const recent = [...s.results].reverse().slice(-30);
  const totalTime = s.results.reduce((a, r) => a + r.durationMs, 0);

  async function setLevel(type: ExerciseType, level: number) {
    await put(`/teacher/students/${s.id}/levels`, { type, level });
    reload();
  }

  return (
    <div className="page">
      <p><Link to={`/teacher/class/${s.class.id}`}>← {s.class.name}</Link></p>
      <div className="page-head">
        <h1>{s.name}</h1>
        <div className="kpis">
          <div className="kpi"><span className="kpi__value">{s.points}</span><span className="kpi__label">points</span></div>
          <div className="kpi"><span className="kpi__value">{s.results.length}</span><span className="kpi__label">exercises</span></div>
          <div className="kpi"><span className="kpi__value">{fmtDuration(totalTime)}</span><span className="kpi__label">practised</span></div>
          <div className="kpi"><span className="kpi__value">{s.recordings.length}</span><span className="kpi__label">recordings</span></div>
        </div>
      </div>
      <p className="muted">Student number <span className="mono">{s.number}</span></p>

      <Card title="Levels and scores">
        <p className="muted small">Levels change automatically (≥ 80 % → up, &lt; 50 % → down). You can also set a level yourself.</p>
        <div className="type-grid">
          {TYPES.map((t) => (
            <div key={t} className="type-card">
              <div className="type-card__head"><span aria-hidden="true">{TYPE_INFO[t].icon}</span> {TYPE_INFO[t].label}</div>
              <label className="field field--inline">
                <span>Level</span>
                <select value={s.levels[t]} onChange={(e) => setLevel(t, Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <div className="small">{stat(t)?.exercises ?? 0} done · <Score pct={stat(t)?.avgPct ?? null} /></div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Progress (last 30 exercises)">
        {recent.length === 0 ? <p className="muted">No exercises yet.</p> : (
          <>
            <div className="chart" role="img" aria-label={`Scores of the last ${recent.length} exercises, from ${Math.round((100 * recent[0].correct) / recent[0].total)}% to ${Math.round((100 * recent[recent.length - 1].correct) / recent[recent.length - 1].total)}%. Full list in the table below.`}>
              {recent.map((r) => {
                const pct = Math.round((100 * r.correct) / r.total);
                return (
                  <div key={r.id} className="chart__col" title={`${r.title} · ${pct}% · ${fmtDate(r.completedAt)}`}>
                    <div className={`chart__bar chart__bar--${r.type}`} style={{ height: `${Math.max(pct, 3)}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="legend">
              {TYPES.map((t) => <span key={t}><i className={`chart__bar--${t}`} /> {TYPE_INFO[t].label}</span>)}
            </div>
          </>
        )}
      </Card>

      <Card title="Recordings">
        {s.recordings.length === 0 ? <p className="muted">No recordings yet.</p> : (
          <ul className="rec-list">
            {s.recordings.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.title}</strong> <span className="muted">· {fmtDateTime(r.createdAt)} · {fmtDuration(r.durationMs)}</span>
                  {!r.listenedAt && <span className="pill pill--new">new</span>}
                </div>
                <audio controls preload="none" src={`/api/teacher/recordings/${r.id}/audio`} onPlay={() => !r.listenedAt && setTimeout(reload, 1500)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="All results">
        {s.results.length === 0 ? <p className="muted">No results yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Exercise</th><th>Type</th><th>Level</th><th>Score</th><th>Points</th><th>Time</th><th><span className="sr-only">Details</span></th></tr>
              </thead>
              <tbody>
                {s.results.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td>{fmtDateTime(r.completedAt)}</td>
                      <td>{r.title}{r.assignmentId && <span className="pill">assigned</span>}</td>
                      <td>{TYPE_INFO[r.type].label}</td>
                      <td>{r.level}</td>
                      <td>{r.correct}/{r.total} <Score pct={Math.round((100 * r.correct) / r.total)} /></td>
                      <td>{r.points}</td>
                      <td>{fmtDuration(r.durationMs)}</td>
                      <td>
                        <button type="button" className="btn btn--ghost btn--small" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                          {open === r.id ? 'Hide' : 'Answers'}
                        </button>
                      </td>
                    </tr>
                    {open === r.id && (
                      <tr className="details-row">
                        <td colSpan={8}>
                          <ol className="answers">
                            {r.answers.map((a, i) => (
                              <li key={i} className={a.correct ? 'review--ok' : 'review--bad'}>
                                {a.correct ? '✅' : '❌'} {r.type === 'pictures' ? `picture ${Number(a.answer) + 1}` : a.answer}
                                {!a.correct && <> — answered: {a.given === null ? <em>time ran out</em> : r.type === 'pictures' ? `picture ${Number(a.given) + 1}` : a.given}</>}
                                <span className="muted"> ({(a.ms / 1000).toFixed(1)} s)</span>
                              </li>
                            ))}
                          </ol>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
