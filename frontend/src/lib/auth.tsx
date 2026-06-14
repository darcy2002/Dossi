import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, tokenStore } from "./api";
import type { AuthResponse, User } from "./types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  ready: boolean;
  loginWith: (res: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(tokenStore.get());
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  function loginWith(res: AuthResponse) {
    tokenStore.set(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
  }

  function logout() {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }

  // Hydrate the user from a stored token on boot; clear if invalid.
  useEffect(() => {
    let active = true;
    const t = tokenStore.get();
    if (!t) {
      setReady(true);
      return;
    }
    api<User>("/auth/me")
      .then((u) => active && setUser(u))
      .catch(() => active && logout())
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  // Global 401 handler from the api layer.
  useEffect(() => {
    const handler = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener("dossi:unauthorized", handler);
    return () => window.removeEventListener("dossi:unauthorized", handler);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, ready, loginWith, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
