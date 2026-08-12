"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderItem } from "@/lib/types";
import { Button, Card, PageShell } from "@/components/ui";

const DOCUMENT_ICON_PATH =
  "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
const SCREENSHOT_ICON_PATH =
  "M4 16l4-4a2 2 0 012.8 0l5.2 5.2M4 6h16v12H4z";

type AdminOrder = Order & {
  order_items: OrderItem[];
  document_signed_url: string | null;
  payment_screenshot_signed_url: string | null;
};

function printSpecSummary(order: AdminOrder): string | null {
  const spec = order.print_spec;
  if (!spec) return null;
  const bindingLabel = spec.binding === "none" ? "no binding" : `${spec.binding} binding`;
  return `${spec.copies} ${spec.copies === 1 ? "copy" : "copies"} · ${spec.color === "bw" ? "B&W" : "Color"} · ${
    spec.duplex ? "double-sided" : "single-sided"
  } · ${bindingLabel} · ${spec.page_count} page${spec.page_count === 1 ? "" : "s"}`;
}

async function fetchQueue(status: string): Promise<AdminOrder[]> {
  const res = await fetch(`/api/admin/orders?status=${status}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.orders ?? [];
}

function EtaEditor({ order, onUpdated }: { order: AdminOrder; onUpdated: () => void }) {
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value < 0) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/orders/${order.id}/eta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes_from_now: value }),
      });
      setMinutes("");
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
      <span className="text-xs font-medium text-neutral-500">
        Ready {order.estimated_ready_at ? `by ${new Date(order.estimated_ready_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "time not set"}
      </span>
      <input
        type="number"
        min={0}
        placeholder="Minutes from now"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        className="w-32 rounded-lg border border-neutral-200 px-2 py-1 text-xs shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-neutral-700 dark:bg-neutral-950"
      />
      <Button
        variant="secondary"
        disabled={saving || minutes.trim() === ""}
        onClick={save}
        className="!px-3 !py-1.5 text-xs"
      >
        {saving ? "Updating…" : "Update ETA"}
      </Button>
    </div>
  );
}

function OrderCard({
  order,
  actionLabel,
  onAction,
  busy,
  showEtaEditor,
  onEtaUpdated,
}: {
  order: AdminOrder;
  actionLabel: string;
  onAction: () => void;
  busy: boolean;
  showEtaEditor?: boolean;
  onEtaUpdated?: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white">
            #{order.token_number}
          </span>
          <div>
            <p className="font-semibold text-neutral-900 dark:text-white">{order.order_number}</p>
            <p className="text-sm text-neutral-500">{order.phone_number}</p>
          </div>
        </div>
        <Button variant="secondary" disabled={busy} onClick={onAction} className="!px-4 !py-2 text-sm">
          {actionLabel}
        </Button>
      </div>
      {(order.document_signed_url || order.payment_screenshot_signed_url) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-100 pt-3 text-sm dark:border-neutral-800">
          {order.document_signed_url && (
            <a
              href={order.document_signed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={DOCUMENT_ICON_PATH} />
              </svg>
              View / print document
            </a>
          )}
          {order.payment_screenshot_signed_url && (
            <a
              href={order.payment_screenshot_signed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={SCREENSHOT_ICON_PATH} />
              </svg>
              View payment screenshot
            </a>
          )}
          {printSpecSummary(order) && <span className="text-neutral-500">{printSpecSummary(order)}</span>}
        </div>
      )}
      {order.order_items.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <span className="text-xs font-medium text-neutral-500">Also ordered:</span>
          {order.order_items.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {item.product?.name ?? "Item"} × {item.quantity}
            </span>
          ))}
        </div>
      )}
      {showEtaEditor && onEtaUpdated && <EtaEditor order={order} onUpdated={onEtaUpdated} />}
    </Card>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tokenAssigned, setTokenAssigned] = useState<AdminOrder[]>([]);
  const [ready, setReady] = useState<AdminOrder[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [assigned, readyOrders] = await Promise.all([fetchQueue("token_assigned"), fetchQueue("ready")]);
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
    <PageShell maxWidth="max-w-4xl">
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <p className="text-xs font-semibold tracking-wider text-indigo-600 uppercase dark:text-indigo-400">
            Admin
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/analytics">
            <Button variant="secondary" className="!px-4 !py-2 text-sm">
              Statistics
            </Button>
          </Link>
          <Link href="/admin/inventory">
            <Button variant="secondary" className="!px-4 !py-2 text-sm">
              Inventory
            </Button>
          </Link>
          <Link href="/admin/settings">
            <Button variant="secondary" className="!px-4 !py-2 text-sm">
              Shop settings
            </Button>
          </Link>
          <Button variant="ghost" onClick={signOut} className="!px-3 !py-2 text-sm">
            Sign out
          </Button>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-800 animate-fade-in dark:bg-indigo-950/40 dark:text-indigo-300">
        Payments are verified automatically from the customer&apos;s screenshot — orders only appear below once
        they&apos;ve been auto-verified and assigned a token.
      </p>

      <section className="mt-8 animate-fade-in" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-neutral-900 dark:text-white">Token assigned</h2>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500 dark:bg-neutral-800">
            {tokenAssigned.length}
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {tokenAssigned.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              actionLabel="Mark ready"
              busy={busyId === order.id}
              onAction={() => act(order.id, "ready")}
              showEtaEditor
              onEtaUpdated={loadAll}
            />
          ))}
          {tokenAssigned.length === 0 && (
            <Card className="p-6 text-center text-sm text-neutral-500">Nothing here.</Card>
          )}
        </div>
      </section>

      <section className="mt-8 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-neutral-900 dark:text-white">Ready for pickup</h2>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500 dark:bg-neutral-800">
            {ready.length}
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {ready.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              actionLabel="Mark completed"
              busy={busyId === order.id}
              onAction={() => act(order.id, "complete")}
            />
          ))}
          {ready.length === 0 && <Card className="p-6 text-center text-sm text-neutral-500">Nothing here.</Card>}
        </div>
      </section>
    </PageShell>
  );
}
