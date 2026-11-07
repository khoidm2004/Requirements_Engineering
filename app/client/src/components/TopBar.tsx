import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post } from '../lib/api';
import { useSession } from '../lib/session';
import { stopSpeaking } from '../lib/tts';

export function TopBar({ home, children }: { home: string; children?: ReactNode }) {
  const { refresh } = useSession();
  const nav = useNavigate();
  const logout = async () => {
    stopSpeaking();
    await post('/auth/logout').catch(() => {});
    await refresh();
    nav('/');
  };
  return (
    <header className="topbar">
      <Link to={home} className="logo"><span aria-hidden="true">📚</span> ReadBuddy</Link>
      <nav className="topbar__nav">{children}</nav>
      <button type="button" className="btn btn--ghost btn--small" onClick={logout}>Log out</button>
    </header>
  );
}
