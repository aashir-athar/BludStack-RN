import { MapPin, Bell, ShieldCheck } from "lucide-react";
import { BrandMark } from "./brand-mark";

// The geo-fence escalation visual: concentric rings pulsing outward from a
// crimson drop, with donor pins on the rings. Pure CSS motion, honours
// prefers-reduced-motion (globals.css disables the animation). Scales fluidly.
function GeoRings() {
  return (
    <div
      aria-hidden
      className="relative mx-auto aspect-square w-full max-w-[min(85vw,30rem)]"
    >
      {/* Static ring guides */}
      {[0.4, 0.62, 0.84, 1].map((s, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 rounded-full border border-crimson-500/15"
          style={{
            width: `${s * 100}%`,
            height: `${s * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
      {/* Pulsing rings */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 size-full rounded-full bg-crimson-500/10 [animation:var(--animate-pulse-ring)] motion-reduce:hidden"
          style={{ transform: "translate(-50%, -50%)", animationDelay: `${i * 1.05}s` }}
        />
      ))}
      {/* Donor pins on the rings */}
      {[
        { t: "14%", l: "52%" },
        { t: "40%", l: "12%" },
        { t: "78%", l: "30%" },
        { t: "70%", l: "84%" },
        { t: "30%", l: "82%" },
      ].map((p, i) => (
        <span
          key={i}
          className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-onyx-800 text-saline-400 shadow-lg sm:size-8"
          style={{ top: p.t, left: p.l }}
        >
          <MapPin size={14} />
        </span>
      ))}
      {/* Center: the request, marked by the real logo */}
      <div className="absolute left-1/2 top-1/2 flex size-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-onyx-900/80 shadow-2xl shadow-crimson-600/40 ring-1 ring-crimson-500/30 backdrop-blur [animation:var(--animate-float)] motion-reduce:[animation:none] sm:size-28">
        <BrandMark size={66} />
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32 lg:px-8 lg:pb-32 lg:pt-40"
    >
      {/* Ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 75% 15%, rgba(212,24,61,0.14), transparent 70%), radial-gradient(45% 40% at 10% 80%, rgba(20,192,131,0.07), transparent 70%)",
        }}
      />
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div className="stagger max-w-2xl">
          <span
            style={{ ["--i" as string]: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-onyx-100"
          >
            <span className="size-1.5 rounded-full bg-saline-500" />
            Free forever, no ads
          </span>
          <h1
            style={{ ["--i" as string]: 1 }}
            className="mt-6 text-balance text-[clamp(2.25rem,7vw,4.5rem)] font-black leading-[1.02] tracking-tight text-bone-50"
          >
            The fastest way to find a{" "}
            <span className="text-crimson-500">blood donor</span>.
          </h1>
          <p
            style={{ ["--i" as string]: 2 }}
            className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-onyx-200 sm:text-lg"
          >
            Post a request in seconds. The nearest compatible, eligible donors are
            alerted instantly, ring by ring. When one accepts, you watch them arrive
            live on the map. Like Uber, for the most important ride of someone&apos;s
            life.
          </p>
          <div
            style={{ ["--i" as string]: 3 }}
            id="get-app"
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <a
              href="#get-app"
              className="inline-flex items-center justify-center rounded-full bg-crimson-600 px-7 py-4 text-base font-semibold text-white shadow-xl shadow-crimson-600/25 transition-transform hover:bg-crimson-500 active:scale-[0.98]"
            >
              Get the app
            </a>
            <a
              href="#how"
              className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/5 px-7 py-4 text-base font-semibold text-bone-50 transition-colors hover:bg-white/10"
            >
              See how it works
            </a>
          </div>
          <ul
            style={{ ["--i" as string]: 4 }}
            className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-onyx-200"
          >
            <li className="inline-flex items-center gap-2">
              <Bell size={16} className="text-crimson-400" /> Real-time alerts
            </li>
            <li className="inline-flex items-center gap-2">
              <MapPin size={16} className="text-crimson-400" /> Live donor map
            </li>
            <li className="inline-flex items-center gap-2">
              <ShieldCheck size={16} className="text-crimson-400" /> Private by default
            </li>
          </ul>
        </div>

        <div className="order-first lg:order-last">
          <GeoRings />
        </div>
      </div>
    </section>
  );
}
