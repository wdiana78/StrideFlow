import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, PREVIEW, signedOutEvent, tokenStore } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // True while a deliberate sign-out is in progress, so background requests that now get 401 do not redirect first.
  const leaving = useRef(false);
  // With cookie sessions the browser cannot tell whether it is signed in until it asks the server.
  const [loading, setLoading] = useState(PREVIEW ? !!tokenStore.get() : true);

  const refresh = useCallback(async () => {
    if (PREVIEW && !tokenStore.get()) { setUser(null); setLoading(false); return; }
    try { setUser(await api("/auth/me")); } catch { setUser(null); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const onOut = () => { if (!leaving.current) setUser(null); };
    window.addEventListener(signedOutEvent, onOut);
    return () => window.removeEventListener(signedOutEvent, onOut);
  }, [refresh]);

  const signIn = (res) => {
    if (res.access_token) tokenStore.set(res.access_token); // preview build only
    setUser(res.user);
  };
  // The server ends the session first; only then does the page move on and forget the user.
  const signOut = async ({ then } = {}) => {
    leaving.current = true;
    try { await api("/auth/logout", { method: "POST" }); } catch { /* already signed out */ }
    then?.();
    // Let the navigation commit before forgetting the user; otherwise the route guard's redirect to /login wins.
    await new Promise((r) => setTimeout(r, 0));
    tokenStore.clear();
    setUser(null);
    leaving.current = false;
  };
  const can = {
    manage: user && ["admin", "manager"].includes(user.role),
    admin: user?.role === "admin",
    workOn: (activity) => user && (["admin", "manager"].includes(user.role) || (user.role === "member" && activity?.owner?.id === user.id)),
  };
  return <AuthContext.Provider value={{ user, loading, signIn, signOut, can, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
