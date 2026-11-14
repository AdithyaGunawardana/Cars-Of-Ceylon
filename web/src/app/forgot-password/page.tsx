"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { inputClass, primaryButtonClass, readApiError } from "@/lib/client-utils";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!response.ok) {
      setError(await readApiError(response, "Could not send the reset email."));
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-12">
      <div className="rounded-[1.75rem] bg-white p-8 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Account recovery</p>
        <h1 className="mt-2 font-serif text-3xl text-[#271310]">Reset password</h1>

        {sent ? (
          <p role="status" className="mt-4 rounded-2xl bg-[#f5f4e8] px-4 py-3 text-sm text-[#504442] ring-1 ring-[#d3c3c0]/70">
            If an account exists for that address, a reset link is on its way. It expires in one hour.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-[#504442]">Enter your email and we will send you a link to choose a new password.</p>
            {error ? <p role="alert" className="mt-4 rounded-full bg-[#fff0ef] px-3 py-2 text-sm text-[#9e2a2b]">{error}</p> : null}
            <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
              <input type="email" name="email" required placeholder="Email" autoComplete="email" className={inputClass} />
              <button type="submit" disabled={loading} className={primaryButtonClass}>
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <p className="mt-4 text-sm text-[#504442]">
          <Link href="/login" className="font-semibold text-[#725a39] hover:text-[#271310]">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
