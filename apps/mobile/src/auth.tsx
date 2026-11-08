import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, loadToken, saveToken, type Me } from "./api";
import { registerForPush } from "./push";

type Ctx = { me: Me | null; ready: boolean; signIn: (email: string, password: string) => Promise<void>; signUp: (d: Record<string, unknown>) => Promise<void>; signOut: () => Promise<void>; refresh: () => Promise<void> };
const AuthContext = createContext<Ctx>(null as never);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => setMe(await api<Me>("/me")), []);

  useEffect(() => {
    (async () => {
      try { if (await loadToken()) await refresh(); } catch { await saveToken(null); }
      setReady(true);
    })();
  }, [refresh]);

  const afterLogin = async (token: string) => { await saveToken(token); await refresh(); registerForPush().catch(() => undefined); };
  const signIn = async (email: string, password: string) => afterLogin((await api<{ token: string }>("/auth/login", { body: { email, password } })).token);
  const signUp = async (d: Record<string, unknown>) => afterLogin((await api<{ token: string }>("/auth/signup", { body: { ...d, acceptTerms: true } })).token);
  const signOut = async () => { await api("/auth/logout", { method: "POST" }).catch(() => undefined); await saveToken(null); setMe(null); };

  return <AuthContext.Provider value={{ me, ready, signIn, signUp, signOut, refresh }}>{children}</AuthContext.Provider>;
}
