import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { LANGS, useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="footer">
      {/* NFR-PRV-01 — privacy notice reachable from every page */}
      <Link to="/privacy">🔒 {t('footer.privacy')}</Link>
      <span className="muted">ReadBuddy</span>
    </footer>
  );
}

export function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="lang-switch">
      <span className="sr-only">{t('common.language')}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>
        {LANGS.map((l) => (
          <option key={l} value={l}>{t('lang.' + l)}</option>
        ))}
      </select>
    </label>
  );
}

export function AdultLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { t } = useI18n();
  const { me, logout } = useSession();
  const nav = useNavigate();
  const teacher = me?.kind === 'teacher' ? me.teacher : null;
  return (
    <div className="adult">
      <a className="skip" href="#main">{t('common.skip')}</a>
      <header className="topbar">
        <Link to={teacher ? '/teacher' : '/'} className="brand">📖 ReadBuddy</Link>
        {teacher && (
          <nav className="topnav" aria-label={t('nav.label')}>
            <NavLink to="/teacher" end>{t('nav.classes')}</NavLink>
            <NavLink to="/teacher/texts">{t('nav.texts')}</NavLink>
            <NavLink to="/teacher/pictures">{t('nav.pictures')}</NavLink>
            <NavLink to="/teacher/account">{t('nav.account')}</NavLink>
          </nav>
        )}
        <div className="topbar__right">
          <LangSwitch />
          {teacher && (
            <>
              <span className="muted topbar__who">{teacher.name}</span>
              <button
                className="btn btn--ghost"
                onClick={async () => {
                  await logout();
                  nav('/');
                }}
              >
                {t('common.logout')}
              </button>
            </>
          )}
        </div>
      </header>
      <main id="main" className="container">
        {title && <h1>{title}</h1>}
        {children}
      </main>
      <Footer />
    </div>
  );
}

export function ErrorText({ code }: { code: string | null }) {
  const { t } = useI18n();
  if (!code) return null;
  const key = 'error.' + code;
  const msg = t(key);
  return (
    <p className="error" role="alert">
      {msg === key ? t('error.generic') : msg}
    </p>
  );
}

export function Loading() {
  const { t } = useI18n();
  return <p className="muted" role="status">{t('common.loading')}</p>;
}
