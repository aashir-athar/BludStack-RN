import Link from "next/link";
import { MapPin, Clock, Droplet } from "lucide-react";
import { URGENCY_CONFIG } from "@/lib/blood-data";
import { formatDistance } from "@/lib/geo";
import type { BloodRequest } from "@/lib/types";
import { BloodGroupBadge, Badge, cn } from "./ui";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function RequestCard({ request }: { request: BloodRequest }) {
  const urgency = URGENCY_CONFIG[request.urgency];
  return (
    <Link
      href={`/request?id=${request.id}`}
      className="block rounded-3xl border border-white/8 bg-surface p-5 transition-colors hover:border-crimson-500/30"
    >
      <div className="flex items-start gap-4">
        <BloodGroupBadge group={request.blood_group} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={urgency.tone}>{urgency.label}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-onyx-300">
              <Clock size={13} /> {timeAgo(request.created_at)}
            </span>
          </div>
          <h3 className="mt-2 truncate text-base font-bold text-bone-50">{request.hospital_name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-onyx-200">
            <MapPin size={14} className="shrink-0 text-onyx-400" />
            {request.hospital_address}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-onyx-200">
            <span className="inline-flex items-center gap-1.5">
              <Droplet size={14} className="text-crimson-400" />
              {request.units_needed} {request.units_needed === 1 ? "unit" : "units"}
            </span>
            {request.distanceKm != null ? (
              <span className={cn("font-medium text-onyx-100")}>{formatDistance(request.distanceKm)} away</span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
