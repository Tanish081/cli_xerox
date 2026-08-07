"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { priceForPrintSpec } from "@/lib/pricing";
import type { PrintSpec, StationeryProduct } from "@/lib/types";

const DEFAULT_PRINT_SPEC: PrintSpec = {
  copies: 1,
  color: "bw",
  duplex: false,
  binding: "none",
  page_count: 1,
};

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

  const printTotal = useMemo(
    () => (wantsPrint ? priceForPrintSpec(printSpec) : 0),
    [wantsPrint, printSpec]
  );

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
          JSON.stringify(
            Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity }))
          )
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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">New order</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Upload a document to print and/or add stationery items, then pay via UPI.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-10">
        <section>
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={wantsPrint}
              onChange={(e) => setWantsPrint(e.target.checked)}
            />
            Print a document
          </label>

          {wantsPrint && (
            <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="col-span-2">
                <label className="block text-sm font-medium">Document</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Copies</label>
                <input
                  type="number"
                  min={1}
                  value={printSpec.copies}
                  onChange={(e) =>
                    setPrintSpec((s) => ({ ...s, copies: Math.max(1, Number(e.target.value)) }))
                  }
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Page count</label>
                <input
                  type="number"
                  min={1}
                  value={printSpec.page_count}
                  onChange={(e) =>
                    setPrintSpec((s) => ({ ...s, page_count: Math.max(1, Number(e.target.value)) }))
                  }
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Color</label>
                <select
                  value={printSpec.color}
                  onChange={(e) =>
                    setPrintSpec((s) => ({ ...s, color: e.target.value as PrintSpec["color"] }))
                  }
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <option value="bw">Black & white</option>
                  <option value="color">Color</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Binding</label>
                <select
                  value={printSpec.binding}
                  onChange={(e) =>
                    setPrintSpec((s) => ({ ...s, binding: e.target.value as PrintSpec["binding"] }))
                  }
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <option value="none">None</option>
                  <option value="staple">Staple</option>
                  <option value="spiral">Spiral</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={printSpec.duplex}
                    onChange={(e) => setPrintSpec((s) => ({ ...s, duplex: e.target.checked }))}
                  />
                  Double-sided (duplex)
                </label>
              </div>
              <p className="col-span-2 text-sm text-neutral-500">
                Print subtotal: ₹{printTotal.toFixed(2)}
              </p>
            </div>
          )}
        </section>

        <section>
          <h2 className="font-medium">Stationery</h2>
          {productsError && <p className="mt-2 text-sm text-red-600">{productsError}</p>}
          <div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
            {products.map((product) => (
              <div key={product.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-neutral-500">
                    ₹{product.price.toFixed(2)} · {product.stock_quantity} in stock
                  </p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={product.stock_quantity}
                  value={cart[product.id] ?? 0}
                  onChange={(e) => setQuantity(product.id, Number(e.target.value))}
                  className="w-20 rounded border border-neutral-300 px-2 py-1 text-right dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
            ))}
            {products.length === 0 && !productsError && (
              <p className="py-3 text-sm text-neutral-500">No stationery items available right now.</p>
            )}
          </div>
        </section>

        <section>
          <label className="block text-sm font-medium">Phone number</label>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Used to look up your order later, and only entry point besides this browser session.
          </p>
        </section>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <p className="text-lg font-semibold">Total: ₹{grandTotal.toFixed(2)}</p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-neutral-900 px-5 py-2.5 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {submitting ? "Placing order…" : "Continue to payment"}
          </button>
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </form>
    </main>
  );
}
