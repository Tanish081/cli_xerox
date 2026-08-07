import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-semibold">Xerox & Stationery</h1>
      <p className="mt-2 text-neutral-500">
        Upload documents for printing or grab stationery — pay by UPI, pick up when ready.
      </p>

      <div className="mt-8 flex w-full flex-col gap-3">
        <Link
          href="/order/new"
          className="rounded-md bg-neutral-900 px-5 py-3 font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Start a new order
        </Link>
        <Link
          href="/lookup"
          className="rounded-md border border-neutral-300 px-5 py-3 font-medium dark:border-neutral-700"
        >
          Track an existing order
        </Link>
      </div>
    </main>
  );
}
