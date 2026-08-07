"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LookupPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!orderNumber.trim() || !/^[0-9]{10}$/.test(phoneNumber)) {
      setError("Enter your order number and the 10-digit phone number used at checkout.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_number: orderNumber.trim(), phone_number: phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Order not found.");
        return;
      }
      router.push(`/order?id=${data.order_number}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Find your order</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Enter the order number and phone number you used at checkout.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Order number</label>
          <input
            type="text"
            placeholder="e.g. A214"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Phone number</label>
          <input
            type="tel"
            inputMode="numeric"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-neutral-900 px-5 py-2.5 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {submitting ? "Searching…" : "Find order"}
        </button>
      </form>
    </main>
  );
}
