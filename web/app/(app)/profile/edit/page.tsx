"use client";

// Lever: ownership. The user shapes how the network sees them and stays eligible.
import { useRouter } from "next/navigation";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { editProfileSchema, type EditProfileForm } from "@/lib/schemas";
import { BLOOD_GROUPS, GENDER_OPTIONS, MEDICAL_CONDITIONS } from "@/lib/blood-data";
import { computeAge, DONOR_MIN_AGE, DONOR_MAX_AGE } from "@/lib/age";
import { Button, Card, Field, Input, cn } from "@/components/ui";

export default function EditProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const { profile, updateProfile } = useAuth();

  const form = useForm<EditProfileForm>({
    resolver: zodResolver(editProfileSchema) as Resolver<EditProfileForm>,
    defaultValues: {
      role: profile?.role ?? "donor",
      full_name: profile?.full_name ?? "",
      gender: (profile?.gender as EditProfileForm["gender"]) ?? "Prefer not to say",
      date_of_birth: profile?.date_of_birth ?? null,
      blood_group: profile?.blood_group ?? "O+",
      phone: profile?.phone ?? null,
      whatsapp_available: profile?.whatsapp_available ?? false,
      medical_conditions: profile?.medical_conditions ?? [],
      share_medical_history: profile?.share_medical_history ?? false,
      is_available_to_donate: profile?.is_available_to_donate ?? true,
    },
  });

  const role = form.watch("role");
  const dob = form.watch("date_of_birth");
  const isDonorLike = role === "donor" || role === "both";
  const age = computeAge(dob);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateProfile({
        full_name: values.full_name,
        gender: values.gender,
        date_of_birth: values.date_of_birth,
        blood_group: values.blood_group,
        phone: values.phone,
        whatsapp_available: values.whatsapp_available,
        medical_conditions: values.medical_conditions,
        share_medical_history: values.share_medical_history,
        is_available_to_donate: values.is_available_to_donate,
        role: values.role,
      });
      toast.success("Profile updated");
      router.push("/profile");
    } catch (e) {
      toast.error("Could not save", { description: e instanceof Error ? e.message : "Try again." });
    }
  });

  if (!profile) return null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <button type="button" onClick={() => router.back()} className="inline-flex w-fit items-center gap-1.5 text-sm text-onyx-200 hover:text-bone-50">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-2xl font-extrabold tracking-tight text-bone-50 sm:text-3xl">Edit profile</h1>

      <Card>
        <p className="mb-3 text-sm font-semibold text-bone-50">Role</p>
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-3">
              {(["donor", "recipient", "both"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={field.value === r}
                  onClick={() => field.onChange(r)}
                  className={cn(
                    "rounded-2xl border py-3 text-sm font-semibold capitalize transition-colors",
                    field.value === r ? "border-crimson-500/50 bg-crimson-600/10 text-bone-50" : "border-white/10 text-onyx-100 hover:bg-white/5",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <Field label="Full name" error={form.formState.errors.full_name?.message}>
          <Input {...form.register("full_name")} autoComplete="name" />
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
                    aria-pressed={field.value === g}
                    onClick={() => field.onChange(g)}
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
      </Card>

      <Card className="flex flex-col gap-4">
        <Field label="Phone" error={form.formState.errors.phone?.message}>
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <Input type="tel" inputMode="tel" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} placeholder="+92 300 1234567" />
            )}
          />
        </Field>
        <Controller
          control={form.control}
          name="whatsapp_available"
          render={({ field }) => <Toggle label="Reachable on WhatsApp" value={field.value} onChange={field.onChange} />}
        />
      </Card>

      {isDonorLike ? (
        <Card className="flex flex-col gap-4">
          <Controller
            control={form.control}
            name="is_available_to_donate"
            render={({ field }) => <Toggle label="Available to donate" value={field.value} onChange={field.onChange} />}
          />
          <Field label="Medical conditions" hint="Shared with a recipient only after you accept.">
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
            render={({ field }) => <Toggle label="Share medical history once matched" value={field.value} onChange={field.onChange} />}
          />
        </Card>
      ) : null}

      <Button type="submit" size="lg" fullWidth loading={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm font-medium text-bone-50">{label}</p>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", value ? "bg-crimson-600" : "bg-white/10")}
      >
        <span className={cn("absolute top-1 size-5 rounded-full bg-white transition-all", value ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}
