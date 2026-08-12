import Link from "next/link";
import { Card } from "@/components/ui";

export default function Home() {
  return (
    <>
      <main className="mx-auto flex min-h-[85vh] w-full max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
        <div className="animate-fade-in">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Fast, no sign-up needed
          </span>

          <h1 className="mt-5 bg-gradient-to-br from-neutral-900 to-neutral-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl dark:from-white dark:to-neutral-400">
            Radhe Xerox
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-base text-neutral-500 dark:text-neutral-400">
            Upload documents for printing or grab stationery — pay by UPI, pick up when ready.
          </p>
        </div>

        <div className="mt-10 grid w-full gap-4 animate-fade-in" style={{ animationDelay: "80ms" }}>
          <Link href="/order/new" className="block">
            <Card className="group flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/25">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-neutral-900 dark:text-white">Start a new order</span>
                <span className="block text-sm text-neutral-500">Print documents or shop stationery</span>
              </span>
              <svg
                className="h-5 w-5 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-neutral-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Card>
          </Link>

          <Link href="/lookup" className="block">
            <Card className="group flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35M18 11a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-neutral-900 dark:text-white">Track an existing order</span>
                <span className="block text-sm text-neutral-500">By order ID and phone number</span>
              </span>
              <svg
                className="h-5 w-5 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-neutral-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Card>
          </Link>
        </div>
      </main>

      <Link
        href="/admin"
        className="fixed right-5 bottom-5 z-20 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-neutral-700 shadow-lg shadow-neutral-900/10 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-200"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15a3 3 0 100-6 3 3 0 000 6z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
          />
        </svg>
        Admin
      </Link>
    </>
  );
}
