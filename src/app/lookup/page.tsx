"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorText, Eyebrow, inputClass, PageShell } from "@/components/ui";

export default function LookupPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Prefer the form's own values over React state: an autofilled field
    // writes to the DOM without firing the change event React listens for,
    // which would otherwise leave state empty while the field looks filled.
    const formData = new FormData(e.currentTarget);
    const submittedOrder = (String(formData.get("order_number") ?? "") || orderNumber).trim().toUpperCase();
    const submittedPhone = (String(formData.get("phone_number") ?? "") || phoneNumber).replace(/\D/g, "").slice(0, 10);

    if (!submittedOrder || !/^[0-9]{10}$/.test(submittedPhone)) {
      setError("Enter your order number and the 10-digit phone number used at checkout.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_number: submittedOrder, phone_number: submittedPhone }),
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
    <PageShell>
      <div className="animate-fade-in">
        <Eyebrow>Track order</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Find your order</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Enter the order number and phone number you used at checkout.
        </p>
      </div>

      <Card className="mt-6 p-6 animate-fade-in" style={{ animationDelay: "60ms" }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Order number</label>
            <input
              type="text"
              name="order_number"
              placeholder="e.g. A214"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Phone number</label>
            <input
              type="tel"
              name="phone_number"
              inputMode="numeric"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className={inputClass}
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Searching…" : "Find order"}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
