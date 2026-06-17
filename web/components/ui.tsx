// Web design-system primitives, matching the app's UI kit: theme tokens only,
// Skeleton (never a spinner) for loading, full a11y. Reused across every screen.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// ── cn helper ────────────────────────────────────────────────────────────────
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-crimson-600 text-white hover:bg-crimson-500 shadow-lg shadow-crimson-600/20",
  secondary: "border border-white/12 bg-white/5 text-bone-50 hover:bg-white/10",
  ghost: "text-onyx-100 hover:bg-white/5",
  danger: "bg-crimson-700/15 text-crimson-300 hover:bg-crimson-700/25",
};
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        fullWidth && "w-full",
        loading && "animate-pulse",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:scale-[0.98]",
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {children}
    </Link>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cn("rounded-3xl border border-white/8 bg-surface p-5 sm:p-6", className)}>{children}</Tag>
  );
}

// ── Field + Input ────────────────────────────────────────────────────────────
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-onyx-100">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-sm text-crimson-400">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm text-onyx-300">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return (
    <input
      {...rest}
      className={cn(
        "w-full rounded-2xl border border-white/10 bg-onyx-900 px-4 py-3 text-base text-bone-50 outline-none transition-colors placeholder:text-onyx-400 focus:border-crimson-500/60",
        className,
      )}
    />
  );
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return (
    <textarea
      {...rest}
      className={cn(
        "w-full resize-none rounded-2xl border border-white/10 bg-onyx-900 px-4 py-3 text-base text-bone-50 outline-none transition-colors placeholder:text-onyx-400 focus:border-crimson-500/60",
        className,
      )}
    />
  );
}

// ── Skeleton (never a spinner) ───────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/5", className)} aria-hidden />;
}

// ── Badges ───────────────────────────────────────────────────────────────────
export function BloodGroupBadge({ group, size = "md" }: { group: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm";
  return (
    <span
      aria-label={`Blood group ${group}`}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-crimson-600 font-black text-white",
        size === "lg" ? "rounded-full" : "rounded-full",
        sz,
      )}
    >
      {group}
    </span>
  );
}

type Tone = "muted" | "brand" | "warning" | "success" | "danger";
const TONE: Record<Tone, string> = {
  muted: "bg-white/5 text-onyx-200",
  brand: "bg-crimson-600/12 text-crimson-400",
  warning: "bg-plasma-500/15 text-plasma-400",
  success: "bg-saline-500/15 text-saline-400",
  danger: "bg-crimson-700/15 text-crimson-300",
};

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", TONE[tone])}>
      {children}
    </span>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/8 bg-surface px-6 py-14 text-center">
      {icon ? <div className="text-onyx-400">{icon}</div> : null}
      <p className="text-lg font-bold text-bone-50">{title}</p>
      {body ? <p className="max-w-sm text-sm text-onyx-200">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

// ── PageHeader ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-bone-50 sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-onyx-200">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
