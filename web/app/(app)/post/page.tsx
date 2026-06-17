"use client";

// Lever: agency + clarity. The recipient places the exact hospital and sees the
// request take shape before they commit it.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus } from "lucide-react";
import { useCreateRequest } from "@/lib/queries";
import { useGeolocation } from "@/lib/use-geolocation";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { requestSchema, type RequestForm } from "@/lib/schemas";
import { BLOOD_GROUPS, URGENCY_LEVELS, URGENCY_CONFIG } from "@/lib/blood-data";
import { Button, Card, Field, Input, Textarea, cn } from "@/components/ui";

const MapView = dynamic(() => import("@/components/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-white/5" />,
});

const DEFAULT = { lat: 31.5204, lng: 74.3587 }; // Lahore

export default function PostRequestPage() {
  const router = useRouter();
  const toast = useToast();
  const { profile, isRecipient } = useAuth();
  const { coords } = useGeolocation();
  const create = useCreateRequest();

  const form = useForm<RequestForm>({
    resolver: zodResolver(requestSchema) as Resolver<RequestForm>,
    defaultValues: {
      blood_group: profile?.blood_group ?? "O+",
      urgency: "urgent",
      units_needed: 1,
      hospital_name: "",
      hospital_address: "",
      latitude: DEFAULT.lat,
      longitude: DEFAULT.lng,
      notes: "",
    },
  });

  // Seed the pin at the user's location once it resolves.
  useEffect(() => {
    if (coords) {
      form.setValue("latitude", coords.latitude);
      form.setValue("longitude", coords.longitude);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  const lat = form.watch("latitude");
  const lng = form.watch("longitude");
  const units = form.watch("units_needed");

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        blood_group: values.blood_group,
        urgency: values.urgency,
        units_needed: values.units_needed,
        hospital_name: values.hospital_name,
        hospital_address: values.hospital_address,
        latitude: values.latitude,
        longitude: values.longitude,
        notes: values.notes?.trim() || undefined,
      });
      toast.success("Request posted", { description: "Nearby donors are being alerted now." });
      router.push("/my-requests");
    } catch (e) {
      toast.error("Could not post the request", { description: e instanceof Error ? e.message : "Try again." });
    }
  });

  if (!isRecipient) {
    return (
      <Card>
        <p className="text-sm text-onyx-200">
          Posting requests is for recipients. Update your role in your profile to ask for blood.
        </p>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-bone-50 sm:text-3xl">Post a request</h1>

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-bone-50">Hospital location</p>
        <p className="text-xs text-onyx-300">Click the map to drop the pin exactly on the hospital.</p>
        <div className="h-64 overflow-hidden rounded-2xl border border-white/8">
          <MapView
            center={{ lat, lng }}
            zoom={13}
            onPick={({ lng: x, lat: y }) => {
              form.setValue("longitude", x);
              form.setValue("latitude", y);
            }}
            className="h-full w-full"
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <Field label="Blood group needed">
          <Controller
            control={form.control}
            name="blood_group"
            render={({ field }) => (
              <div className="grid grid-cols-4 gap-2">
                {BLOOD_GROUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={field.value === g}
                    onClick={() => field.onChange(g)}
                    className={cn(
                      "rounded-xl py-3 text-sm font-black transition-colors",
                      field.value === g ? "bg-crimson-600 text-white" : "border border-white/10 text-bone-50 hover:bg-white/5",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          />
        </Field>

        <Field label="Urgency">
          <Controller
            control={form.control}
            name="urgency"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2">
                {URGENCY_LEVELS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={field.value === u}
                    onClick={() => field.onChange(u)}
                    className={cn(
                      "rounded-xl py-3 text-sm font-semibold capitalize transition-colors",
                      field.value === u ? "bg-crimson-600 text-white" : "border border-white/10 text-bone-50 hover:bg-white/5",
                    )}
                  >
                    {URGENCY_CONFIG[u].label}
                  </button>
                ))}
              </div>
            )}
          />
        </Field>

        <Field label="Units needed" hint={`${units} ${units === 1 ? "donor" : "distinct donors"} will be matched.`}>
          <Controller
            control={form.control}
            name="units_needed"
            render={({ field }) => (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  aria-label="Fewer units"
                  onClick={() => field.onChange(Math.max(1, field.value - 1))}
                  className="flex size-11 items-center justify-center rounded-full border border-white/10 text-bone-50 hover:bg-white/5"
                >
                  <Minus size={18} />
                </button>
                <span className="w-10 text-center text-2xl font-black tabular-nums text-bone-50">{field.value}</span>
                <button
                  type="button"
                  aria-label="More units"
                  onClick={() => field.onChange(Math.min(10, field.value + 1))}
                  className="flex size-11 items-center justify-center rounded-full border border-white/10 text-bone-50 hover:bg-white/5"
                >
                  <Plus size={18} />
                </button>
              </div>
            )}
          />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <Field label="Hospital name" error={form.formState.errors.hospital_name?.message}>
          <Input {...form.register("hospital_name")} placeholder="e.g. Shaukat Khanum" />
        </Field>
        <Field label="Hospital address" error={form.formState.errors.hospital_address?.message}>
          <Input {...form.register("hospital_address")} placeholder="Area, city" />
        </Field>
        <Field label="Notes (optional)" error={form.formState.errors.notes?.message}>
          <Textarea {...form.register("notes")} rows={3} placeholder="Anything a donor should know." />
        </Field>
      </Card>

      <Button type="submit" size="lg" fullWidth loading={create.isPending}>
        {create.isPending ? "Posting..." : "Post request"}
      </Button>
    </form>
  );
}
