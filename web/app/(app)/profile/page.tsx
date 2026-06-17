"use client";

// Lever: control + recognition. The donor sees who they are to the network and
// holds every switch.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { reputationProgress, livesHelped } from "@/lib/reputation";
import { computeAge } from "@/lib/age";
import { MIN_DONATION_GAP_DAYS } from "@/lib/blood-data";
import { ReputationBadge } from "@/components/reputation-badge";
import { Card, BloodGroupBadge, Button, PageHeader, LinkButton } from "@/components/ui";

function cooldownDaysLeft(last: string | null): number {
  if (!last) return 0;
  return Math.max(0, Math.ceil(MIN_DONATION_GAP_DAYS - (Date.now() - new Date(last).getTime()) / 86_400_000));
}

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const { profile, isDonor, updateProfile, signOut } = useAuth();
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const donations = profile.total_donations ?? 0;
  const rep = reputationProgress(donations);
  const cooldown = cooldownDaysLeft(profile.last_donation_date);
  const age = computeAge(profile.date_of_birth);

  const toggleAvailable = async (val: boolean) => {
    setSaving(true);
    try {
      await updateProfile({ is_available_to_donate: val });
    } catch (e) {
      toast.error("Could not update", { description: e instanceof Error ? e.message : "Try again." });
    } finally {
      setSaving(false);
    }
  };

  const onSignOut = async () => {
    await signOut();
    router.replace("/signin");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Your profile" />

      <Card className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-crimson-600/12 text-2xl font-black text-crimson-400">
          {profile.full_name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
        </div>
        <div>
          <p className="text-xl font-extrabold text-bone-50">{profile.full_name}</p>
          {age != null ? <p className="text-sm text-onyx-300">{age} years old</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <BloodGroupBadge group={profile.blood_group} size="sm" />
          {isDonor ? <ReputationBadge totalDonations={donations} verified={profile.is_verified} size="sm" /> : null}
        </div>
      </Card>

      <Card className="grid grid-cols-3 divide-x divide-white/8">
        <Stat value={String(donations)} label="Donations" />
        <Stat value={String(livesHelped(donations))} label="Lives helped" accent />
        <Stat value={String(cooldown)} label="Cooldown days" />
      </Card>

      <LinkButton href="/profile/edit" variant="secondary" fullWidth>
        <Pencil size={16} /> Edit profile
      </LinkButton>

      {isDonor ? (
        <Card className="flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-wider text-onyx-400">Your standing</p>
          <div className="flex items-center justify-between gap-2">
            <ReputationBadge totalDonations={donations} verified={profile.is_verified} />
            {profile.is_verified ? (
              <span className="inline-flex items-center gap-1 text-sm text-saline-400">
                <ShieldCheck size={16} /> Verified donor
              </span>
            ) : null}
          </div>
          <p className="text-sm text-onyx-200">{rep.current.blurb}</p>
          {rep.next ? (
            <div className="flex flex-col gap-2">
              <div className="h-2 overflow-hidden rounded-full bg-white/5" role="progressbar" aria-label={`${rep.remaining} to ${rep.next.label}`}>
                <div className="h-full rounded-full bg-crimson-600" style={{ width: `${Math.round(rep.fraction * 100)}%` }} />
              </div>
              <p className="text-xs text-onyx-300">
                {rep.remaining} more {rep.remaining === 1 ? "donation" : "donations"} to reach {rep.next.label}
              </p>
            </div>
          ) : (
            <p className="text-xs text-saline-400">You have reached the highest tier. Thank you, again and again.</p>
          )}
        </Card>
      ) : null}

      {isDonor ? (
        <Card className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-bone-50">Available to donate</p>
            <p className="mt-0.5 text-xs text-onyx-300">Show up in nearby donor searches</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!profile.is_available_to_donate}
            aria-label="Available to donate"
            disabled={saving}
            onClick={() => toggleAvailable(!profile.is_available_to_donate)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${profile.is_available_to_donate ? "bg-crimson-600" : "bg-white/10"}`}
          >
            <span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${profile.is_available_to_donate ? "left-6" : "left-1"}`} />
          </button>
        </Card>
      ) : null}

      <Button variant="danger" fullWidth onClick={onSignOut}>
        <LogOut size={17} /> Sign out
      </Button>
    </div>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 px-2">
      <span className={`text-2xl font-black tabular-nums ${accent ? "text-crimson-500" : "text-bone-50"}`}>{value}</span>
      <span className="text-[0.7rem] uppercase tracking-wide text-onyx-400">{label}</span>
    </div>
  );
}
