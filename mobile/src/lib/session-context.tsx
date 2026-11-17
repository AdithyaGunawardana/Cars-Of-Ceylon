import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearSavedSession, loadSavedSession, saveSession } from "./session";
import { restoreSession, signOutSession } from "./api";
import type { AuthSession } from "./types";

type SessionContextValue = {
  /** null once loaded and signed out; undefined is never exposed (see `loading`). */
  session: AuthSession | null;
  loading: boolean;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const saved = await loadSavedSession();
      if (active && saved) setSession(saved);

      const fresh = await restoreSession();
      if (!active) return;
      if (fresh) {
        setSession(fresh);
        await saveSession(fresh);
      } else if (saved) {
        setSession(null);
        await clearSavedSession();
      }
      setLoading(false);
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (next: AuthSession) => {
    setSession(next);
    await saveSession(next);
  }, []);

  const signOut = useCallback(async () => {
    await signOutSession().catch(() => undefined);
    await clearSavedSession();
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, loading, signIn, signOut }), [session, loading, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}
