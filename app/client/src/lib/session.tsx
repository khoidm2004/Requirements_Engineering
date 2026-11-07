import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, post } from './api';
import type { ChildSettings } from './constants';

export interface Teacher {
  id: number;
  email: string;
  name: string;
  email_verified: boolean;
}
export interface ChildMe {
  id: number;
  name: string;
  language: 'en' | 'fi';
  settings: ChildSettings;
}
export type Me = { kind: 'none' } | { kind: 'teacher'; teacher: Teacher } | { kind: 'child'; child: ChildMe };

interface SessionCtx {
  me: Me | null;
  refresh: () => Promise<Me>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({ me: null, refresh: async () => ({ kind: 'none' }), logout: async () => {} });

/** FR-ACC-06 — idle limits, mirrored on the server. */
const IDLE_MS = { child: 20 * 60_000, teacher: 30 * 60_000 };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const lastActivity = useRef(Date.now());

  const refresh = useCallback(async () => {
    const m = await api<Me>('GET', '/auth/me', undefined, true).catch(() => ({ kind: 'none' }) as Me);
    setMe(m);
    return m;
  }, []);

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => {});
    setMe({ kind: 'none' });
  }, []);

  useEffect(() => {
    refresh();
    const onUnauth = () => setMe({ kind: 'none' });
    window.addEventListener('rb:unauthorized', onUnauth);
    return () => window.removeEventListener('rb:unauthorized', onUnauth);
  }, [refresh]);

  // Client-side idle timer; the server enforces the same limits.
  const kind = me?.kind;
  useEffect(() => {
    if (!kind || kind === 'none') return;
    const limit = IDLE_MS[kind];
    const bump = () => (lastActivity.current = Date.now());
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    bump();
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current > limit) logout();
    }, 15_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(timer);
    };
  }, [kind, logout]);

  return <Ctx.Provider value={{ me, refresh, logout }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
