import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { post } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorBox, Loading } from '../components/Ui';

/** One home page: student login by default, teacher login on the same page (architecture §5). */
export function Home() {
  const { me, refresh } = useSession();
  const nav = useNavigate();
  const [who, setWho] = useState<'student' | 'teacher'>('student');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ number: '', name: '', email: '', password: '', teacherName: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  if (!me) return <Loading />;
  if (me.kind === 'teacher') return <Navigate to="/teacher" replace />;
  if (me.kind === 'student') return <Navigate to="/kid" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (who === 'student') await post('/auth/student/login', { number: f.number, name: f.name });
      else if (mode === 'login') await post('/auth/teacher/login', { email: f.email, password: f.password });
      else await post('/auth/teacher/register', { email: f.email, password: f.password, name: f.teacherName });
      const m = await refresh();
      nav(m.kind === 'teacher' ? '/teacher' : '/kid');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const switchTo = (w: 'student' | 'teacher') => {
    setWho(w);
    setError(null);
  };

  return (
    <div className="home">
      <header className="home__hero">
        <div className="logo logo--big"><span aria-hidden="true">📚</span> ReadBuddy</div>
        <p className="home__tagline">Reading practice that is fun — at your own level.</p>
      </header>

      <main className="home__panel card">
        <div className="tabs" role="tablist" aria-label="Who are you?">
          <button role="tab" aria-selected={who === 'student'} className={`tab ${who === 'student' ? 'tab--on' : ''}`} onClick={() => switchTo('student')}>
            🎒 I’m a student
          </button>
          <button role="tab" aria-selected={who === 'teacher'} className={`tab ${who === 'teacher' ? 'tab--on' : ''}`} onClick={() => switchTo('teacher')}>
            🍎 I’m a teacher
          </button>
        </div>

        <form onSubmit={submit} className="form">
          {who === 'student' ? (
            <>
              <h1 className="form__title">Let’s read!</h1>
              <label className="field">
                <span>Your student number</span>
                <input value={f.number} onChange={set('number')} autoComplete="username" required autoFocus inputMode="text" />
              </label>
              <label className="field">
                <span>Your name</span>
                <input value={f.name} onChange={set('name')} autoComplete="name" required />
              </label>
              <p className="muted small">Your teacher gives you your student number.</p>
            </>
          ) : (
            <>
              <h1 className="form__title">{mode === 'login' ? 'Teacher login' : 'Create a teacher account'}</h1>
              {mode === 'register' && (
                <label className="field">
                  <span>Your name</span>
                  <input value={f.teacherName} onChange={set('teacherName')} autoComplete="name" required />
                </label>
              )}
              <label className="field">
                <span>E-mail</span>
                <input type="email" value={f.email} onChange={set('email')} autoComplete="email" required />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password" value={f.password} onChange={set('password')} required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : undefined}
                />
                {mode === 'register' && <small className="muted">At least 8 characters.</small>}
              </label>
            </>
          )}
          <ErrorBox error={error} />
          <button className="btn btn--primary btn--big btn--block" disabled={busy}>
            {who === 'student' ? 'Start ▶' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
          {who === 'teacher' && (
            <p className="center small">
              {mode === 'login' ? 'New to ReadBuddy? ' : 'Already have an account? '}
              <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
                {mode === 'login' ? 'Create an account' : 'Log in'}
              </button>
            </p>
          )}
        </form>
      </main>

      <footer className="home__footer">
        <Link to="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}

export function Privacy() {
  return (
    <div className="page page--narrow">
      <p><Link to="/">← Back</Link></p>
      <article className="card prose">
        <h1>Privacy</h1>
        <p>ReadBuddy stores only what it needs to work:</p>
        <ul>
          <li><strong>Teachers:</strong> name, e-mail and a hashed password.</li>
          <li><strong>Students:</strong> name and student number (added by the teacher), reading settings, points, levels and exercise results.</li>
          <li><strong>Recordings:</strong> when a student records their reading, the audio is saved so their teacher can listen to it.</li>
        </ul>
        <p>Only the student’s teacher can see the student’s results and recordings. Other students in the class see names and points on the leaderboard.</p>
        <p>Read-aloud uses the speech voice built into your browser or device. No analytics or advertising trackers are used.</p>
        <p>Data is kept so the service can be analysed and improved. A teacher can remove a student, which deletes all of that student’s data, including recordings. To ask for a copy or deletion of data, contact the student’s teacher or school.</p>
      </article>
    </div>
  );
}
