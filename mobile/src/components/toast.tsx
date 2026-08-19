import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Text, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ToastState {
  id: number;
  message: string;
  variant: 'default' | 'error';
}

interface ToastContextValue {
  show: (message: string, variant?: 'default' | 'error') => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, variant: 'default' | 'error' = 'default') => {
    counter.current += 1;
    setToast({ id: counter.current, message, variant });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      <View className="flex-1">
        {children}
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={SlideInDown.springify().damping(18)}
            exiting={SlideOutDown}
            className="pointer-events-none absolute left-5 right-5 items-center"
            style={{ bottom: Math.max(insets.bottom, 16) + 8 }}
          >
            <View
              className={`max-w-full rounded-full border bg-depth px-5 py-3 ${
                toast.variant === 'error' ? 'border-koi/50' : 'border-foam/15'
              }`}
            >
              <Text
                numberOfLines={2}
                className={`font-display text-sm ${
                  toast.variant === 'error' ? 'text-koi' : 'text-foam'
                }`}
              >
                {toast.message}
              </Text>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
