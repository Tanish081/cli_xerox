"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("id") ?? "";

  const [qr, setQr] = useState<{ qr_data_url: string; upi_link: string; amount: number } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!screenshot) {
      setFormError("Upload a screenshot of the payment.");
      return;
    }
    if (utr.trim().length < 4) {
      setFormError("Enter the UTR / transaction reference from your payment app.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("screenshot", screenshot);
      formData.set("utr", utr.trim());
      const res = await fetch(`/api/orders/${orderNumber}/payment-proof`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Could not submit payment proof.");
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
    return <p className="text-sm text-red-600">Missing order.</p>;
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Pay for order {orderNumber}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Scan the QR with any UPI app, then upload proof of payment below.
      </p>

      <div className="mt-6 flex flex-col items-center rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        {qrError && <p className="text-sm text-red-600">{qrError}</p>}
        {qr && (
          <>
            <Image src={qr.qr_data_url} alt="UPI payment QR code" width={240} height={240} unoptimized />
            <p className="mt-3 text-lg font-semibold">₹{qr.amount.toFixed(2)}</p>
            <a href={qr.upi_link} className="mt-2 text-sm text-blue-600 underline">
              Open in UPI app
            </a>
          </>
        )}
        {!qr && !qrError && <p className="text-sm text-neutral-500">Loading QR…</p>}
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium">Payment screenshot</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">UTR / transaction reference</label>
          <input
            type="text"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-neutral-900 px-5 py-2.5 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {submitting ? "Submitting…" : "Submit payment proof"}
        </button>
      </form>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutForm />
    </Suspense>
  );
}
