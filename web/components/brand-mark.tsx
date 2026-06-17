import Image from "next/image";

// The BludStack logo - the actual 3D blood-drop mark from the app
// (mobile/assets/images/splash-icon.png), transparent PNG, crisp at any size.
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="BludStack"
      width={size}
      height={size}
      priority
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <BrandMark size={30} />
      <span className="text-[1.15rem] font-extrabold tracking-tight text-bone-50">
        Blud<span className="text-crimson-500">Stack</span>
      </span>
    </span>
  );
}
