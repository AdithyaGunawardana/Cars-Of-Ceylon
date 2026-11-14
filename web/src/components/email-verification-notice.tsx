"use client";

import { useState } from "react";
import { readApiError, secondaryButtonClass } from "@/lib/client-utils";

export function EmailVerificationNotice({ email, verified }: { email: string; verified: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (verified) {
    return <p className="text-sm text-[#2f5d2a]">Email {email} is verified.</p>;
  }

  async function resend() {
    setState("sending");
    setError(null);
    const response = await fetch("/api/auth/verify/send", { method: "POST" });
    if (!response.ok) {
      setError(await readApiError(response, "Could not send the email."));
      setState("idle");
      return;
    }
    setState("sent");
  }

  return (
    <div className="grid gap-2 rounded-2xl bg-[#fff7e6] p-4 ring-1 ring-[#d3c3c0]/70">
      <p className="text-sm text-[#725a39]">Your email address {email} is not verified yet.</p>
      {state === "sent" ? (
        <p role="status" className="text-sm text-[#2f5d2a]">Verification email sent. Check your inbox.</p>
      ) : (
        <button type="button" onClick={resend} disabled={state === "sending"} className={`${secondaryButtonClass} w-fit`}>
          {state === "sending" ? "Sending..." : "Send verification email"}
        </button>
      )}
      {error ? <p role="alert" className="text-sm text-[#9e2a2b]">{error}</p> : null}
    </div>
  );
}
