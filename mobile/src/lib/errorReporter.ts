// lib/errorReporter.ts
// Typed logger wrapper. NO Sentry, NO Bugsnag, NO Crashlytics - by design.
// In dev: console.warn/error. In release: silent no-op.
// Replace later with a real sink IFF the app graduates to enterprise.

const isDev = __DEV__;

interface ErrorContext {
  screen?: string;
  action?: string;
  userId?: string;
  [key: string]: unknown;
}

export const errorReporter = {
  info(message: string, ctx?: ErrorContext) {
    if (isDev) console.log(`[info] ${message}`, ctx ?? '');
  },
  warn(message: string, ctx?: ErrorContext) {
    if (isDev) console.warn(`[warn] ${message}`, ctx ?? '');
  },
  error(err: unknown, ctx?: ErrorContext) {
    if (!isDev) return;
    // We intentionally use console.warn here. console.error in dev triggers
    // Expo's HMR client to instantiate a NamelessError (extends Error), which
    // hits the same Hermes wrapNativeSuper bug that crashed api.ts. warn
    // surfaces the same content to Metro logs without that path.
    const message =
      err instanceof Error ? err.message
      : typeof err === 'string' ? err
      : (() => { try { return JSON.stringify(err); } catch { return String(err); } })();
    const stack = err instanceof Error ? err.stack : undefined;
    console.warn(`[error] ${message}`, ctx ? { ctx } : '', stack ? { stack } : '');
  },
};
