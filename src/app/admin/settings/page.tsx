"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, inputClass, PageShell } from "@/components/ui";

export default function AdminSettingsPage() {
  const [shopName, setShopName] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/shop-settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setShopName(data.shop_name ?? "");
        setQrImageUrl(data.qr_image_url ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("shop_name", shopName);
      if (file) formData.set("qr_image", file);
      const res = await fetch("/api/admin/shop-settings", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not save settings");
        return;
      }
      setMessage("Saved.");
      setFile(null);
      const refreshed = await fetch("/api/admin/shop-settings", { cache: "no-store" }).then((r) => r.json());
      setQrImageUrl(refreshed.qr_image_url ?? null);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex justify-center py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to dashboard
      </Link>

      <div className="mt-3 animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Shop settings</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Upload a photo of your UPI QR code and set the name customers will see. This is also the name we match
          against payment screenshots to auto-verify orders, so make sure it matches exactly what your UPI app shows
          as the payee name.
        </p>
      </div>

      <Card className="mt-6 p-6 animate-fade-in" style={{ animationDelay: "60ms" }}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Shop name (as shown in UPI receipts)
            </label>
            <input type="text" required value={shopName} onChange={(e) => setShopName(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">QR code image</label>
            {qrImageUrl && (
              <div className="mt-2 inline-block rounded-xl border-4 border-neutral-100 bg-white p-1.5 shadow-sm dark:border-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, not an optimizable static asset */}
                <img src={qrImageUrl} alt="Current shop QR code" className="h-36 w-36 rounded-lg object-contain" />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500"
            />
          </div>

          {message && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
              {message}
            </p>
          )}

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
