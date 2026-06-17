import { Wordmark } from "./brand-mark";

// lucide removed brand glyphs (trademark), so the social marks are inline SVG.
function GithubIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z" />
    </svg>
  );
}
function LinkedinIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#compatibility", label: "Compatibility" },
  { href: "#reputation", label: "Reputation" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-4 text-sm leading-relaxed text-onyx-300">
              Every drop counts. Every second matters. A free, real-time blood
              donation network, built for everyone, anywhere.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Footer">
            {NAV.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-onyx-200 transition-colors hover:text-bone-50">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex gap-3">
            <a
              href="https://github.com/aashir-athar/BludStack"
              aria-label="GitHub"
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/10 text-onyx-100 transition-colors hover:bg-white/5 hover:text-bone-50"
            >
              <GithubIcon size={20} />
            </a>
            <a
              href="https://www.linkedin.com/in/aashir-athar"
              aria-label="LinkedIn"
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/10 text-onyx-100 transition-colors hover:bg-white/5 hover:text-bone-50"
            >
              <LinkedinIcon size={20} />
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/8 pt-6 text-xs text-onyx-400 sm:flex-row sm:items-center sm:justify-between">
          <p>Built in Lahore. For everyone, anywhere.</p>
          <p>MIT licensed. Free forever.</p>
        </div>
      </div>
    </footer>
  );
}
