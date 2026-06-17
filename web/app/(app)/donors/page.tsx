"use client";

import Link from "next/link";
import { Users, MapPinOff } from "lucide-react";
import { useNearbyDonors } from "@/lib/queries";
import { useGeolocation } from "@/lib/use-geolocation";
import { formatDistance } from "@/lib/geo";
import type { UserProfile } from "@/lib/types";
import { ReputationBadge } from "@/components/reputation-badge";
import { PageHeader, Skeleton, EmptyState, BloodGroupBadge } from "@/components/ui";

type NearbyDonor = UserProfile & { distanceKm?: number };

export default function DonorsPage() {
  const { coords, denied } = useGeolocation();
  const { data, isLoading } = useNearbyDonors(
    coords ? { lat: coords.latitude, lon: coords.longitude, radiusKm: 50 } : null,
  );
  const donors = (data?.donors ?? []) as NearbyDonor[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Donors near you" subtitle="Verified, available donors in your area." />

      {!coords && denied ? (
        <EmptyState
          icon={<MapPinOff size={40} />}
          title="Location is off"
          body="Turn on location so we can find donors near you."
        />
      ) : !coords || isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : donors.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title="No donors found nearby" body="Try again later, or widen the search as the network grows." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {donors.map((d) => (
            <Link
              key={d.id}
              href={`/donor/${d.id}`}
              className="block rounded-3xl border border-white/8 bg-surface p-5 transition-colors hover:border-crimson-500/30"
            >
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-crimson-600/12 font-bold text-crimson-400">
                  {d.full_name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-bone-50">{d.full_name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <ReputationBadge totalDonations={d.total_donations ?? 0} verified={d.is_verified} size="sm" />
                    {d.distanceKm != null ? <span className="text-xs text-onyx-300">{formatDistance(d.distanceKm)} away</span> : null}
                  </div>
                </div>
                <BloodGroupBadge group={d.blood_group} size="md" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
