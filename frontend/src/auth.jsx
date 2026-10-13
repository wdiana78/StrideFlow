import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api("/auth/me"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onOut = () => setUser(null);
    window.addEventListener("kept:signed-out", onOut);
    return () => window.removeEventListener("kept:signed-out", onOut);
  }, [refresh]);

  const signIn = (tokenResponse) => {
    tokenStore.set(tokenResponse.access_token);
    setUser(tokenResponse.user);
  };
  const signOut = () => {
    tokenStore.clear();
    setUser(null);
  };
  const can = {
    manage: user && ["admin", "manager"].includes(user.role),
    admin: user?.role === "admin",
    workOn: (activity) => user && (["admin", "manager"].includes(user.role) || (user.role === "member" && activity?.owner?.id === user.id)),
  };
  return <AuthContext.Provider value={{ user, loading, signIn, signOut, can, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
