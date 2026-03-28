"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Suspense } from "react";
import { signIn } from "next-auth/react";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-10">
      <h1 className="text-3xl font-bold text-zinc-100">Sign In</h1>
      <p className="text-sm text-zinc-300">Access your account to add and manage vehicle records.</p>

      {registered ? (
        <p className="rounded-md border border-emerald-700 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
          Registration successful. You can sign in now.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-700 bg-red-950/50 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <input
          type="email"
          name="email"
          required
          placeholder="Email"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          type="password"
          name="password"
          required
          placeholder="Password"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-amber-300 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="text-sm text-zinc-300">
        No account yet? <Link href="/register" className="font-semibold text-amber-300">Create one</Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-md px-6 py-10 text-sm text-zinc-300">Loading...</main>}>
      <LoginPageContent />
    </Suspense>
  );
}
