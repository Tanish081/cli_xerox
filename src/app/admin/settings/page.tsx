"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, inputClass, PageShell } from "@/components/ui";

// Reads the UPI string encoded inside the QR image the owner picked, so
// checkout can offer a tap-to-pay link on mobile. Done in the browser
// (canvas is built in) rather than server-side, which keeps an image-
// decoding dependency out of the serverless bundle.
async function readUpiPayloadFromImage(file: File): Promise<string | null> {
  try {
    const jsQR = (await import("jsqr")).default;
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const result = jsQR(data, width, height);
    const payload = result?.data?.trim();
    return payload && /^upi:\/\//i.test(payload) ? payload : null;
  } catch {
    return null;
  }
}

export default function AdminSettingsPage() {
  const [shopName, setShopName] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [upiPayload, setUpiPayload] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [hasUpiLink, setHasUpiLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/shop-settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setShopName(data.shop_name ?? "");
        setQrImageUrl(data.qr_image_url ?? null);
        setHasUpiLink(Boolean(data.has_upi_link));
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleFileChange(selected: File | null) {
    setFile(selected);
    setUpiPayload(null);
    if (!selected) return;
    setScanning(true);
    try {
      setUpiPayload(await readUpiPayloadFromImage(selected));
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("shop_name", shopName);
      if (file) formData.set("qr_image", file);
      if (file && upiPayload) formData.set("upi_payload", upiPayload);
      const res = await fetch("/api/admin/shop-settings", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not save settings");
        return;
      }
      setMessage("Saved.");
      setFile(null);
      setUpiPayload(null);
      const refreshed = await fetch("/api/admin/shop-settings", { cache: "no-store" }).then((r) => r.json());
      setQrImageUrl(refreshed.qr_image_url ?? null);
      setHasUpiLink(Boolean(refreshed.has_upi_link));
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
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500"
            />

            {scanning && <p className="mt-2 text-xs text-neutral-500">Reading QR code…</p>}

            {!scanning && file && upiPayload && (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                QR read successfully — customers on a phone will be able to tap it to open their UPI app with the
                amount already filled in.
              </p>
            )}

            {!scanning && file && !upiPayload && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                Couldn&apos;t read a UPI code from this image. It will still be shown at checkout for customers to
                scan with another device, but tap-to-pay won&apos;t work. Try a sharper, less cropped copy of the QR
                if you want that.
              </p>
            )}

            {!file && !hasUpiLink && qrImageUrl && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                Tap-to-pay isn&apos;t set up for the current QR. Re-upload it here to enable it.
              </p>
            )}
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
