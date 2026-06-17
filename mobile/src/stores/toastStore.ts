// stores/toastStore.ts
// Toast as a Zustand store - replaces ToastContext. One animated pill, auto-
// dismiss, theme-aware. The viewport (ui/Toast.tsx) reads `current` and renders.
//
//   const toast = useToast();
//   toast.success('Saved'); toast.error('No network', { description: 'Try again' });
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastInput {
  description?: string;
  duration?: number;
  action?: { label: string; onPress: () => void };
}

export interface ToastShape extends ToastInput {
  id: number;
  kind: ToastKind;
  title: string;
}

interface ToastState {
  current: ToastShape | null;
  seq: number;
}
interface ToastActions {
  show: (kind: ToastKind, title: string, opts?: ToastInput) => void;
  success: (title: string, opts?: ToastInput) => void;
  error: (title: string, opts?: ToastInput) => void;
  info: (title: string, opts?: ToastInput) => void;
  warning: (title: string, opts?: ToastInput) => void;
  dismiss: () => void;
}
export type ToastStore = ToastState & ToastActions;

// Single dismiss timer, kept outside the store (it is not render state).
let timer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastStore>()(
  subscribeWithSelector((set, get) => ({
    current: null,
    seq: 0,
    show: (kind, title, opts) => {
      if (timer) clearTimeout(timer);
      // Monotonic id (a counter is enough to key the animated viewport between
      // toasts and avoids Date.now, which is unavailable in some sandboxes).
      const id = get().seq + 1;
      set({ current: { id, kind, title, ...(opts ?? {}) }, seq: id });
      const duration = opts?.duration ?? (kind === 'error' ? 5000 : 3200);
      timer = setTimeout(() => set({ current: null }), duration);
    },
    success: (t, o) => get().show('success', t, o),
    error: (t, o) => get().show('error', t, o),
    info: (t, o) => get().show('info', t, o),
    warning: (t, o) => get().show('warning', t, o),
    dismiss: () => {
      if (timer) { clearTimeout(timer); timer = null; }
      set({ current: null });
    },
  })),
);

// ── Selectors ────────────────────────────────────────────────────────────────
export const useToastCurrent = () => useToastStore((s) => s.current);

// Stable action bundle mirroring the old useToast() API.
export const useToast = () =>
  useToastStore(
    useShallow((s) => ({
      success: s.success,
      error: s.error,
      info: s.info,
      warning: s.warning,
      dismiss: s.dismiss,
    })),
  );
