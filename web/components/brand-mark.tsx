// The BludStack blood-drop glyph, ported 1:1 from the app's BrandMark SVG path so
// the logo is identical across web and mobile.
type BrandMarkProps = {
  size?: number;
  className?: string;
  variant?: "solid" | "outline";
};

export function BrandMark({ size = 28, className, variant = "solid" }: BrandMarkProps) {
  const solid = variant === "solid";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="BludStack"
      className={className}
    >
      <path
        d="M12 2.4 c-1.2 2.2 -3.6 5.6 -5.5 8.4 -1.5 2.2 -2.5 4.5 -2.5 6.4 0 4.5 3.6 8.0 8.0 8.0 4.4 0 8.0 -3.5 8.0 -8.0 0 -1.9 -1.0 -4.2 -2.5 -6.4 -1.9 -2.8 -4.3 -6.2 -5.5 -8.4 z"
        fill={solid ? "currentColor" : "none"}
        stroke={solid ? "none" : "currentColor"}
        strokeWidth={solid ? 0 : 1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <BrandMark size={26} className="text-crimson-500" />
      <span className="text-[1.15rem] font-extrabold tracking-tight text-bone-50">
        Blud<span className="text-crimson-500">Stack</span>
      </span>
    </span>
  );
}
