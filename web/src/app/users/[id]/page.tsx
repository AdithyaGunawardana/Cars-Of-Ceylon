import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/auth";
import { FollowButton } from "@/components/follow-button";
import { loadUserProfile } from "@/lib/user-profile";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAuthSession();
  const profile = await loadUserProfile(id, session?.user?.id);

  if (!profile) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 md:px-10">
      <Link href="/vehicles" className="text-sm font-semibold text-amber-300 hover:text-amber-200">
        Back to vehicles
      </Link>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">{profile.user.name ?? "User profile"}</h1>
            <p className="mt-2 text-sm text-zinc-300">{profile.user.email ?? "No email available"}</p>
            {profile.user.profile && typeof profile.user.profile === "object" ? (
              <p className="mt-3 text-sm text-zinc-200">
                {(profile.user.profile as { bio?: string }).bio ?? "No bio added yet."}
              </p>
            ) : (
              <p className="mt-3 text-sm text-zinc-200">No bio added yet.</p>
            )}
          </div>
          <FollowButton
            userId={profile.user.id}
            signedIn={Boolean(session?.user?.id)}
            isSelf={profile.relationship.isSelf}
            initialIsFollowing={profile.relationship.isFollowing}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 px-3 py-1">Vehicles: {profile.stats.vehicleCount}</span>
          <span className="rounded-full border border-zinc-700 px-3 py-1">Followers: {profile.stats.followerCount}</span>
          <span className="rounded-full border border-zinc-700 px-3 py-1">Following: {profile.stats.followingCount}</span>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-xl font-semibold text-zinc-100">Vehicles</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {profile.vehicles.length === 0 ? <p className="text-sm text-zinc-300">No vehicles available yet.</p> : null}
          {profile.vehicles.map((vehicle) => (
            <article key={vehicle.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">
                    {vehicle.manufacturer} {vehicle.model}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-300">Unique ID: {vehicle.uniqueIdentifier}</p>
                  <p className="text-sm text-zinc-300">Plate: {vehicle.licensePlate ?? "Not set"}</p>
                </div>
                <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                  {vehicle.visibility}
                </span>
              </div>

              <p className="mt-2 text-xs text-zinc-400">
                Events: {vehicle._count.events} • Photos: {vehicle._count.photos}
              </p>

              <Link href={`/vehicles/${vehicle.id}`} className="mt-4 inline-block text-sm font-semibold text-amber-300 hover:text-amber-200">
                View Vehicle
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
