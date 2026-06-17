import Link from "next/link";
import {
  Radio,
  HeartHandshake,
  Lock,
  MapPinned,
  BellRing,
  Layers,
  Map,
  Moon,
  Droplet,
  Award,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

function SectionHeading({
  eyebrow,
  title,
  blurb,
}: {
  eyebrow: string;
  title: React.ReactNode;
  blurb?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson-400">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-[clamp(1.75rem,4.5vw,2.75rem)] font-extrabold tracking-tight text-bone-50">
        {title}
      </h2>
      {blurb ? <p className="mt-4 text-pretty text-base leading-relaxed text-onyx-200 sm:text-lg">{blurb}</p> : null}
    </div>
  );
}

// ── How it works ─────────────────────────────────────────────────────────────
const STEPS = [
  { icon: Droplet, title: "Post a request", body: "Pin the hospital, pick the blood type and units. It takes seconds." },
  { icon: Radio, title: "Alerts ring outward", body: "Compatible, eligible donors are paged in widening rings until enough accept." },
  { icon: HeartHandshake, title: "A donor accepts", body: "You are matched with real people nearby, not a group-chat forward." },
  { icon: MapPinned, title: "Track them live", body: "Watch the donor move toward the hospital on a live map, in real time." },
];

const RINGS = ["1 km", "5 km", "15 km", "30 km", "50 km", "Country"];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="How it works"
          title="Four steps from request to rescue"
          blurb="The bottleneck in an emergency is not blood. It is the time it takes to find a compatible donor nearby. BludStack closes that gap."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="rounded-3xl border border-white/8 bg-surface p-6 transition-colors hover:border-crimson-500/30"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-crimson-600/12 text-crimson-400">
                  <s.icon size={22} />
                </span>
                <span className="font-mono text-sm text-onyx-400">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-bold text-bone-50">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-onyx-200">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-white/8 bg-surface p-6 sm:p-8">
          <p className="text-sm font-semibold text-bone-50">Geo-fence escalation</p>
          <p className="mt-1 text-sm text-onyx-200">
            No accept at one ring? The search widens automatically, paging only people who can actually help.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 sm:gap-3">
            {RINGS.map((r, i) => (
              <span key={r} className="inline-flex items-center gap-2 sm:gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                    i === RINGS.length - 1
                      ? "bg-crimson-600 text-white"
                      : "border border-white/10 bg-white/5 text-onyx-100"
                  }`}
                >
                  {r}
                </span>
                {i < RINGS.length - 1 ? <span aria-hidden className="text-onyx-500">&rarr;</span> : null}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Features (bento) ─────────────────────────────────────────────────────────
type Feature = { icon: LucideIcon; title: string; body: string; span?: string };
const FEATURES: Feature[] = [
  { icon: BellRing, title: "Real-time push that wakes a killed app", body: "Alerts reach donors even when the app is closed, with a high-priority emergency channel that bypasses silent mode.", span: "lg:col-span-2" },
  { icon: Layers, title: "N units = N donors", body: "A five-unit request needs five distinct donors. Capacity, cooldown, and age are enforced atomically in the database." },
  { icon: Lock, title: "Private by default", body: "Row-level security on every table. A recipient's phone is never exposed until a donor commits." },
  { icon: Map, title: "Free maps, no API key", body: "MapLibre over OpenStreetMap and CARTO tiles. No Google dependency, no metered key, no cost.", span: "lg:col-span-2" },
  { icon: Award, title: "Donor reputation", body: "Completed donations earn tiers from Lifesaver to Legend, with a verified badge for trusted donors." },
  { icon: Moon, title: "Dark and light, done right", body: "A warm, calm theme that respects the system and meets WCAG AA contrast in both modes." },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Features"
          title="Built like a product people trust with a life"
          blurb="Senior engineering under a calm surface: atomic transactions, strict privacy, and a design language carried across every screen."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`rounded-3xl border border-white/8 bg-surface p-6 transition-colors hover:border-crimson-500/30 sm:p-7 ${f.span ?? ""}`}
            >
              <span className="flex size-11 items-center justify-center rounded-2xl bg-crimson-600/12 text-crimson-400">
                <f.icon size={22} />
              </span>
              <h3 className="mt-5 text-lg font-bold text-bone-50">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-onyx-200">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Compatibility ────────────────────────────────────────────────────────────
const COMPAT: { group: string; from: string[]; universal?: "donor" | "recipient" }[] = [
  { group: "O-", from: ["O-"], universal: "donor" },
  { group: "O+", from: ["O-", "O+"] },
  { group: "A-", from: ["O-", "A-"] },
  { group: "A+", from: ["O-", "O+", "A-", "A+"] },
  { group: "B-", from: ["O-", "B-"] },
  { group: "B+", from: ["O-", "O+", "B-", "B+"] },
  { group: "AB-", from: ["O-", "A-", "B-", "AB-"] },
  { group: "AB+", from: ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"], universal: "recipient" },
];

function Compatibility() {
  return (
    <section id="compatibility" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Compatibility"
          title="The matching rule that must never be wrong"
          blurb="BludStack only pages donors who can actually give to the recipient. The matrix below is the ground truth, enforced on the server and in the client."
        />
        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          {COMPAT.map((c) => (
            <div
              key={c.group}
              className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-surface p-5 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex shrink-0 items-center gap-2">
                <span className="flex size-12 items-center justify-center rounded-full bg-crimson-600 text-base font-black text-white">
                  {c.group}
                </span>
                {c.universal ? (
                  <span className="rounded-full bg-saline-500/15 px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-saline-400">
                    {c.universal === "donor" ? "Universal donor" : "Universal recipient"}
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 sm:border-l sm:border-white/8 sm:pl-4">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-onyx-400">Can receive from</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {c.from.map((g) => (
                    <span key={g} className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-xs text-onyx-100">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Reputation ───────────────────────────────────────────────────────────────
const TIERS = [
  { label: "New donor", at: "0", tone: "text-onyx-300 border-white/10" },
  { label: "Lifesaver", at: "1", tone: "text-crimson-400 border-crimson-500/25" },
  { label: "Regular", at: "3", tone: "text-crimson-400 border-crimson-500/25" },
  { label: "Champion", at: "10", tone: "text-plasma-400 border-plasma-500/25" },
  { label: "Guardian", at: "25", tone: "text-saline-400 border-saline-500/25" },
  { label: "Legend", at: "50", tone: "text-saline-400 border-saline-500/25" },
];

function Reputation() {
  return (
    <section id="reputation" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Reputation"
          title="Showing up, recognized"
          blurb="Every completed donation moves a donor up a tier. A verified badge marks the most trusted donors, and reliability is weighted into who gets paged first."
        />
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TIERS.map((t) => (
            <div key={t.label} className={`rounded-2xl border bg-surface p-5 text-center ${t.tone}`}>
              <Award size={26} className="mx-auto" />
              <p className="mt-3 text-sm font-bold text-bone-50">{t.label}</p>
              <p className="mt-1 font-mono text-xs text-onyx-300">{t.at}+ donations</p>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 text-sm text-onyx-200">
          <ShieldCheck size={18} className="text-saline-400" />
          Verified donors are checked once and trusted thereafter.
        </div>
      </div>
    </section>
  );
}

// ── Stats band ───────────────────────────────────────────────────────────────
const STATS = [
  { value: "8", label: "blood types matched" },
  { value: "5", label: "geo-fence rings" },
  { value: "3", label: "lives per donation" },
  { value: "0", label: "cost, no ads, no key" },
];

function Stats() {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-3xl border border-white/8 bg-gradient-to-b from-surface to-onyx-950 p-8 sm:p-10">
        <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <dt className="font-mono text-[clamp(2rem,6vw,3rem)] font-black leading-none text-crimson-500">{s.value}</dt>
              <dd className="mt-2 text-sm text-onyx-200">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────────────────────
function CallToAction() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-crimson-500/20 bg-surface px-6 py-14 text-center sm:px-12 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(212,24,61,0.18), transparent 70%)" }}
        />
        <h2 className="text-balance text-[clamp(1.75rem,5vw,3rem)] font-black tracking-tight text-bone-50">
          Be the reason someone makes it.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-onyx-200 sm:text-lg">
          Join as a donor, a recipient, or both. It is free, it always will be, and
          the next request could be one you answer.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signin"
            className="inline-flex w-full items-center justify-center rounded-full bg-crimson-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-crimson-600/25 transition-transform hover:bg-crimson-500 active:scale-[0.98] sm:w-auto"
          >
            Get the app
          </Link>
          <a
            href="https://github.com/aashir-athar/BludStack"
            className="inline-flex w-full items-center justify-center rounded-full border border-white/12 bg-white/5 px-8 py-4 text-base font-semibold text-bone-50 transition-colors hover:bg-white/10 sm:w-auto"
          >
            View the source
          </a>
        </div>
      </div>
    </section>
  );
}

export function MarketingSections() {
  return (
    <>
      <HowItWorks />
      <Features />
      <Stats />
      <Compatibility />
      <Reputation />
      <CallToAction />
    </>
  );
}
