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
      <Link href={`/login?callbackUrl=/users/${userId}`} className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-amber-300">
        Sign in to follow
      </Link>
    );
  }

  if (isSelf) {
    return <span className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300">This is your profile</span>;
  }

  return (
    <button
      type="button"
      onClick={toggleFollow}
      disabled={loading}
      className="rounded-md border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-950 disabled:opacity-60"
    >
      {loading ? "Updating..." : following ? "Unfollow" : "Follow"}
    </button>
  );
}
