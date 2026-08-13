"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, ErrorText, inputClass, PageShell } from "@/components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Read the credentials off the form rather than from React state: a
  // browser/password-manager autofill writes straight to the input's DOM
  // value without firing the change event React listens for, so state-backed
  // fields stay empty while the form visibly shows the credentials -- the
  // sign-in then fails with "missing email or phone" and the button looks
  // like it did nothing on the first click.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/admin");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell maxWidth="max-w-sm">
      <div className="flex min-h-[70vh] flex-col justify-center">
        <div className="animate-fade-in text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/25">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Admin login</h1>
          <p className="mt-1 text-sm text-neutral-500">Sign in to manage orders and shop settings.</p>
        </div>

        <Card className="mt-6 p-6 animate-fade-in" style={{ animationDelay: "60ms" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                defaultValue=""
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                defaultValue=""
                className={inputClass}
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </PageShell>
  );
}
