"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Suspense } from "react";
import { signIn } from "next-auth/react";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Preserve intended destination after authentication.
  const callbackUrl = searchParams.get("callbackUrl") ?? "/vehicles";
  const registered = searchParams.get("registered") === "1";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });

    if (!result || result.error) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    router.push(result.url ?? callbackUrl);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-12">
      <div className="rounded-[1.75rem] bg-[#ffffff] p-8 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Welcome back</p>
        <h1 className="mt-2 font-serif text-3xl text-[#271310]">Sign In</h1>
        <p className="mt-2 text-sm text-[#504442]">Access your account to add and manage vehicle records.</p>

        {registered ? (
          <p className="mt-4 rounded-full bg-[#f5f4e8] px-3 py-2 text-sm text-[#504442] ring-1 ring-[#d3c3c0]/70">
            Registration successful. You can sign in now.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-full bg-[#fff0ef] px-3 py-2 text-sm text-[#9e2a2b] ring-1 ring-[#d3c3c0]/70">{error}</p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="Email"
            className="rounded-full border border-[#d3c3c0] bg-[#fbfaee] px-3 py-2 text-sm text-[#271310] placeholder:text-[#765f5c]"
          />
          <input
            type="password"
            name="password"
            required
            placeholder="Password"
            className="rounded-full border border-[#d3c3c0] bg-[#fbfaee] px-3 py-2 text-sm text-[#271310] placeholder:text-[#765f5c]"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[#271310] px-4 py-2 text-sm font-semibold text-[#fbfaee] hover:bg-[#3e2723] disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-4 text-sm text-[#504442]">
          No account yet? <Link href="/register" className="font-semibold text-[#725a39] hover:text-[#271310]">Create one</Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    // Keep useSearchParams in a Suspense boundary to satisfy App Router rendering requirements.
    <Suspense fallback={<main className="mx-auto w-full max-w-md px-6 py-10 text-sm text-[#504442]">Loading...</main>}>
      <LoginPageContent />
    </Suspense>
  );
}
