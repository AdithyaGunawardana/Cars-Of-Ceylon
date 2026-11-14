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

    // Registration is server-validated and password hashing happens in the API route.
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

    // Redirect with a flag so login can show a success state.
    router.push("/login?registered=1");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-12">
      <div className="rounded-[1.75rem] bg-[#ffffff] p-8 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Join the archive</p>
        <h1 className="mt-2 font-serif text-3xl text-[#271310]">Create Account</h1>
        <p className="mt-2 text-sm text-[#504442]">Register to contribute vehicle history and photo records.</p>

        {error ? (
          <p className="mt-4 rounded-full bg-[#fff0ef] px-3 py-2 text-sm text-[#9e2a2b] ring-1 ring-[#d3c3c0]/70">{error}</p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
          <input
            name="name"
            required
            minLength={2}
            placeholder="Name"
            className="rounded-full border border-[#d3c3c0] bg-[#fbfaee] px-3 py-2 text-sm text-[#271310] placeholder:text-[#765f5c]"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="rounded-full border border-[#d3c3c0] bg-[#fbfaee] px-3 py-2 text-sm text-[#271310] placeholder:text-[#765f5c]"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Password (min 8 chars)"
            className="rounded-full border border-[#d3c3c0] bg-[#fbfaee] px-3 py-2 text-sm text-[#271310] placeholder:text-[#765f5c]"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[#271310] px-4 py-2 text-sm font-semibold text-[#fbfaee] hover:bg-[#3e2723] disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-4 text-sm text-[#504442]">
          Already registered? <Link href="/login" className="font-semibold text-[#725a39] hover:text-[#271310]">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
