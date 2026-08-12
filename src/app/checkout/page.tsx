"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, ErrorText, PageShell } from "@/components/ui";

type QrInfo = { qr_image_url: string | null; amount: number; shop_name: string; payment_deadline: string };

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "0:00";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("id") ?? "";

  const [qr, setQr] = useState<QrInfo | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState<string | null>(null);

  useEffect(() => {
    if (!orderNumber) return;
    fetch(`/api/orders/${orderNumber}/qr`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load payment QR");
        setQr(data);
      })
      .catch((e) => setQrError(e.message));
  }, [orderNumber]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const msRemaining = qr ? new Date(qr.payment_deadline).getTime() - now : null;
  const expired = msRemaining !== null && msRemaining <= 0;
  const effectiveCancelReason = cancelled ?? (expired ? "expired" : null);

  useEffect(() => {
    if (!effectiveCancelReason) return;
    const timeout = setTimeout(() => {
      router.push(`/order/new?payment_failed=${effectiveCancelReason}`);
    }, 2500);
    return () => clearTimeout(timeout);
  }, [effectiveCancelReason, router]);

  const countdownLabel = useMemo(() => (msRemaining !== null ? formatCountdown(msRemaining) : null), [msRemaining]);
  const urgent = msRemaining !== null && msRemaining < 2 * 60 * 1000;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!screenshot) {
      setFormError("Upload a screenshot of the payment.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("screenshot", screenshot);
      const res = await fetch(`/api/orders/${orderNumber}/payment-proof`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCancelled(data.reason ?? "verification_failed");
        return;
      }
      router.push(`/order?id=${orderNumber}`);
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!orderNumber) {
    return (
      <PageShell>
        <ErrorText>Missing order.</ErrorText>
      </PageShell>
    );
  }

  if (effectiveCancelReason) {
    return (
      <PageShell>
        <Card className="animate-fade-in p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
          <h1 className="mt-4 text-xl font-bold text-neutral-900 dark:text-white">Order cancelled</h1>
          <p className="mt-2 text-sm text-neutral-500">
            {effectiveCancelReason === "expired"
              ? "The 10-minute payment window for this order expired."
              : "We couldn't verify your payment from the screenshot you uploaded."}
          </p>
          <p className="mt-3 text-xs text-neutral-400">Redirecting you to start a new order…</p>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Pay for order {orderNumber}
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Scan the shop&apos;s QR with any UPI app, then upload a screenshot of the payment below.
        </p>
      </div>

      {countdownLabel && (
        <div
          className={`mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold animate-fade-in ${
            urgent
              ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
          </svg>
          {countdownLabel} remaining to upload proof
        </div>
      )}

      <Card className="mt-5 flex flex-col items-center p-6 animate-fade-in" style={{ animationDelay: "60ms" }}>
        {qrError && <ErrorText>{qrError}</ErrorText>}
        {qr && (
          <>
            {qr.qr_image_url && (
              <div className="rounded-2xl border-4 border-white bg-white p-2 shadow-lg dark:border-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, not an optimizable static asset */}
                <img
                  src={qr.qr_image_url}
                  alt={`${qr.shop_name} UPI QR code`}
                  className="h-56 w-56 rounded-lg object-contain"
                />
              </div>
            )}
            <p className="mt-4 text-3xl font-bold text-neutral-900 dark:text-white">₹{qr.amount.toFixed(2)}</p>
            <p className="text-sm text-neutral-500">Pay to {qr.shop_name}</p>
          </>
        )}
        {!qr && !qrError && (
          <div className="flex h-56 w-56 items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          </div>
        )}
      </Card>

      <Card className="mt-5 p-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Payment screenshot</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500"
            />
            <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs leading-relaxed text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
              We automatically read the amount, transaction ID, and time from your screenshot — no need to type
              anything. <strong>Important:</strong> after paying, open the payment in your UPI app&apos;s
              history/activity and screenshot the full details page (the one showing &quot;UPI transaction
              ID&quot;) — not the quick &quot;Payment successful&quot; confirmation.
            </p>
          </div>
          <ErrorText>{formError}</ErrorText>
          <Button type="submit" disabled={submitting || expired} className="w-full">
            {submitting ? "Verifying…" : "Submit payment proof"}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutForm />
    </Suspense>
  );
}
