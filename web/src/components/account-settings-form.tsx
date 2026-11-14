"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useState } from "react";
import { inputClass, primaryButtonClass, readApiError, secondaryButtonClass, textareaClass } from "@/lib/client-utils";

type Props = { initial: { name: string; bio: string; image: string }; storageEnabled?: boolean };
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

export function AccountSettingsForm({ initial, storageEnabled = true }: Props) {
  const router = useRouter();
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatar, setAvatar] = useState(initial.image);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState<Notice>(null);

  // Direct-to-storage upload: presign -> PUT -> finalize (the server re-checks size and type).
  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    setAvatarNotice(null);
    try {
      const presign = await fetch("/api/account/avatar/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileType: file.type, fileSize: file.size }),
      });
      if (!presign.ok) throw new Error(await readApiError(presign, "Could not start the upload."));
      const { uploadUrl, storageKey } = (await presign.json()) as { uploadUrl: string; storageKey: string };

      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("Upload to storage failed.");

      const finalize = await fetch("/api/account/avatar/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey }),
      });
      if (!finalize.ok) throw new Error(await readApiError(finalize, "Could not save the avatar."));
      const { image } = (await finalize.json()) as { image: string };
      setAvatar(image);
      setAvatarNotice({ kind: "ok", text: "Avatar updated." });
      router.refresh();
    } catch (error) {
      setAvatarNotice({ kind: "error", text: error instanceof Error ? error.message : "Upload failed." });
    } finally {
      setAvatarBusy(false);
      input.value = "";
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setAvatarNotice(null);
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "" }),
    });
    setAvatarBusy(false);
    if (!response.ok) {
      setAvatarNotice({ kind: "error", text: await readApiError(response, "Could not remove the avatar.") });
      return;
    }
    setAvatar("");
    setAvatarNotice({ kind: "ok", text: "Avatar removed." });
    router.refresh();
  }

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

        <div className="grid gap-2 text-sm text-[#504442]">
          <span>Avatar</span>
          <div className="flex items-center gap-4">
            {avatar ? (
              <>
                {/* Plain <img>: avatars are served from the storage host, not optimized by next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatar} alt="Your avatar" className="h-16 w-16 rounded-full object-cover ring-1 ring-[#d3c3c0]" />
              </>
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full bg-[#f5f4e8] text-xs ring-1 ring-[#d3c3c0]">None</div>
            )}
            <div className="flex flex-wrap gap-2">
              {storageEnabled ? (
                <label className={`${secondaryButtonClass} cursor-pointer`}>
                  {avatarBusy ? "Working..." : "Upload photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={uploadAvatar}
                    disabled={avatarBusy}
                    className="sr-only"
                    aria-label="Upload avatar"
                  />
                </label>
              ) : null}
              {avatar ? (
                <button type="button" onClick={removeAvatar} disabled={avatarBusy} className={secondaryButtonClass}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          <NoticeBox notice={avatarNotice} />
          <label className="grid gap-1">
            Or use an image link (http/https)
            <input name="image" type="url" value={avatar} onChange={(e) => setAvatar(e.target.value)} className={inputClass} />
          </label>
        </div>

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
