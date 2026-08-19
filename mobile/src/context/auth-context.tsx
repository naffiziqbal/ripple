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
import { api, setTokenProvider } from '../lib/api';
import { registerForPushNotifications } from '../lib/notifications';
import type { User } from '../lib/types';

const STORAGE_KEY = 'ripple.session';

interface Session {
  token: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
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

  // The API client reads the token through a ref so it is never stale.
  useEffect(() => {
    setTokenProvider(() => sessionRef.current?.token ?? null);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSession(JSON.parse(raw) as Session);
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
      await persistSession(await api.login(username, password));
    },
    [persistSession]
  );

  const signup = useCallback(
    async (username: string, password: string) => {
      await persistSession(await api.signup(username, password));
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    setSession(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ user: session?.user ?? null, isRestoring, login, signup, logout }),
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
