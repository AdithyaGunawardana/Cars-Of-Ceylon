"use client";

import Link from "next/link";
import { useEffect } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/lib/client-utils";

// In this Next.js version the recovery callback is `retry` (not `reset`).
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 px-6 py-24">
      <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Something went wrong</p>
      <h1 className="font-serif text-3xl text-[#271310]">We hit a snag loading this page</h1>
      <p className="text-sm text-[#504442]">You can try again, or head back to the archive.</p>
      <div className="flex gap-3">
        <button type="button" onClick={() => retry()} className={primaryButtonClass}>
          Try again
        </button>
        <Link href="/vehicles" className={secondaryButtonClass}>
          Browse vehicles
        </Link>
      </div>
    </main>
  );
}
