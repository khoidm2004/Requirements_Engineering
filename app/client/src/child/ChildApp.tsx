import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { api, flushResults, get, newClientId, submitResult } from '../lib/api';
import { FixedLang, useI18n, type Lang } from '../lib/i18n';
import { useSession } from '../lib/session';
import { speak, stop } from '../lib/tts';
import { playFinish } from '../lib/sounds';
import { readingStyle, TYPE_ICONS, type ChildSettings, type ExerciseType } from '../lib/constants';
import { SpeakButton } from '../components/Speak';
import { SettingsEditor } from '../components/ChildPanels';
import { Loading } from '../components/Layout';
import { ExercisePlayer, type Exercise, type Finished } from './ExercisePlayer';

/** Button with icon, text and an audio label (NFR-US-04: icons + audio labels). */
function KidButton({ icon, label, onClick, className = '' }: { icon: string; label: string; onClick: () => void; className?: string }) {
  const { lang } = useI18n();
  return (
    <span className="kid-btn-wrap">
      <button type="button" className={`kid-btn ${className}`} onClick={onClick}>
        <span className="kid-btn__icon" aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </button>
      <SpeakButton text={label} lang={lang} label={label} className="speak-btn--mini" />
    </span>
  );
}

// ---------------- Child shell ----------------

interface ChildMe {
  id: number;
  name: string;
  language: Lang;
  stars: number;
  settings: ChildSettings;
}

const ChildCtx = createContext<{ me: ChildMe; setStars: (n: number) => void } | null>(null);
const useChild = () => useContext(ChildCtx)!;

export function ChildShell() {
  const { me: session, logout } = useSession();
  const nav = useNavigate();
  const [me, setMe] = useState<ChildMe | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (session?.kind !== 'child') return;
    get<ChildMe>('/child/me').then(setMe).catch(() => {});
    flushResults();
    const online = () => flushResults();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [session]);

  if (session && session.kind !== 'child') return <Navigate to="/" replace />;
  if (!me) return <Loading />;

  const updateSettings = async (patch: Partial<ChildSettings>) => {
    setMe({ ...me, settings: { ...me.settings, ...patch } }); // immediate (FR-SUP-03)
    await api('PATCH', '/child/settings', patch).catch(() => {});
  };

  return (
    <FixedLang lang={me.language}>
      <ChildCtx.Provider value={{ me, setStars: (n) => setMe((m) => (m ? { ...m, stars: n } : m)) }}>
        <div className="child-screen" style={readingStyle(me.settings)}>
          <ChildHeader
            me={me}
            onSettings={() => setSettingsOpen(true)}
            onLogout={async () => {
              stop();
              await logout();
              nav('/');
            }}
          />
          <main id="main">
            <Outlet />
          </main>
          <ChildFooter />
          {settingsOpen && <SettingsDialog value={me.settings} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />}
        </div>
      </ChildCtx.Provider>
    </FixedLang>
  );
}

function ChildHeader({ me, onSettings, onLogout }: { me: ChildMe; onSettings: () => void; onLogout: () => void }) {
  const { t, lang } = useI18n();
  return (
    <header className="kid-header">
      <div className="row">
        <span className="kid-avatar" aria-hidden="true">🦉</span>
        <span className="kid-name">{me.name}</span>
        <span className="stars" aria-label={t('child.starsCount', { n: me.stars })}>⭐ {me.stars}</span>
      </div>
      <div className="row">
        <button className="icon-btn icon-btn--big" onClick={() => { speak(t('child.settings'), { lang }); onSettings(); }} aria-label={t('child.settings')} title={t('child.settings')}>⚙️</button>
        <button className="icon-btn icon-btn--big" onClick={onLogout} aria-label={t('child.logout')} title={t('child.logout')}>🚪</button>
      </div>
    </header>
  );
}

function ChildFooter() {
  const { t, lang } = useI18n();
  return (
    <footer className="kid-footer">
      <Link to="/privacy" className="row">🔒 {t('footer.privacy')}</Link>
      <SpeakButton text={t('privacy.kidsText')} lang={lang} label={t('privacy.kidsListen')} className="speak-btn--mini" />
    </footer>
  );
}

function SettingsDialog({ value, onChange, onClose }: { value: ChildSettings; onChange: (p: Partial<ChildSettings>) => void; onClose: () => void }) {
  const { t, lang } = useI18n();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="set-h">
      <div className="modal__box">
        <div className="row row--between">
          <h2 id="set-h" className="row"><SpeakButton text={t('child.settings')} lang={lang} /> ⚙️ {t('child.settings')}</h2>
          <button className="icon-btn icon-btn--big" onClick={onClose} aria-label={t('common.close')} autoFocus>✖</button>
        </div>
        <SettingsEditor value={value} onChange={onChange} big />
      </div>
    </div>
  );
}

