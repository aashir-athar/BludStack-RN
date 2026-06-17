import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4 text-center">
      <BrandMark size={56} />
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-bone-50">Page not found</h1>
      <p className="mt-3 max-w-sm text-onyx-200">
        The page you are looking for moved, or never existed. Let us get you back.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-crimson-600 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-crimson-500"
      >
        Back to home
      </Link>
    </main>
  );
}
