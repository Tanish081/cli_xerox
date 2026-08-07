"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Order, OrderItem } from "@/lib/types";

const STEPS: { status: string; label: string }[] = [
  { status: "pending_payment", label: "Awaiting payment" },
  { status: "pending_review", label: "Payment submitted, awaiting review" },
  { status: "token_assigned", label: "Approved — token assigned" },
  { status: "ready", label: "Ready for pickup" },
  { status: "completed", label: "Completed" },
];

type OrderResponse = Order & {
  order_items: OrderItem[];
  document_signed_url: string | null;
  payment_screenshot_signed_url: string | null;
};

function OrderTracker() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("id") ?? "";

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [utr, setUtr] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderNumber) return;
    try {
      const res = await fetch(`/api/orders/${orderNumber}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not load order");
        return;
      }
      setError(null);
      setOrder(data.order);
    } catch {
      setError("Could not load order");
    }
  }, [orderNumber]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial poll on mount is intentional
    load();
    const interval = setInterval(load, 18000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleResubmit(e: React.FormEvent) {
    e.preventDefault();
    setResubmitError(null);
    if (!screenshot || utr.trim().length < 4) {
      setResubmitError("Upload a screenshot and enter the UTR.");
      return;
    }
    setResubmitting(true);
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
        setResubmitError(data.error ?? "Could not resubmit payment proof.");
        return;
      }
      setScreenshot(null);
      setUtr("");
      load();
    } catch {
      setResubmitError("Something went wrong. Please try again.");
    } finally {
      setResubmitting(false);
    }
  }

  if (!orderNumber) return <p className="text-sm text-red-600">Missing order id.</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!order) return <p className="text-sm text-neutral-500">Loading…</p>;

  const currentStepIndex =
    order.status === "rejected"
      ? STEPS.findIndex((s) => s.status === "pending_review")
      : STEPS.findIndex((s) => s.status === order.status);

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Order {order.order_number}</h1>
      <p className="mt-1 text-sm text-neutral-500">₹{order.total_amount.toFixed(2)}</p>

      {order.status === "rejected" && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
          Your payment proof was rejected. Please double-check the screenshot and UTR, then resubmit below.
        </div>
      )}

      <ol className="mt-8 space-y-4">
        {STEPS.map((step, i) => (
          <li key={step.status} className="flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${
                i <= currentStepIndex ? "bg-green-600" : "bg-neutral-300 dark:bg-neutral-700"
              }`}
            />
            <span className={i <= currentStepIndex ? "font-medium" : "text-neutral-500"}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      {order.token_number && (
        <p className="mt-6 text-lg">
          Token number: <span className="font-semibold">{order.token_number}</span>
        </p>
      )}
      {order.estimated_ready_at && order.status !== "completed" && (
        <p className="text-sm text-neutral-500">
          Estimated ready: {new Date(order.estimated_ready_at).toLocaleString()}
        </p>
      )}

      {order.status === "rejected" && (
        <form onSubmit={handleResubmit} className="mt-8 space-y-4 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h2 className="font-medium">Resubmit payment proof</h2>
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
          {resubmitError && <p className="text-sm text-red-600">{resubmitError}</p>}
          <button
            type="submit"
            disabled={resubmitting}
            className="rounded-md bg-neutral-900 px-5 py-2.5 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {resubmitting ? "Submitting…" : "Resubmit"}
          </button>
        </form>
      )}
    </main>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense>
      <OrderTracker />
    </Suspense>
  );
}
