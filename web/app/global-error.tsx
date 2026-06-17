"use client";

// Root-level error boundary. Next renders this in place of the whole document
// when an error escapes the root layout, so it must ship its own html/body.
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No external error service by design; surface to the console in dev only.
    if (process.env.NODE_ENV !== "production") console.warn("[global-error]", error.message);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0910",
          color: "#f4f2ee",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#b5b4bc", margin: "0 0 24px", lineHeight: 1.6 }}>
            An unexpected error interrupted the app. You can try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              borderRadius: 9999,
              border: "none",
              background: "#d4183d",
              color: "#fff",
              fontWeight: 600,
              padding: "12px 28px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
