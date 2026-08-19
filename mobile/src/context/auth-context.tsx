import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, configureApiAuth, type SessionTokens } from '../lib/api';
import { registerForPushNotifications } from '../lib/notifications';
import type { User } from '../lib/types';

const STORAGE_KEY = 'ripple.session';

interface Session extends SessionTokens {
  user: User;
}

interface AuthContextValue {
  user: User | null;
  /** Current short-lived access token (rotates); used by the realtime socket. */
  accessToken: string | null;
  /** True while the persisted session is being restored on app launch. */
  isRestoring: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const clearSession = useCallback(() => {
    setSession(null);
    sessionRef.current = null;
    void AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  // The API client reads tokens through a ref (never stale), persists rotated
  // pairs, and force-logs-out when the refresh token stops working.
  useEffect(() => {
    configureApiAuth({
      getSession: () => sessionRef.current,
      onSessionRefreshed: (tokens) => {
        const current = sessionRef.current;
        if (!current) return;
        const next = { ...current, ...tokens };
        sessionRef.current = next;
        setSession(next);
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      },
      onSessionExpired: clearSession,
    });
  }, [clearSession]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Session;
        // Sessions persisted by pre-refresh-token versions lack refreshToken;
        // treat them as logged out rather than half-working.
        if (parsed.refreshToken) {
          setSession(parsed);
        } else {
          void AsyncStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => AsyncStorage.removeItem(STORAGE_KEY))
      .finally(() => setIsRestoring(false));
  }, []);

  const persistSession = useCallback(async (next: Session) => {
    setSession(next);
    sessionRef.current = next;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // Fire-and-forget: push registration must not block navigation.
    void registerForPushNotifications();
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const auth = await api.login(username, password);
      await persistSession({
        token: auth.token,
        refreshToken: auth.refreshToken,
        user: auth.user,
      });
    },
    [persistSession]
  );

  const signup = useCallback(
    async (username: string, password: string) => {
      const auth = await api.signup(username, password);
      await persistSession({
        token: auth.token,
        refreshToken: auth.refreshToken,
        user: auth.user,
      });
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    const refreshToken = sessionRef.current?.refreshToken;
    clearSession();
    if (refreshToken) {
      await api.logout(refreshToken); // best-effort server-side revocation
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.token ?? null,
      isRestoring,
      login,
      signup,
      logout,
    }),
    [session, isRestoring, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
