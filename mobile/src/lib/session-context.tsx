import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, refreshSession, setSignedOutHandler, signInWithPassword, signOutDevice } from "./api-client";
import { registerAndSignIn } from "./api";
import { loadStoredAuth } from "./token-store";
import type { AuthSession } from "./types";

type SessionContextValue = {
  session: AuthSession | null;
  /** True while the stored session is being restored at launch. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // The server rejecting our refresh token (revoked, expired, banned) means we are signed out everywhere.
    setSignedOutHandler(() => active && setSession(null));

    async function restore() {
      const stored = await loadStoredAuth();
      if (!active) return;
      if (!stored) {
        setLoading(false);
        return;
      }

      // Show the app immediately from the cached user, then confirm with the server.
      setSession({ user: stored.user });
      try {
        const user = await refreshSession();
        if (active) setSession({ user });
      } catch (error) {
        // Offline at launch: stay signed in; requests will retry the refresh. A 401 already signed us out.
        if (!(error instanceof ApiError) || error.status === 401) {
          /* handled by the signed-out handler */
        }
      }
      if (active) setLoading(false);
    }

    restore();
    return () => {
      active = false;
      setSignedOutHandler(null);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setSession({ user: await signInWithPassword(email, password) });
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setSession({ user: await registerAndSignIn(name, email, password) });
  }, []);

  const signOut = useCallback(async () => {
    await signOutDevice();
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, loading, signIn, register, signOut }), [session, loading, signIn, register, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}
