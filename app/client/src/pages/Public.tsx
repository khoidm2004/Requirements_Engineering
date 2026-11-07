import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AdultLayout, ErrorText } from '../components/Layout';
import { ApiError, post } from '../lib/api';
import { speak } from '../lib/tts';
import { playTryAgain } from '../lib/sounds';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { SpeakButton } from '../components/Speak';

const errCode = (e: unknown) => (e instanceof ApiError ? e.code : 'network');

/**
 * FR-ACC-00 — the single home page for children and teachers. The child login form (student number +
 * name) is the default; a tab on the same page shows the teacher form. `/?teacher` opens the teacher tab.
 */
export function Home() {
  const { t } = useI18n();
  const { me } = useSession();
  const [params, setParams] = useSearchParams();
  const role: 'student' | 'teacher' = params.has('teacher') ? 'teacher' : 'student';
  const setRole = (r: 'student' | 'teacher') => setParams(r === 'teacher' ? { teacher: '' } : {}, { replace: true });
  if (me?.kind === 'teacher') return <Navigate to="/teacher" replace />;
  if (me?.kind === 'child') return <Navigate to="/play" replace />;
  return (
    <AdultLayout>
      <div className="home">
        <section className="card login-card" aria-labelledby="login-h">
          <h1 id="login-h" className="sr-only">{t('home.loginTitle')}</h1>
          <div className="tabs" role="tablist" aria-label={t('home.whoAreYou')}>
            {(['student', 'teacher'] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                id={`tab-${r}`}
                aria-selected={role === r}
                aria-controls={`panel-${r}`}
                className={`tab ${role === r ? 'tab--on' : ''}`}
                onClick={() => setRole(r)}
              >
                {r === 'student' ? '🧒 ' : '🍎 '}
                {t(`home.tab.${r}`)}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${role}`} aria-labelledby={`tab-${role}`}>
            {role === 'student' ? <StudentLogin /> : <TeacherLogin />}
          </div>
        </section>
        <section className="home__intro">
          <h2 className="kid-title">{t('landing.title')}</h2>
          <p className="lead">{t('landing.lead')}</p>
          <ul className="feature-list">
            <li>🔊 {t('landing.f1')}</li>
            <li>🔤 {t('landing.f2')}</li>
            <li>📈 {t('landing.f3')}</li>
            <li>🔒 {t('landing.f4')}</li>
          </ul>
        </section>
      </div>
    </AdultLayout>
  );
}

/** Field label with an audio version (NFR-US-01, NFR-US-04). */
function SpokenLabel({ htmlFor, text }: { htmlFor: string; text: string }) {
  const { lang, t } = useI18n();
  return (
    <span className="field-label">
      <label htmlFor={htmlFor}>{text}</label>
      <SpeakButton text={text} lang={lang} label={t('common.listenTo', { text })} className="speak-btn--mini" />
    </span>
  );
}

/** FR-ACC-05 — child login: student number + name. */
function StudentLogin() {
  const { t, lang } = useI18n();
  const { refresh } = useSession();
  const nav = useNavigate();
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'wrong' | 'locked' | 'network'>('idle');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('busy');
    try {
      await post('/auth/student-login', { studentNumber: number, name });
      await refresh();
      nav('/play');
    } catch (err) {
      const s = err instanceof ApiError ? (err.status === 423 ? 'locked' : 'wrong') : 'network';
      setStatus(s);
      playTryAgain();
      speak(t(s === 'locked' ? 'childLogin.locked' : s === 'wrong' ? 'childLogin.wrong' : 'error.network'), { lang });
    }
  };
  const message = status === 'locked' ? t('childLogin.locked') : status === 'wrong' ? t('childLogin.wrong') : status === 'network' ? t('error.network') : null;
  return (
    <form className="form kid-login" onSubmit={submit}>
      <div className="row">
        <SpeakButton big text={t('childLogin.intro')} lang={lang} label={t('childLogin.listenIntro')} />
        <p>{t('childLogin.intro')}</p>
      </div>
      <div className="field">
        <SpokenLabel htmlFor="sn" text={t('childLogin.number')} />
        <input id="sn" required autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} value={number} onChange={(e) => setNumber(e.target.value)} />
      </div>
      <div className="field">
        <SpokenLabel htmlFor="sname" text={t('childLogin.name')} />
        <input id="sname" required autoComplete="off" spellCheck={false} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {message && (
        <div className={status === 'locked' ? 'locked-box' : ''} role="alert">
          <SpeakButton text={message} lang={lang} className="speak-btn--mini" />
          <span className="error">{status === 'locked' ? '🔒 ' : ''}{message}</span>
        </div>
      )}
      <button className="btn btn--primary btn--xl" type="submit" disabled={status === 'busy'}>▶ {t('childLogin.submit')}</button>
    </form>
  );
}

/** FR-ACC-00 — teacher form on the same page (e-mail + password). */
function TeacherLogin() {
  const { t } = useI18n();
  const { refresh } = useSession();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await post('/auth/teacher-login', { email, password });
      await refresh();
      nav('/teacher');
    } catch (e) {
      setErr(errCode(e));
    }
  };
  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>{t('common.email')}</span>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span>{t('common.password')}</span>
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <ErrorText code={err} />
      <button className="btn btn--primary" type="submit">{t('login.submit')}</button>
      <p>
        <Link to="/forgot">{t('login.forgot')}</Link> · <Link to="/register">{t('login.noAccount')}</Link>
      </p>
    </form>
  );
}

export function Register() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await post('/auth/register', { email, password, name });
      setDone(true);
    } catch (e) {
      setErr(errCode(e));
    }
  };
  if (done)
    return (
      <AdultLayout title={t('register.doneTitle')}>
        <div className="card">
          <p>{t('register.done', { email })}</p>
          <Link className="btn btn--primary" to="/?teacher">{t('login.title')}</Link>
        </div>
      </AdultLayout>
    );
  return (
    <AdultLayout title={t('register.title')}>
      <form className="card form" onSubmit={submit}>
        <label className="field">
          <span>{t('register.name')}</span>
          <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label className="field">
          <span>{t('common.email')}</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <div className="field">
          <label htmlFor="reg-pw"><strong>{t('common.password')}</strong></label>
          <input id="reg-pw" type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pwhint" />
          <small id="pwhint" className="hint">{t('register.pwHint')}</small>
        </div>
        <ErrorText code={err} />
        <button className="btn btn--primary" type="submit">{t('register.submit')}</button>
        <p className="hint">
          {t('register.privacyNote')} <Link to="/privacy">{t('footer.privacy')}</Link>
        </p>
        <p><Link to="/?teacher">{t('register.haveAccount')}</Link></p>
      </form>
    </AdultLayout>
  );
}

export function Verify() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [state, setState] = useState<'pending' | 'ok' | string>('pending');
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return; // the token is single-use; never send it twice
    sent.current = true;
    post('/auth/verify', { token: params.get('token') })
      .then(() => setState('ok'))
      .catch((e) => setState(errCode(e)));
  }, [params]);
  return (
    <AdultLayout title={t('verify.title')}>
      <div className="card">
        {state === 'pending' && <p>{t('common.loading')}</p>}
        {state === 'ok' && <p>✅ {t('verify.ok')}</p>}
        {state !== 'pending' && state !== 'ok' && <ErrorText code={state} />}
        <Link className="btn btn--primary" to="/?teacher">{t('login.title')}</Link>
      </div>
    </AdultLayout>
  );
}

export function Forgot() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <AdultLayout title={t('forgot.title')}>
      <form
        className="card form"
        onSubmit={async (e) => {
          e.preventDefault();
          await post('/auth/forgot', { email }).catch(() => {});
          setSent(true);
        }}
      >
        {sent ? (
          <p role="status">{t('forgot.sent')}</p>
        ) : (
          <>
            <label className="field">
              <span>{t('common.email')}</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn btn--primary" type="submit">{t('forgot.submit')}</button>
          </>
        )}
      </form>
    </AdultLayout>
  );
}

export function Reset() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  return (
    <AdultLayout title={t('reset.title')}>
      <form
        className="card form"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            await post('/auth/reset', { token: params.get('token'), password });
            setDone(true);
          } catch (e) {
            setErr(errCode(e));
          }
        }}
      >
        {done ? (
          <>
            <p role="status">✅ {t('reset.done')}</p>
            <Link className="btn btn--primary" to="/?teacher">{t('login.title')}</Link>
          </>
        ) : (
          <>
            <label className="field">
              <span>{t('reset.newPassword')}</span>
              <input type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
              <small className="hint">{t('register.pwHint')}</small>
            </label>
            <ErrorText code={err} />
            <button className="btn btn--primary" type="submit">{t('reset.submit')}</button>
          </>
        )}
      </form>
    </AdultLayout>
  );
}

/** NFR-PRV-01 — plain-language privacy notice with a child-friendly audio version. */
export function Privacy() {
  const { t, lang } = useI18n();
  const sections = ['who', 'what', 'why', 'where', 'how_long', 'rights', 'not'];
  return (
    <AdultLayout title={t('privacy.title')}>
      <div className="card privacy-kids">
        <h2>{t('privacy.kidsTitle')}</h2>
        <div className="row">
          <SpeakButton big text={t('privacy.kidsText')} lang={lang} label={t('privacy.kidsListen')} />
          <p>{t('privacy.kidsText')}</p>
        </div>
      </div>
      <div className="card prose">
        <p className="muted">{t('privacy.version')}</p>
        {sections.map((s) => (
          <section key={s}>
            <h2>{t(`privacy.${s}.h`)}</h2>
            <p>{t(`privacy.${s}.p`)}</p>
          </section>
        ))}
      </div>
    </AdultLayout>
  );
}
