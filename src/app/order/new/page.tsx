"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { priceForPrintSpec } from "@/lib/pricing";
import type { PrintSpec, StationeryProduct } from "@/lib/types";
import { Badge, Button, Card, ErrorText, Field, inputClass, PageShell } from "@/components/ui";

const DEFAULT_PRINT_SPEC: PrintSpec = {
  copies: 1,
  color: "bw",
  duplex: false,
  binding: "none",
  page_count: 1,
};

function SectionTitle({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-xs font-bold text-white">
        {step}
      </span>
      <h2 className="font-semibold text-neutral-900 dark:text-white">{title}</h2>
    </div>
  );
}

export default function NewOrderPage() {
  const router = useRouter();

  const [products, setProducts] = useState<StationeryProduct[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});

  const [wantsPrint, setWantsPrint] = useState(false);
  const [printSpec, setPrintSpec] = useState<PrintSpec>(DEFAULT_PRINT_SPEC);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        if (data.products) setProducts(data.products);
        else setProductsError("Could not load the stationery catalog.");
      })
      .catch(() => setProductsError("Could not load the stationery catalog."));
  }, []);

  const printTotal = useMemo(() => (wantsPrint ? priceForPrintSpec(printSpec) : 0), [wantsPrint, printSpec]);

  const cartTotal = useMemo(
    () =>
      Object.entries(cart).reduce((sum, [productId, qty]) => {
        const product = products.find((p) => p.id === productId);
        return product ? sum + product.price * qty : sum;
      }, 0),
    [cart, products]
  );

  const grandTotal = Math.round((printTotal + cartTotal) * 100) / 100;

  function setQuantity(productId: string, quantity: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      setFormError("Enter a valid 10-digit phone number.");
      return;
    }
    if (wantsPrint && !documentFile) {
      setFormError("Upload the document you want printed.");
      return;
    }
    if (!wantsPrint && Object.keys(cart).length === 0) {
      setFormError("Add a print job or at least one stationery item.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("phone_number", phoneNumber);
      if (wantsPrint) {
        formData.set("print_spec", JSON.stringify(printSpec));
        if (documentFile) formData.set("document", documentFile);
      }
      if (Object.keys(cart).length > 0) {
        formData.set(
          "cart",
          JSON.stringify(Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity })))
        );
      }

      const res = await fetch("/api/orders", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Could not place order.");
        return;
      }
      router.push(`/checkout?id=${data.order_number}`);
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell maxWidth="max-w-2xl">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">New order</h1>
        <p className="mt-1.5 text-neutral-500">Upload a document to print and/or add stationery items, then pay via UPI.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6 animate-fade-in" style={{ animationDelay: "60ms" }}>
        <Card className="p-6">
          <SectionTitle step={1} title="Print a document" />
          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 p-3.5 transition hover:border-indigo-300 dark:border-neutral-800 dark:hover:border-indigo-700">
            <input
              type="checkbox"
              checked={wantsPrint}
              onChange={(e) => setWantsPrint(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Yes, I need something printed
            </span>
          </label>

          {wantsPrint && (
            <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-800/40">
              <div className="col-span-2">
                <Field label="Document">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
                    className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500"
                  />
                </Field>
              </div>
              <Field label="Copies">
                <input
                  type="number"
                  min={1}
                  value={printSpec.copies}
                  onChange={(e) => setPrintSpec((s) => ({ ...s, copies: Math.max(1, Number(e.target.value)) }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Page count">
                <input
                  type="number"
                  min={1}
                  value={printSpec.page_count}
                  onChange={(e) => setPrintSpec((s) => ({ ...s, page_count: Math.max(1, Number(e.target.value)) }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Color">
                <select
                  value={printSpec.color}
                  onChange={(e) => setPrintSpec((s) => ({ ...s, color: e.target.value as PrintSpec["color"] }))}
                  className={inputClass}
                >
                  <option value="bw">Black & white</option>
                  <option value="color">Color</option>
                </select>
              </Field>
              <Field label="Binding">
                <select
                  value={printSpec.binding}
                  onChange={(e) => setPrintSpec((s) => ({ ...s, binding: e.target.value as PrintSpec["binding"] }))}
                  className={inputClass}
                >
                  <option value="none">None</option>
                  <option value="staple">Staple</option>
                  <option value="spiral">Spiral</option>
                </select>
              </Field>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={printSpec.duplex}
                    onChange={(e) => setPrintSpec((s) => ({ ...s, duplex: e.target.checked }))}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  Double-sided (duplex)
                </label>
              </div>
              <p className="col-span-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm dark:bg-neutral-900 dark:text-neutral-300">
                Print subtotal: <span className="text-indigo-600 dark:text-indigo-400">₹{printTotal.toFixed(2)}</span>
              </p>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <SectionTitle step={2} title="Stationery" />
          {productsError && <div className="mt-3"><ErrorText>{productsError}</ErrorText></div>}
          <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
            {products.map((product) => (
              <div key={product.id} className="flex items-center gap-3 py-3.5">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- public bucket URL
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-11 w-11 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4-4a2 2 0 012.8 0l5.2 5.2M4 6h16v12H4z" />
                    </svg>
                  </span>
                )}
                <div className="flex-1">
                  <p className="font-medium text-neutral-900 dark:text-white">{product.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-neutral-500">₹{product.price.toFixed(2)}</span>
                    <Badge tone={product.stock_quantity > 0 ? "success" : "danger"}>
                      {product.stock_quantity > 0 ? "In stock" : "Out of stock"}
                    </Badge>
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  max={product.stock_quantity}
                  disabled={product.stock_quantity === 0}
                  value={cart[product.id] ?? 0}
                  onChange={(e) => setQuantity(product.id, Number(e.target.value))}
                  className="w-20 rounded-lg border border-neutral-200 px-2 py-1.5 text-right text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
            ))}
            {products.length === 0 && !productsError && (
              <p className="py-3 text-sm text-neutral-500">No stationery items available right now.</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle step={3} title="Your phone number" />
          <div className="mt-4">
            <input
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              Used to look up your order later — this and your browser session are the only ways to track it.
            </p>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-neutral-500">Total</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">₹{grandTotal.toFixed(2)}</p>
          </div>
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? "Placing order…" : "Continue to payment"}
          </Button>
        </Card>
        <ErrorText>{formError}</ErrorText>
      </form>
    </PageShell>
  );
}
