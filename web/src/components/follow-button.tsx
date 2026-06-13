"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  userId: string;
  signedIn: boolean;
  isSelf: boolean;
  initialIsFollowing: boolean;
};

export function FollowButton({ userId, signedIn, isSelf, initialIsFollowing }: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);

  async function toggleFollow() {
    setLoading(true);

    const response = await fetch(`/api/users/${userId}/follow`, {
      method: following ? "DELETE" : "POST",
    });

    setLoading(false);

    if (!response.ok) {
      return;
    }

    setFollowing(!following);
    router.refresh();
  }

  if (!signedIn) {
    return (
      <Link href={`/login?callbackUrl=/users/${userId}`} className="rounded-full bg-[#271310] px-4 py-2 text-sm font-semibold text-[#fbfaee] hover:bg-[#3e2723]">
        Sign in to follow
      </Link>
    );
  }

  if (isSelf) {
    return <span className="rounded-full bg-[#f5f4e8] px-4 py-2 text-sm text-[#504442] ring-1 ring-[#d3c3c0]/70">This is your profile</span>;
  }

  return (
    <button
      type="button"
      onClick={toggleFollow}
      disabled={loading}
      className="rounded-full bg-[#725a39] px-4 py-2 text-sm font-semibold text-[#fbfaee] hover:bg-[#5b403c] disabled:opacity-60"
    >
      {loading ? "Updating..." : following ? "Unfollow" : "Follow"}
    </button>
  );
}
