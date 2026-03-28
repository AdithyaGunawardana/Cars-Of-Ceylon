"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    };

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Failed to register.");
      setLoading(false);
      return;
    }

    router.push("/login?registered=1");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-10">
      <h1 className="text-3xl font-bold text-zinc-100">Create Account</h1>
      <p className="text-sm text-zinc-300">Register to contribute vehicle history and photo records.</p>

      {error ? (
        <p className="rounded-md border border-red-700 bg-red-950/50 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <input
          name="name"
          required
          minLength={2}
          placeholder="Name"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Password (min 8 chars)"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-amber-300 disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p className="text-sm text-zinc-300">
        Already registered? <Link href="/login" className="font-semibold text-amber-300">Sign in</Link>
      </p>
    </main>
  );
}
