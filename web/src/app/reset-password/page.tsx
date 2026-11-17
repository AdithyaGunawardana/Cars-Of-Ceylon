"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { inputClass, primaryButtonClass, readApiError } from "@/lib/client-utils";

function ResetPasswordContent() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!response.ok) {
      setError(await readApiError(response, "Could not reset the password."));
      return;
    }
    setDone(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-12">
      <div className="rounded-[1.75rem] bg-white p-8 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Account recovery</p>
        <h1 className="mt-2 font-serif text-3xl text-[#271310]">Choose a new password</h1>

        {done ? (
          <>
            <p role="status" className="mt-4 rounded-2xl bg-[#f0f7ee] px-4 py-3 text-sm text-[#2f5d2a]">
              Your password has been updated. Other devices have been signed out.
            </p>
            <Link href="/login" className={`${primaryButtonClass} mt-4 inline-block`}>Sign in</Link>
          </>
        ) : !token ? (
          <p role="alert" className="mt-4 text-sm text-[#9e2a2b]">
            This link is missing its token. <Link href="/forgot-password" className="font-semibold underline">Request a new one</Link>.
          </p>
        ) : (
          <>
            {error ? <p role="alert" className="mt-4 rounded-full bg-[#fff0ef] px-3 py-2 text-sm text-[#9e2a2b]">{error}</p> : null}
            <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
              <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder="New password (min 8 chars)" className={inputClass} />
              <input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Repeat new password" className={inputClass} />
              <button type="submit" disabled={loading} className={primaryButtonClass}>
                {loading ? "Saving..." : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-md px-6 py-10 text-sm text-[#504442]">Loading...</main>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
