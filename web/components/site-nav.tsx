"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./brand-mark";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#compatibility", label: "Compatibility" },
  { href: "#reputation", label: "Reputation" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-onyx-950/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#top" aria-label="BludStack home" className="shrink-0">
          <Wordmark />
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-onyx-200 transition-colors hover:bg-white/5 hover:text-bone-50"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/signin"
            className="hidden rounded-full bg-crimson-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-crimson-600/20 transition-transform hover:bg-crimson-500 active:scale-[0.97] sm:inline-flex"
          >
            Get the app
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-11 items-center justify-center rounded-full text-bone-50 transition-colors hover:bg-white/5 md:hidden"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-white/5 bg-onyx-950/95 px-4 pb-6 pt-2 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-base font-medium text-onyx-100 transition-colors hover:bg-white/5"
              >
                {l.label}
              </a>
            ))}
            <a
              href="/signin"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-crimson-600 px-5 py-3.5 text-base font-semibold text-white active:scale-[0.98]"
            >
              Get the app
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
