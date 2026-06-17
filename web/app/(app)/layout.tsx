"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Home, Users, ClipboardList, History, User, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Wordmark } from "@/components/brand-mark";
import { Skeleton, cn } from "@/components/ui";

type Tab = { href: string; label: string; icon: LucideIcon; recipientOnly?: boolean; donorOnly?: boolean };
const TABS: Tab[] = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/donors", label: "Donors", icon: Users },
  { href: "/my-requests", label: "Requests", icon: ClipboardList },
  { href: "/history", label: "History", icon: History, donorOnly: true },
  { href: "/profile", label: "Profile", icon: User },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading, session, onboarded, isDonor, isRecipient } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/signin");
    else if (!onboarded) router.replace("/onboarding");
  }, [loading, session, onboarded, router]);

  if (loading || !session || !onboarded) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-24">
        <Skeleton className="h-10 w-48" />
        <div className="mt-6 flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  const tabs = TABS.filter((t) => (t.donorOnly ? isDonor : true)).filter((t) =>
    t.recipientOnly ? isRecipient : true,
  );

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-onyx-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/feed" aria-label="BludStack home">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive(t.href) ? "bg-crimson-600/15 text-crimson-300" : "text-onyx-200 hover:bg-white/5 hover:text-bone-50",
                )}
              >
                <t.icon size={17} /> {t.label}
              </Link>
            ))}
          </nav>
          {isRecipient ? (
            <Link
              href="/post"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-crimson-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-crimson-500"
            >
              <Plus size={17} /> <span className="hidden sm:inline">Post request</span>
            </Link>
          ) : null}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-10">{children}</main>

      {/* Bottom tabs (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-onyx-950/90 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium transition-colors",
                isActive(t.href) ? "text-crimson-400" : "text-onyx-300",
              )}
            >
              <t.icon size={21} />
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
