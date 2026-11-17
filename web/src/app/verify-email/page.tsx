"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { primaryButtonClass, readApiError } from "@/lib/client-utils";

function VerifyEmailContent() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  // Confirmation is an explicit click (POST) so mail scanners that pre-open links cannot use up the token.
  async function confirm() {
    setState("working");
    setError(null);
    const response = await fetch("/api/auth/verify/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      setError(await readApiError(response, "Could not verify this email."));
      setState("idle");
      return;
    }
    setState("done");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-12">
      <div className="rounded-[1.75rem] bg-white p-8 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Email</p>
        <h1 className="mt-2 font-serif text-3xl text-[#271310]">Confirm your email</h1>

        {state === "done" ? (
          <>
            <p role="status" className="mt-4 rounded-2xl bg-[#f0f7ee] px-4 py-3 text-sm text-[#2f5d2a]">Your email address is confirmed.</p>
            <Link href="/vehicles" className={`${primaryButtonClass} mt-4 inline-block`}>Continue</Link>
          </>
        ) : !token ? (
          <p role="alert" className="mt-4 text-sm text-[#9e2a2b]">This link is missing its token. Request a new one from your account settings.</p>
        ) : (
          <>
            {error ? <p role="alert" className="mt-4 text-sm text-[#9e2a2b]">{error}</p> : null}
            <button type="button" onClick={confirm} disabled={state === "working"} className={`${primaryButtonClass} mt-5`}>
              {state === "working" ? "Confirming..." : "Confirm email address"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-md px-6 py-10 text-sm text-[#504442]">Loading...</main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
