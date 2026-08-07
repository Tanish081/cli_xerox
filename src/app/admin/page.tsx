"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderItem } from "@/lib/types";

type AdminOrder = Order & {
  order_items: OrderItem[];
  document_signed_url: string | null;
  payment_screenshot_signed_url: string | null;
};

async function fetchQueue(status: string): Promise<AdminOrder[]> {
  const res = await fetch(`/api/admin/orders?status=${status}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.orders ?? [];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [pendingReview, setPendingReview] = useState<AdminOrder[]>([]);
  const [tokenAssigned, setTokenAssigned] = useState<AdminOrder[]>([]);
  const [ready, setReady] = useState<AdminOrder[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [review, assigned, readyOrders] = await Promise.all([
      fetchQueue("pending_review"),
      fetchQueue("token_assigned"),
      fetchQueue("ready"),
    ]);
    setPendingReview(review);
    setTokenAssigned(assigned);
    setReady(readyOrders);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial poll on mount is intentional
    loadAll();
    const interval = setInterval(loadAll, 20000);
    return () => clearInterval(interval);
  }, [loadAll]);

  async function act(id: string, path: string, body?: object) {
    setBusyId(id);
    try {
      await fetch(`/api/admin/orders/${id}/${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      await loadAll();
    } finally {
      setBusyId(null);
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin dashboard</h1>
        <button onClick={signOut} className="text-sm text-neutral-500 underline">
          Sign out
        </button>
      </div>

      <section className="mt-8">
        <h2 className="font-medium">Review queue ({pendingReview.length})</h2>
        <div className="mt-3 space-y-4">
          {pendingReview.map((order) => (
            <div key={order.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {order.order_number} · ₹{order.total_amount.toFixed(2)} · {order.phone_number}
                </p>
                <p className="text-sm text-neutral-500">UTR: {order.payment_utr}</p>
              </div>
              <div className="mt-2 flex gap-3 text-sm">
                {order.document_signed_url && (
                  <a href={order.document_signed_url} target="_blank" className="text-blue-600 underline">
                    View document
                  </a>
                )}
                {order.payment_screenshot_signed_url && (
                  <a href={order.payment_screenshot_signed_url} target="_blank" className="text-blue-600 underline">
                    View screenshot
                  </a>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busyId === order.id}
                  onClick={() => act(order.id, "approve", { ready_in_minutes: 30 })}
                  className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busyId === order.id}
                  onClick={() => act(order.id, "reject")}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
          {pendingReview.length === 0 && <p className="text-sm text-neutral-500">Nothing to review.</p>}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-medium">Token assigned ({tokenAssigned.length})</h2>
        <div className="mt-3 space-y-3">
          {tokenAssigned.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <p>
                <span className="font-medium">#{order.token_number}</span> — {order.order_number} ·{" "}
                {order.phone_number}
              </p>
              <button
                disabled={busyId === order.id}
                onClick={() => act(order.id, "ready")}
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                Mark ready
              </button>
            </div>
          ))}
          {tokenAssigned.length === 0 && <p className="text-sm text-neutral-500">Nothing here.</p>}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-medium">Ready for pickup ({ready.length})</h2>
        <div className="mt-3 space-y-3">
          {ready.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <p>
                <span className="font-medium">#{order.token_number}</span> — {order.order_number} ·{" "}
                {order.phone_number}
              </p>
              <button
                disabled={busyId === order.id}
                onClick={() => act(order.id, "complete")}
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                Mark completed
              </button>
            </div>
          ))}
          {ready.length === 0 && <p className="text-sm text-neutral-500">Nothing here.</p>}
        </div>
      </section>
    </main>
  );
}
