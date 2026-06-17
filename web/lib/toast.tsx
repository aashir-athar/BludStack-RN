"use client";

// Lightweight toast - the web analogue of the app's toastStore. Replaces native
// alert() for all non-confirmation feedback (a house rule). Skeleton-only loading
// and toast-only errors keep the surfaces calm.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}
interface ToastOpts {
  description?: string;
}

interface ToastApi {
  success: (title: string, opts?: ToastOpts) => void;
  error: (title: string, opts?: ToastOpts) => void;
  info: (title: string, opts?: ToastOpts) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;
const TONE_CLASS = {
  success: "text-saline-400",
  error: "text-crimson-400",
  info: "text-onyx-100",
} as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback((tone: ToastTone, title: string, opts?: ToastOpts) => {
    const id = ++seq.current;
    setItems((prev) => [...prev, { id, tone, title, description: opts?.description }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, o) => push("success", t, o),
      error: (t, o) => push("error", t, o),
      info: (t, o) => push("info", t, o),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {items.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-white/10 bg-onyx-850/95 p-4 shadow-2xl backdrop-blur-xl"
            >
              <Icon size={20} className={`mt-0.5 shrink-0 ${TONE_CLASS[t.tone]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-bone-50">{t.title}</p>
                {t.description ? <p className="mt-0.5 text-sm text-onyx-200">{t.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 rounded-full p-1 text-onyx-300 transition-colors hover:bg-white/5 hover:text-bone-50"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
