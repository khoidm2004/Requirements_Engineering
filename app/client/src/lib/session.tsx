import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { get } from './api';
import type { Me } from './types';

interface SessionCtx {
  me: Me | null; // null while loading
  refresh: () => Promise<Me>;
}

const Ctx = createContext<SessionCtx>({ me: null, refresh: async () => ({ kind: null }) });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const refresh = useCallback(async () => {
    const m = await get<Me>('/auth/me').catch((): Me => ({ kind: null }));
    setMe(m);
    return m;
  }, []);
  useEffect(() => {
    refresh();
    const onUnauth = () => setMe({ kind: null });
    window.addEventListener('rb:unauthorized', onUnauth);
    return () => window.removeEventListener('rb:unauthorized', onUnauth);
  }, [refresh]);
  return <Ctx.Provider value={{ me, refresh }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
