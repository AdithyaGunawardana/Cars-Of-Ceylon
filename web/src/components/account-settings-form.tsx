"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { inputClass, primaryButtonClass, readApiError, textareaClass } from "@/lib/client-utils";

type Props = { initial: { name: string; bio: string; image: string } };
type Notice = { kind: "ok" | "error"; text: string } | null;

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const tone = notice.kind === "ok" ? "bg-[#f0f7ee] text-[#2f5d2a]" : "bg-[#fff0ef] text-[#9e2a2b]";
  return (
    <p role="status" className={`rounded-full px-3 py-2 text-sm ring-1 ring-[#d3c3c0]/70 ${tone}`}>
      {notice.text}
    </p>
  );
}

export function AccountSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Read form data before any await (currentTarget is cleared afterwards).
    const form = new FormData(event.currentTarget);
    setSavingProfile(true);
    setProfileNotice(null);
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        bio: String(form.get("bio") ?? ""),
        image: String(form.get("image") ?? "").trim(),
      }),
    });
    setSavingProfile(false);
    if (!response.ok) {
      setProfileNotice({ kind: "error", text: await readApiError(response, "Failed to save profile.") });
      return;
    }
    setProfileNotice({ kind: "ok", text: "Profile saved." });
    router.refresh();
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSavingPassword(true);
    setPasswordNotice(null);
    const response = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: String(form.get("currentPassword") ?? ""),
        newPassword: String(form.get("newPassword") ?? ""),
      }),
    });
    setSavingPassword(false);
    if (!response.ok) {
      setPasswordNotice({ kind: "error", text: await readApiError(response, "Failed to change password.") });
      return;
    }
    formElement.reset();
    setPasswordNotice({ kind: "ok", text: "Password updated." });
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={saveProfile} className="grid gap-3 rounded-[1.5rem] bg-white p-6 ring-1 ring-[#d3c3c0]/70">
        <h2 className="font-serif text-xl text-[#271310]">Profile</h2>
        <NoticeBox notice={profileNotice} />
        <label className="grid gap-1 text-sm text-[#504442]">
          Name
          <input name="name" required minLength={2} maxLength={100} defaultValue={initial.name} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm text-[#504442]">
          Bio
          <textarea name="bio" rows={4} maxLength={500} defaultValue={initial.bio} className={textareaClass} />
        </label>
        <label className="grid gap-1 text-sm text-[#504442]">
          Avatar URL (http/https, leave empty to remove)
          <input name="image" type="url" defaultValue={initial.image} className={inputClass} />
        </label>
        <button type="submit" disabled={savingProfile} className={`${primaryButtonClass} justify-self-start`}>
          {savingProfile ? "Saving..." : "Save profile"}
        </button>
      </form>

      <form onSubmit={changePassword} className="grid gap-3 rounded-[1.5rem] bg-white p-6 ring-1 ring-[#d3c3c0]/70">
        <h2 className="font-serif text-xl text-[#271310]">Change password</h2>
        <NoticeBox notice={passwordNotice} />
        <input name="currentPassword" type="password" required autoComplete="current-password" placeholder="Current password" className={inputClass} />
        <input name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder="New password (min 8 chars)" className={inputClass} />
        <button type="submit" disabled={savingPassword} className={`${primaryButtonClass} justify-self-start`}>
          {savingPassword ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
