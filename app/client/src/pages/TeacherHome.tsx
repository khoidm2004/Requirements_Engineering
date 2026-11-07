import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { post, get } from '../lib/api';
import { useSession } from '../lib/session';
import { TopBar } from '../components/TopBar';
import { Card, ErrorBox, Loading, fmtDate, useLoad } from '../components/Ui';

export interface ClassSummary { id: number; name: string; code: string; createdAt: string; students: number }

export function TeacherShell() {
  return (
    <div className="teacher">
      <TopBar home="/teacher">
        <NavLink to="/teacher" end>Classes</NavLink>
        <NavLink to="/teacher/library">Exercise library</NavLink>
        <NavLink to="/teacher/content">My texts &amp; pictures</NavLink>
      </TopBar>
      <main className="teacher__main">
        <Outlet />
      </main>
    </div>
  );
}

export function TeacherHome() {
  const { me } = useSession();
  const { data, error, reload } = useLoad(() => get<ClassSummary[]>('/teacher/classes'));
  const [name, setName] = useState('');
  const [err, setErr] = useState<unknown>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await post('/teacher/classes', { name });
      setName('');
      reload();
    } catch (x) {
      setErr(x);
    }
  }

  return (
    <div className="page">
      <h1>Welcome, {me?.kind === 'teacher' ? me.teacher.name : ''}</h1>
      <ErrorBox error={error} />
      <div className="grid-2">
        <Card title="Your classes">
          {!data ? <Loading /> : data.length === 0 ? (
            <p className="muted">No classes yet. Create your first class to get a class code.</p>
          ) : (
            <ul className="class-list">
              {data.map((c) => (
                <li key={c.id}>
                  <Link to={`/teacher/class/${c.id}`} className="class-list__link">
                    <strong>{c.name}</strong>
                    <span className="code">{c.code}</span>
                    <span className="muted">{c.students} student{c.students === 1 ? '' : 's'} · since {fmtDate(c.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Create a class">
          <form onSubmit={create} className="form">
            <label className="field">
              <span>Class name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 3B Reading group" required maxLength={80} />
            </label>
            <ErrorBox error={err} />
            <button className="btn btn--primary">Create class</button>
            <p className="muted small">Each class gets its own code. After creating it, add your students with their name and student number.</p>
          </form>
        </Card>
      </div>
      <div className="grid-2">
        <Card title="Getting started">
          <ol className="steps">
            <li>Create a class.</li>
            <li>Add students with their name and student number.</li>
            <li>Students open ReadBuddy and sign in with their student number and name.</li>
            <li>Assign exercises from the <Link to="/teacher/library">library</Link> or add <Link to="/teacher/content">your own texts and pictures</Link>.</li>
            <li>Follow progress, listen to recordings and export the data as CSV.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
