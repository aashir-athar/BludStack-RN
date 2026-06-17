"use client";

import { ClipboardList } from "lucide-react";
import { useMyRequests } from "@/lib/queries";
import { RequestCard } from "@/components/request-card";
import { PageHeader, Skeleton, EmptyState, LinkButton } from "@/components/ui";

export default function MyRequestsPage() {
  const { data, isLoading } = useMyRequests();
  const requests = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Your requests" subtitle="Everything you have posted, newest first." action={<LinkButton href="/post" size="sm">New request</LinkButton>} />
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={40} />}
          title="No requests yet"
          body="When you post a request, it shows up here so you can track who has stepped up."
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
