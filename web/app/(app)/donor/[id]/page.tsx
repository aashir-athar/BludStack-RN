"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { useProfileById } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { DONOR_FOR_RECIPIENT, type BloodGroup } from "@/lib/blood-data";
import { ReputationBadge } from "@/components/reputation-badge";
import { Card, BloodGroupBadge, Skeleton, EmptyState, LinkButton } from "@/components/ui";

export default function DonorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { profile: me, isRecipient } = useAuth();
  const { data: donor, isLoading } = useProfileById(id);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  if (!donor) {
    return <EmptyState title="Donor not found" action={<LinkButton href="/donors">Back to donors</LinkButton>} />;
  }

  const myGroup = me?.blood_group as BloodGroup | undefined;
  const theirGroup = donor.blood_group as BloodGroup | undefined;
  const compatible =
    myGroup && theirGroup ? (DONOR_FOR_RECIPIENT[myGroup] ?? []).includes(theirGroup) : null;

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => router.back()} className="inline-flex w-fit items-center gap-1.5 text-sm text-onyx-200 hover:text-bone-50">
        <ArrowLeft size={16} /> Back
      </button>

      <Card className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-crimson-600/12 text-2xl font-black text-crimson-400">
          {donor.full_name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
        </div>
        <div>
          <p className="flex items-center justify-center gap-2 text-xl font-extrabold text-bone-50">
            {donor.full_name}
            {donor.is_verified ? <ShieldCheck size={18} className="text-saline-400" /> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <BloodGroupBadge group={donor.blood_group} size="lg" />
          <ReputationBadge totalDonations={donor.total_donations ?? 0} verified={donor.is_verified} />
        </div>
        <div className="grid w-full grid-cols-2 divide-x divide-white/8 border-t border-white/8 pt-4">
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-black tabular-nums text-bone-50">{donor.total_donations ?? 0}</span>
            <span className="text-[0.7rem] uppercase tracking-wide text-onyx-400">Donations</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-black tabular-nums text-bone-50">
              {donor.is_available_to_donate ? "Yes" : "No"}
            </span>
            <span className="text-[0.7rem] uppercase tracking-wide text-onyx-400">Available</span>
          </div>
        </div>
      </Card>

      {isRecipient && compatible !== null ? (
        <Card className={compatible ? "border-saline-500/25 bg-saline-500/10" : "border-plasma-500/25 bg-plasma-500/10"}>
          <p className="flex items-center gap-2 text-sm font-medium text-bone-50">
            {compatible ? <CheckCircle2 size={18} className="text-saline-400" /> : <XCircle size={18} className="text-plasma-400" />}
            {compatible ? "Can donate to your blood group" : "Cannot donate to your blood group"}
          </p>
        </Card>
      ) : null}

      <Card>
        <p className="text-sm text-onyx-200">
          Contact unlocks once this donor accepts one of your requests, so numbers stay private until you are matched.
        </p>
      </Card>
    </div>
  );
}
