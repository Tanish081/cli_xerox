"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Order, OrderItem } from "@/lib/types";
import { Button, Card, ErrorText, PageShell } from "@/components/ui";

const STEPS: { status: string; label: string }[] = [
  { status: "pending_payment", label: "Awaiting payment" },
  { status: "token_assigned", label: "Payment verified — token assigned" },
  { status: "ready", label: "Ready for pickup" },
  { status: "completed", label: "Completed" },
];

type OrderResponse = Order & {
  order_items: OrderItem[];
  document_signed_url: string | null;
  payment_screenshot_signed_url: string | null;
};

function OrderTracker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("id") ?? "";

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [load]);

  useEffect(() => {
    if (order?.status === "completed" || order?.status === "rejected") return;
    const interval = setInterval(load, 18000);
    return () => clearInterval(interval);
  }, [load, order?.status]);

  useEffect(() => {
    if (order?.status !== "completed") return;
    const timeout = setTimeout(() => router.push("/"), 4000);
    return () => clearTimeout(timeout);
  }, [order?.status, router]);

  if (!orderNumber) {
    return (
      <PageShell>
        <ErrorText>Missing order id.</ErrorText>
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell>
        <ErrorText>{error}</ErrorText>
      </PageShell>
    );
  }
  if (!order) {
    return (
      <PageShell>
        <div className="flex justify-center py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        </div>
      </PageShell>
    );
  }

  const currentStepIndex = order.status === "rejected" ? 0 : STEPS.findIndex((s) => s.status === order.status);

  return (
    <PageShell maxWidth="max-w-xl">
      <div className="animate-fade-in">
        <p className="text-xs font-semibold tracking-wider text-indigo-600 uppercase dark:text-indigo-400">
          Order status
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {order.order_number}
        </h1>
        <p className="mt-1 text-lg font-medium text-neutral-500">₹{order.total_amount.toFixed(2)}</p>
      </div>

      {order.status === "rejected" && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 animate-fade-in dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          <svg className="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <span>This order was cancelled — we couldn&apos;t verify your payment from the screenshot in time. Please place a new order.</span>
        </div>
      )}

      {order.status === "completed" && (
        <div className="mt-5 animate-fade-in rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Order complete — thanks! Taking you back to the home page…</span>
          </div>
          <Link href="/order/new" className="mt-3 block">
            <Button className="w-full">Place another order</Button>
          </Link>
        </div>
      )}

      <Card className="mt-6 p-6 animate-fade-in" style={{ animationDelay: "60ms" }}>
        <ol className="space-y-6">
          {STEPS.map((step, i) => {
            const done = i < currentStepIndex;
            const active = i === currentStepIndex && order.status !== "rejected";
            return (
              <li key={step.status} className="relative flex items-start gap-4">
                {i < STEPS.length - 1 && (
                  <span
                    className={`absolute top-7 left-3.5 h-full w-0.5 -translate-x-1/2 ${
                      done ? "bg-indigo-500" : "bg-neutral-200 dark:bg-neutral-800"
                    }`}
                  />
                )}
                <span
                  className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-indigo-600 text-white"
                      : active
                        ? "bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950"
                        : "bg-neutral-200 text-neutral-400 dark:bg-neutral-800"
                  }`}
                >
                  {done ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`pt-0.5 text-sm ${
                    done || active
                      ? "font-semibold text-neutral-900 dark:text-white"
                      : "text-neutral-400 dark:text-neutral-600"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      {(order.token_number || (order.estimated_ready_at && order.status !== "completed")) && (
        <Card className="mt-5 flex items-center gap-4 p-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
          {order.token_number && (
            <div>
              <p className="text-xs text-neutral-500">Token number</p>
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">#{order.token_number}</p>
            </div>
          )}
          {order.estimated_ready_at && order.status !== "completed" && (
            <div className="border-l border-neutral-200 pl-4 dark:border-neutral-800">
              <p className="text-xs text-neutral-500">Estimated ready</p>
              <p className="text-sm font-medium text-neutral-900 dark:text-white">
                {new Date(order.estimated_ready_at).toLocaleString()}
              </p>
            </div>
          )}
        </Card>
      )}
    </PageShell>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense>
      <OrderTracker />
    </Suspense>
  );
}