// ---------------- FR-EX-10: Today's practice ----------------

interface PracticeItem {
  exerciseId: number;
  type: ExerciseType;
  title: string;
  assigned: boolean;
  dueDate: string | null;
  inProgress: boolean;
}

export function ChildHome() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const { me } = useChild();
  const [items, setItems] = useState<PracticeItem[] | null>(null);
  useEffect(() => {
    get<PracticeItem[]>('/child/today').then(setItems).catch(() => setItems([]));
  }, []);
  if (!items) return <Loading />;
  const greeting = t('child.hello', { name: me.name.split(' ')[0] });
  return (
    <div className="kid-home">
      <div className="row row--center">
        <SpeakButton big text={`${greeting} ${t('child.todayHint')}`} lang={lang} />
        <h1 className="kid-title">{t('child.today')}</h1>
      </div>
      {items.length === 0 && <p className="lead">{t('child.nothingToday')}</p>}
      <div className="practice-grid">
        {items.map((it) => (
          <div key={it.exerciseId} className="practice-card-wrap">
            <button className={`practice-card practice-card--${it.type}`} onClick={() => nav(`/play/exercise/${it.exerciseId}`)}>
              <span className="practice-card__icon" aria-hidden="true">{TYPE_ICONS[it.type]}</span>
              <span className="practice-card__title">{t('type.' + it.type)}</span>
              {it.assigned && <span className="tag" title={t('child.fromTeacher')}>📌 <span className="sr-only">{t('child.fromTeacher')}</span></span>}
              {it.inProgress && <span className="tag tag--resume" title={t('child.continue')}>⏯ <span className="sr-only">{t('child.continue')}</span></span>}
            </button>
            <SpeakButton text={t('type.' + it.type) + (it.assigned ? '. ' + t('child.fromTeacher') : '')} lang={lang} className="speak-btn--mini" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Exercise page ----------------

export function ChildExercise() {
  const { t, lang } = useI18n();
  const id = Number(useParams().id);
  const nav = useNavigate();
  const { me, setStars } = useChild();
  const [ex, setEx] = useState<Exercise | null>(null);
  const [done, setDone] = useState<{ stars: number; levelUp: boolean } | null>(null);

  useEffect(() => {
    get<Exercise>(`/child/exercises/${id}`)
      .then((e) => {
        // Prefer the newest of server and browser progress (NFR-REL-03 / FR-EX-08)
        try {
          const local = JSON.parse(localStorage.getItem(`rb_progress_${id}`) ?? 'null');
          const sameItems = JSON.stringify(local?.itemIds ?? null) === JSON.stringify(e.content.itemIds ?? null);
          if (local && sameItems && (!e.progress || local.index > e.progress.index)) e.progress = local;
        } catch {
          /* ignore */
        }
        setEx(e);
      })
      .catch(() => nav('/play'));
  }, [id, nav]);

  const finish = useCallback(
    async (r: Finished) => {
      playFinish();
      // FR-MOT-01 — computed locally too, so the child sees stars even when offline
      const acc = r.correct / r.items;
      const localStars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
      setDone({ stars: localStars, levelUp: false });
      speak(t('ex.done'), { lang });
      const res = await submitResult({ exerciseId: id, ...r, clientId: newClientId() });
      if (res) {
        setDone({ stars: res.stars, levelUp: res.levelChange > 0 });
        if (res.totalStars !== undefined) setStars(res.totalStars);
      } else setStars(me.stars + localStars);
    },
    [id, t, lang, setStars, me.stars],
  );

  if (!ex) return <Loading />;
  if (done)
    return (
      <div className="finish">
        <div className="finish__stars" aria-label={t('child.starsEarned', { n: done.stars })} role="img">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`big-star ${n <= done.stars ? 'big-star--on' : ''}`} style={{ animationDelay: `${n * 0.2}s` }}>★</span>
          ))}
        </div>
        <p className="kid-title row row--center"><SpeakButton text={t('ex.done')} lang={lang} /> {t('ex.done')}</p>
        {done.levelUp && <p className="level-up">🚀 {t('ex.levelUp')}</p>}
        <KidButton icon="🏠" label={t('child.backHome')} onClick={() => nav('/play')} className="kid-btn--primary" />
      </div>
    );
  return (
    <ExercisePlayer
      exercise={ex}
      settings={me.settings}
      onFinish={finish}
      onExit={() => nav('/play')}
    />
  );
}

export function ChildGate({ children }: { children: ReactNode }) {
  const { me } = useSession();
  if (!me) return <Loading />;
  if (me.kind !== 'child') return <Navigate to="/" replace />;
  return <>{children}</>;
}

