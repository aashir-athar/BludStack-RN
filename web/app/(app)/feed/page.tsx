"use client";

// Lever: social proof + urgency. Real requests, nearest first, so a donor sees
// a need they can actually answer right now.
import { Droplet, MapPinOff } from "lucide-react";
import { useRequests } from "@/lib/queries";
import { useGeolocation } from "@/lib/use-geolocation";
import { useAuth } from "@/lib/auth";
import { RequestCard } from "@/components/request-card";
import { PageHeader, Skeleton, EmptyState, LinkButton, Badge } from "@/components/ui";

export default function FeedPage() {
  const { coords, denied } = useGeolocation();
  const { isDonor, profile } = useAuth();
  const { data, isLoading, isError, refetch } = useRequests(
    coords ? { lat: coords.latitude, lon: coords.longitude, radiusKm: 50 } : {},
  );

  const requests = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Requests near you"
        subtitle={
          isDonor
            ? `Active needs you may be able to answer${profile?.blood_group ? ` as ${profile.blood_group}` : ""}.`
            : "Active blood requests in the community."
        }
        action={coords ? <Badge tone="success">Located</Badge> : denied ? <Badge tone="warning">Location off</Badge> : null}
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<MapPinOff size={40} />}
          title="We could not load requests"
          body="Check your connection and try again."
          action={
            <button
              onClick={() => refetch()}
              className="rounded-full bg-crimson-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-crimson-500"
            >
              Retry
            </button>
          }
        />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<Droplet size={40} />}
          title="No active requests right now"
          body="That is good news. When someone nearby needs blood, it will show up here."
          action={<LinkButton href="/post">Post a request</LinkButton>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>
      )}
    </div>
  );
}
