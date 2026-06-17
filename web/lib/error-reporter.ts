// lib/error-reporter.ts - typed logger wrapper. No Sentry, no Bugsnag, by design.
// In dev: console. In production: silent no-op.

const isDev = process.env.NODE_ENV !== "production";

interface ErrorContext {
  screen?: string;
  action?: string;
  [key: string]: unknown;
}

export const errorReporter = {
  info(message: string, ctx?: ErrorContext) {
    if (isDev) console.info(`[info] ${message}`, ctx ?? "");
  },
  warn(message: string, ctx?: ErrorContext) {
    if (isDev) console.warn(`[warn] ${message}`, ctx ?? "");
  },
  error(err: unknown, ctx?: ErrorContext) {
    if (!isDev) return;
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : (() => {
              try {
                return JSON.stringify(err);
              } catch {
                return String(err);
              }
            })();
    console.warn(`[error] ${message}`, ctx ? { ctx } : "");
  },
};
