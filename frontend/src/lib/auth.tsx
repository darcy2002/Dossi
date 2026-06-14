import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api, tokenStore } from "./api";
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

  // Hydrate the user from a stored token on boot. Only a 401 means the token
  // is actually invalid; transient failures (backend cold start, network blip,
  // 5xx) must NOT log the user out — keep the token and retry.
  useEffect(() => {
    let active = true;
    const t = tokenStore.get();
    if (!t) {
      setReady(true);
      return;
    }

    async function hydrate() {
      for (let attempt = 0; active; attempt++) {
        try {
          const u = await api<User>("/auth/me");
          if (active) {
            setUser(u);
            setReady(true);
          }
          return;
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            if (active) {
              logout();
              setReady(true);
            }
            return;
          }
          // Transient error: keep the token. Back off and retry; after a few
          // attempts, enter the app anyway (token is still valid).
          if (attempt >= 3) {
            if (active) setReady(true);
            return;
          }
          await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 8000)));
        }
      }
    }

    hydrate();
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
