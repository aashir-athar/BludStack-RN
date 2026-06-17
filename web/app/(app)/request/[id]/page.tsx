"use client";

// Lever: reciprocity + loss aversion. A donor sees a real person who needs them
// now; an owner sees exactly who has stepped up.
import { use } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Droplet, ArrowLeft, Navigation, MessageSquare } from "lucide-react";
import { useRequest, useAcceptRequest, useDeclineRequest, useCancelRequest } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { URGENCY_CONFIG, DONOR_FOR_RECIPIENT, type BloodGroup } from "@/lib/blood-data";
import { Button, Card, Badge, Skeleton, EmptyState, BloodGroupBadge, LinkButton } from "@/components/ui";

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { user, profile } = useAuth();
  const { data: request, isLoading } = useRequest(id);
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();
  const cancel = useCancelRequest();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!request) {
    return (
      <EmptyState
        title="Request not found"
        body="It may have been fulfilled, cancelled, or expired."
        action={<LinkButton href="/feed">Back to feed</LinkButton>}
      />
    );
  }

  const isOwner = request.recipient_id === user?.id;
  const urgency = URGENCY_CONFIG[request.urgency];
  const closed = request.status !== "active";
  const myGroup = profile?.blood_group as BloodGroup | undefined;
  const compatible = myGroup ? (DONOR_FOR_RECIPIENT[request.blood_group] ?? []).includes(myGroup) : false;

  const onAccept = async () => {
    try {
      await accept.mutateAsync(request.id);
      toast.success("You accepted", { description: "Share your live location so they can see you coming." });
      router.push(`/map/${request.id}?role=donor`);
    } catch (e) {
      toast.error("Could not accept", { description: e instanceof Error ? e.message : "Try again." });
    }
  };

  const onDecline = async () => {
    try {
      await decline.mutateAsync(request.id);
      toast.info("Declined", { description: "No problem. Someone else can step in." });
      router.push("/feed");
    } catch (e) {
      toast.error("Could not decline", { description: e instanceof Error ? e.message : "Try again." });
    }
  };

  const onCancel = async () => {
    if (!window.confirm("Cancel this request? Donors who accepted will be notified.")) return;
    try {
      await cancel.mutateAsync(request.id);
      toast.success("Request cancelled");
      router.push("/my-requests");
    } catch (e) {
      toast.error("Could not cancel", { description: e instanceof Error ? e.message : "Try again." });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => router.back()} className="inline-flex w-fit items-center gap-1.5 text-sm text-onyx-200 hover:text-bone-50">
        <ArrowLeft size={16} /> Back
      </button>

      <Card>
        <div className="flex items-start gap-4">
          <BloodGroupBadge group={request.blood_group} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={urgency.tone}>{urgency.label}</Badge>
              {closed ? <Badge tone="muted">{request.status}</Badge> : null}
            </div>
            <h1 className="mt-2 text-xl font-extrabold text-bone-50">{request.hospital_name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-onyx-200">
              <MapPin size={15} className="text-onyx-400" />
              {request.hospital_address}
            </p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-onyx-100">
              <Droplet size={15} className="text-crimson-400" />
              {request.units_needed} {request.units_needed === 1 ? "unit" : "units"} needed
            </p>
          </div>
        </div>
        {request.notes ? (
          <p className="mt-4 rounded-2xl bg-onyx-900 p-4 text-sm leading-relaxed text-onyx-100">{request.notes}</p>
        ) : null}
      </Card>

      {closed ? (
        <Card>
          <p className="text-sm text-onyx-200">This request is {request.status}. Thank you for caring.</p>
        </Card>
      ) : isOwner ? (
        <div className="flex flex-col gap-3">
          <LinkButton href={`/map/${request.id}?role=recipient`} fullWidth>
            <Navigation size={18} /> Track donors live
          </LinkButton>
          <Button variant="danger" fullWidth onClick={onCancel} loading={cancel.isPending}>
            Cancel request
          </Button>
        </div>
      ) : compatible ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-onyx-200">
            You are {profile?.blood_group} and can give to {request.blood_group}. Someone is counting on it.
          </p>
          <Button size="lg" fullWidth onClick={onAccept} loading={accept.isPending}>
            Accept and donate
          </Button>
          <Button variant="ghost" fullWidth onClick={onDecline} loading={decline.isPending}>
            Not this time
          </Button>
          <LinkButton
            href={`/chat/${request.id}?with=${request.recipient_id}`}
            variant="secondary"
            fullWidth
          >
            <MessageSquare size={17} /> Message the recipient
          </LinkButton>
        </div>
      ) : (
        <Card>
          <p className="text-sm text-onyx-200">
            Your blood group {profile?.blood_group ? `(${profile.blood_group})` : ""} is not compatible with this
            request. You can still share it with someone who can help.
          </p>
        </Card>
      )}
    </div>
  );
}
