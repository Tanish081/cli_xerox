"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, PageShell } from "@/components/ui";

type ItemSales = { name: string; quantity: number };
type OrderRow = {
  serial: number;
  order_number: string;
  phone_number: string;
  details: string;
  total_amount: number;
  created_at: string;
};
type Analytics = {
  daily_revenue: number;
  monthly_revenue: number;
  top_items: ItemSales[];
  least_items: ItemSales[];
  orders: OrderRow[];
};

function RevenueCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-6">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-neutral-900 dark:text-white">₹{value.toFixed(2)}</p>
    </Card>
  );
}

function ItemBarChart({ title, subtitle, data }: { title: string; subtitle: string; data: ItemSales[] }) {
  const max = Math.max(...data.map((d) => d.quantity), 1);
  return (
    <Card className="p-6">
      <h3 className="font-semibold text-neutral-900 dark:text-white">{title}</h3>
      <p className="text-xs text-neutral-500">{subtitle}</p>
      <div className="mt-4 space-y-3">
        {data.map((d) => (
          <div key={d.name}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="truncate text-neutral-700 dark:text-neutral-300">{d.name}</span>
              <span className="font-semibold text-neutral-900 tabular-nums dark:text-white">{d.quantity}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-indigo-50 dark:bg-indigo-950/40">
              <div
                className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500"
                style={{ width: `${(d.quantity / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="text-sm text-neutral-500">No stationery sales yet.</p>}
      </div>
    </Card>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/analytics", { cache: "no-store" })
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  async function downloadPdf() {
    if (!data) return;
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Radhe Xerox — Sales report", 14, 16);
      doc.setFontSize(10);
      doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);
      doc.text(`Today's revenue: Rs. ${data.daily_revenue.toFixed(2)}`, 14, 30);
      doc.text(`This month's revenue: Rs. ${data.monthly_revenue.toFixed(2)}`, 14, 36);

      autoTable(doc, {
        startY: 44,
        head: [["S.No", "Customer number", "Order details", "Amount", "Date"]],
        body: data.orders.map((o) => [
          String(o.serial),
          o.phone_number,
          o.details,
          `Rs. ${o.total_amount.toFixed(2)}`,
          new Date(o.created_at).toLocaleString(),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] },
      });

      doc.save(`sales-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageShell maxWidth="max-w-4xl">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to dashboard
      </Link>

      <div className="mt-3 flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Statistics</h1>
          <p className="mt-1.5 text-sm text-neutral-500">Revenue and sales, based on successfully verified orders.</p>
        </div>
        <Button variant="secondary" disabled={!data || exporting} onClick={downloadPdf} className="!px-4 !py-2 text-sm">
          {exporting ? "Preparing…" : "Download PDF"}
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        </div>
      )}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 animate-fade-in" style={{ animationDelay: "60ms" }}>
            <RevenueCard label="Today's revenue" value={data.daily_revenue} />
            <RevenueCard label="This month's revenue" value={data.monthly_revenue} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <ItemBarChart title="Best sellers" subtitle="Most sold stationery items" data={data.top_items} />
            <ItemBarChart title="Slow movers" subtitle="Least sold stationery items" data={data.least_items} />
          </div>

          <Card className="mt-6 overflow-hidden p-0 animate-fade-in" style={{ animationDelay: "140ms" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-800/60">
                  <tr>
                    <th className="px-4 py-3 font-medium">S.No</th>
                    <th className="px-4 py-3 font-medium">Customer number</th>
                    <th className="px-4 py-3 font-medium">Order details</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {data.orders.map((o) => (
                    <tr key={o.order_number}>
                      <td className="px-4 py-3 tabular-nums text-neutral-500">{o.serial}</td>
                      <td className="px-4 py-3 text-neutral-900 dark:text-white">{o.phone_number}</td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">{o.details}</td>
                      <td className="px-4 py-3 tabular-nums font-medium text-neutral-900 dark:text-white">
                        ₹{o.total_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-neutral-500">{new Date(o.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {data.orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                        No orders yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </PageShell>
  );
}
