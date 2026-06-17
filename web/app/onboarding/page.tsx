"use client";

// Lever: commitment + identity. Choosing a role and confirming eligibility makes
// the user a participant, not a visitor.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { apiRegister } from "@/lib/api";
import { onboardingSchema, type OnboardingForm, type Role } from "@/lib/schemas";
import { BLOOD_GROUPS, GENDER_OPTIONS, MEDICAL_CONDITIONS } from "@/lib/blood-data";
import { computeAge, DONOR_MIN_AGE, DONOR_MAX_AGE } from "@/lib/age";
import { Button, Card, Field, Input, cn } from "@/components/ui";
import { BrandMark } from "@/components/brand-mark";

const ROLES: { value: Role; title: string; body: string }[] = [
  { value: "donor", title: "Donor", body: "I want to give blood and answer requests." },
  { value: "recipient", title: "Recipient", body: "I need to find blood for someone." },
  { value: "both", title: "Both", body: "I want to give and to be able to ask." },
];

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const { session, loading, onboarded, refreshProfile } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/signin");
    else if (onboarded) router.replace("/feed");
  }, [loading, session, onboarded, router]);

  const form = useForm<OnboardingForm>({
    resolver: zodResolver(onboardingSchema) as Resolver<OnboardingForm>,
    defaultValues: {
      role: "donor",
      full_name: "",
      gender: "Prefer not to say",
      date_of_birth: null,
      blood_group: "O+",
      phone: null,
      whatsapp_available: false,
      medical_conditions: [],
      share_medical_history: false,
      is_available_to_donate: true,
    },
  });

  const role = form.watch("role");
  const dob = form.watch("date_of_birth");
  const isDonorLike = role === "donor" || role === "both";
  const age = computeAge(dob);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiRegister({
        full_name: values.full_name,
        blood_group: values.blood_group,
        gender: values.gender,
        date_of_birth: values.date_of_birth,
        phone: values.phone,
        whatsapp_available: values.whatsapp_available,
        medical_conditions: values.medical_conditions,
        share_medical_history: values.share_medical_history,
        is_available_to_donate: values.is_available_to_donate,
        role: values.role,
      });
      await refreshProfile();
      toast.success("You are all set");
      router.replace("/feed");
    } catch (e) {
      toast.error("Could not save your profile", {
        description: e instanceof Error ? e.message : "Try again in a moment.",
      });
    }
  });

  if (loading || !session || onboarded) return null;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandMark size={48} />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-bone-50">Set up your profile</h1>
        <p className="mt-2 text-sm text-onyx-200">A few details so we can match you to the right requests.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        {/* Role */}
        <Card>
          <p className="mb-3 text-sm font-semibold text-bone-50">I am a</p>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <div className="grid gap-3 sm:grid-cols-3">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => field.onChange(r.value)}
                    aria-pressed={field.value === r.value}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-colors",
                      field.value === r.value
                        ? "border-crimson-500/50 bg-crimson-600/10"
                        : "border-white/10 bg-onyx-900 hover:bg-white/5",
                    )}
                  >
                    <p className="text-sm font-bold text-bone-50">{r.title}</p>
                    <p className="mt-1 text-xs text-onyx-300">{r.body}</p>
                  </button>
                ))}
              </div>
            )}
          />
        </Card>

        {/* Identity */}
        <Card className="flex flex-col gap-4">
          <Field label="Full name" error={form.formState.errors.full_name?.message}>
            <Input {...form.register("full_name")} placeholder="Your name" autoComplete="name" />
          </Field>

          <Field label="Gender">
            <Controller
              control={form.control}
              name="gender"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {GENDER_OPTIONS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => field.onChange(g)}
                      aria-pressed={field.value === g}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        field.value === g ? "bg-crimson-600 text-white" : "border border-white/10 text-onyx-100 hover:bg-white/5",
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            />
          </Field>

          <Field
            label="Date of birth"
            error={form.formState.errors.date_of_birth?.message}
            hint={isDonorLike ? `Donors must be ${DONOR_MIN_AGE} to ${DONOR_MAX_AGE}.${age != null ? ` You are ${age}.` : ""}` : undefined}
          >
            <Controller
              control={form.control}
              name="date_of_birth"
              render={({ field }) => (
                <Input type="date" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} />
              )}
            />
          </Field>

          <Field label="Blood group">
            <Controller
              control={form.control}
              name="blood_group"
              render={({ field }) => (
                <div className="grid grid-cols-4 gap-2">
                  {BLOOD_GROUPS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => field.onChange(g)}
                      aria-pressed={field.value === g}
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
        </Card>

        {/* Contact */}
        <Card className="flex flex-col gap-4">
          <Field label="Phone (optional)" error={form.formState.errors.phone?.message}>
            <Controller
              control={form.control}
              name="phone"
              render={({ field }) => (
                <Input
                  type="tel"
                  inputMode="tel"
                  placeholder="+92 300 1234567"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              )}
            />
          </Field>
          <Controller
            control={form.control}
            name="whatsapp_available"
            render={({ field }) => (
              <ToggleRow label="Reachable on WhatsApp" value={field.value} onChange={field.onChange} />
            )}
          />
        </Card>

        {/* Donor-only */}
        {isDonorLike ? (
          <Card className="flex flex-col gap-4">
            <Controller
              control={form.control}
              name="is_available_to_donate"
              render={({ field }) => (
                <ToggleRow label="Available to donate" hint="Show up in nearby donor searches" value={field.value} onChange={field.onChange} />
              )}
            />
            <Field label="Medical conditions (optional)" hint="Helps us keep both sides safe. Shared only after you accept.">
              <Controller
                control={form.control}
                name="medical_conditions"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {MEDICAL_CONDITIONS.map((c) => {
                      const on = field.value.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={on}
                          onClick={() => field.onChange(on ? field.value.filter((x) => x !== c) : [...field.value, c])}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                            on ? "bg-crimson-600/20 text-crimson-300" : "border border-white/10 text-onyx-200 hover:bg-white/5",
                          )}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </Field>
            <Controller
              control={form.control}
              name="share_medical_history"
              render={({ field }) => (
                <ToggleRow label="Share medical history once matched" value={field.value} onChange={field.onChange} />
              )}
            />
          </Card>
        ) : null}

        <Button type="submit" size="lg" fullWidth loading={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Finish and continue"}
        </Button>
      </form>
    </main>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-bone-50">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-onyx-300">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          value ? "bg-crimson-600" : "bg-white/10",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-white transition-all",
            value ? "left-6" : "left-1",
          )}
        />
      </button>
    </div>
  );
}
