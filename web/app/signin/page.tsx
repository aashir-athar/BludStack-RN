"use client";

// Lever: low-friction commitment. No password, just an email and a 6-digit code.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { emailSchema, otpSchema, type EmailForm, type OtpForm } from "@/lib/schemas";
import { BrandMark } from "@/components/brand-mark";
import { Button, Field, Input } from "@/components/ui";

export default function SignInPage() {
  const router = useRouter();
  const toast = useToast();
  const { session, onboarded, loading: authLoading } = useAuth();
  const [email, setEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Already signed in? Route onward.
  useEffect(() => {
    if (!authLoading && session) router.replace(onboarded ? "/feed" : "/onboarding");
  }, [authLoading, session, onboarded, router]);

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema) as Resolver<EmailForm>,
    defaultValues: { email: "" },
  });
  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema) as Resolver<OtpForm>,
    defaultValues: { code: "" },
  });

  const onEmail = emailForm.handleSubmit(async ({ email }) => {
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
      setEmail(email);
      toast.success("Code sent", { description: `Check ${email} for your 6-digit code.` });
    } catch (e) {
      toast.error("Could not send the code", {
        description: e instanceof Error ? e.message : "Try again in a moment.",
      });
    } finally {
      setSending(false);
    }
  });

  const onCode = otpForm.handleSubmit(async ({ code }) => {
    if (!email) return;
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      // The auth listener picks up the session and the effect above routes onward.
    } catch (e) {
      toast.error("That code did not work", {
        description: e instanceof Error ? e.message : "Check the code and try again.",
      });
      setVerifying(false);
    }
  });

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark size={56} />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-bone-50">
            {email ? "Enter your code" : "Welcome to BludStack"}
          </h1>
          <p className="mt-2 text-sm text-onyx-200">
            {email ? `We sent a 6-digit code to ${email}.` : "Sign in or create an account with your email."}
          </p>
        </div>

        {email ? (
          <form onSubmit={onCode} className="flex flex-col gap-4">
            <Field label="6-digit code" error={otpForm.formState.errors.code?.message}>
              <Input
                {...otpForm.register("code")}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.5em]"
                autoFocus
              />
            </Field>
            <Button type="submit" size="lg" fullWidth loading={verifying}>
              {verifying ? "Verifying..." : "Verify and continue"}
            </Button>
            <button
              type="button"
              onClick={() => setEmail(null)}
              className="inline-flex items-center justify-center gap-1.5 text-sm text-onyx-300 transition-colors hover:text-bone-50"
            >
              <ArrowLeft size={15} /> Use a different email
            </button>
          </form>
        ) : (
          <form onSubmit={onEmail} className="flex flex-col gap-4">
            <Field label="Email" error={emailForm.formState.errors.email?.message}>
              <Input
                {...emailForm.register("email")}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                autoFocus
              />
            </Field>
            <Button type="submit" size="lg" fullWidth loading={sending}>
              <Mail size={18} /> {sending ? "Sending..." : "Send me a code"}
            </Button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-onyx-400">
          Free forever. No passwords, no ads. By continuing you agree to be a good neighbour.
        </p>
      </div>
    </main>
  );
}
