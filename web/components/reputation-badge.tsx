import { Award, ShieldCheck } from "lucide-react";
import { getReputationTier, type ReputationTone } from "@/lib/reputation";
import { cn } from "./ui";

const TONE: Record<ReputationTone, string> = {
  muted: "bg-white/5 text-onyx-200",
  brand: "bg-crimson-600/12 text-crimson-400",
  warning: "bg-plasma-500/15 text-plasma-400",
  success: "bg-saline-500/15 text-saline-400",
};

export function ReputationBadge({
  totalDonations,
  verified = false,
  size = "md",
}: {
  totalDonations: number;
  verified?: boolean;
  size?: "sm" | "md";
}) {
  const tier = getReputationTier(totalDonations);
  const iconSize = size === "sm" ? 13 : 15;
  return (
    <span
      aria-label={`${tier.label} tier${verified ? ", verified donor" : ""}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        TONE[tier.tone],
      )}
    >
      <Award size={iconSize} />
      {tier.label}
      {verified ? <ShieldCheck size={iconSize} className="text-saline-400" /> : null}
    </span>
  );
}
