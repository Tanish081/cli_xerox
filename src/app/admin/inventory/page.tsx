"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StationeryProduct } from "@/lib/types";
import { Button, Card, inputClass, PageShell } from "@/components/ui";

function AddProductForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceNum = Number(price);
    const stockNum = Number(stock);
    if (!name.trim()) {
      setError("Enter a product name.");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("Enter a valid price.");
      return;
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      setError("Enter a valid stock quantity.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("price", String(priceNum));
      formData.set("stock_quantity", String(stockNum));
      if (image) formData.set("image", image);

      const res = await fetch("/api/admin/products", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add product");
        return;
      }
      setName("");
      setPrice("");
      setStock("");
      setImage(null);
      onAdded();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-neutral-900 dark:text-white">Add a stationery item</h2>
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium text-neutral-500">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">Price (₹)</label>
          <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">Stock</label>
          <input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">Photo (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="mt-1.5 block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-2.5 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500"
          />
        </div>
        <div className="col-span-2 flex items-end sm:col-span-4">
          <Button type="submit" disabled={submitting} className="!px-4 !py-2 text-sm">
            {submitting ? "Adding…" : "Add item"}
          </Button>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Card>
  );
}

function ProductRow({ product, onSaved }: { product: StationeryProduct; onSaved: () => void }) {
  const [price, setPrice] = useState(String(product.price));
  const [stock, setStock] = useState(String(product.stock_quantity));
  const [active, setActive] = useState(product.active);
  const [saving, setSaving] = useState(false);
  const dirty = price !== String(product.price) || stock !== String(product.stock_quantity) || active !== product.active;

  async function save() {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("price", price);
      formData.set("stock_quantity", stock);
      formData.set("active", String(active));
      await fetch(`/api/admin/products/${product.id}`, { method: "PATCH", body: formData });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={`flex flex-wrap items-center gap-4 p-4 ${!active ? "opacity-60" : ""}`}>
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- public bucket URL
        <img src={product.image_url} alt={product.name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4-4a2 2 0 012.8 0l5.2 5.2M4 6h16v12H4z" />
          </svg>
        </span>
      )}
      <p className="min-w-[8rem] flex-1 font-medium text-neutral-900 dark:text-white">{product.name}</p>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-neutral-500">₹</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-20 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-neutral-500">Stock</span>
        <input
          type="number"
          min={0}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="w-16 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      <label className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-300">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
        Active
      </label>
      <Button
        variant="secondary"
        disabled={!dirty || saving}
        onClick={save}
        className="!px-3 !py-1.5 text-xs"
      >
        {saving ? "Saving…" : "Save"}
      </Button>
    </Card>
  );
}

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<StationeryProduct[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/admin/products", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount is intentional
    load();
  }, []);

  return (
    <PageShell maxWidth="max-w-3xl">
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
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Inventory</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Manage the stationery items customers can add to their order alongside printing. Inactive items are
          hidden from the customer catalog.
        </p>
      </div>

      <div className="mt-6 animate-fade-in" style={{ animationDelay: "60ms" }}>
        <AddProductForm onAdded={load} />
      </div>

      <div className="mt-6 space-y-3 animate-fade-in" style={{ animationDelay: "100ms" }}>
        {loading && <p className="text-sm text-neutral-500">Loading…</p>}
        {!loading && products.length === 0 && (
          <Card className="p-6 text-center text-sm text-neutral-500">No stationery items yet — add one above.</Card>
        )}
        {products.map((product) => (
          <ProductRow key={product.id} product={product} onSaved={load} />
        ))}
      </div>
    </PageShell>
  );
}
