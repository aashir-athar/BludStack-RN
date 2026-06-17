"use client";

import { History as HistoryIcon, Droplet } from "lucide-react";
import { useDonationHistory } from "@/lib/queries";
import { livesHelped } from "@/lib/reputation";
import { useAuth } from "@/lib/auth";
import { PageHeader, Skeleton, EmptyState, Card, BloodGroupBadge } from "@/components/ui";

type HistoryRow = {
  id?: string;
  request_id?: string;
  blood_group?: string;
  hospital_name?: string;
  completed_at?: string;
  created_at?: string;
};

function fmtDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function HistoryPage() {
  const { profile } = useAuth();
  const { data, isLoading } = useDonationHistory();
  const rows = (data ?? []) as HistoryRow[];
  const donations = profile?.total_donations ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Donation history" subtitle={`${donations} ${donations === 1 ? "donation" : "donations"}, about ${livesHelped(donations)} lives helped.`} />
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon size={40} />}
          title="No donations yet"
          body="Your first completed donation will appear here. It can help up to three people."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <Card key={r.id ?? r.request_id ?? i} className="flex items-center gap-4">
              {r.blood_group ? <BloodGroupBadge group={r.blood_group} size="md" /> : <Droplet className="text-crimson-400" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-bone-50">{r.hospital_name ?? "Donation"}</p>
                <p className="text-xs text-onyx-300">{fmtDate(r.completed_at ?? r.created_at)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
