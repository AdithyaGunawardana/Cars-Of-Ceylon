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

      <section className="rounded-[1.5rem] bg-[#ffffff] p-6 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Community profile</p>
            <h1 className="font-serif text-3xl text-[#271310]">{profile.user.name ?? "User profile"}</h1>
            <p className="mt-2 text-sm text-[#504442]">{profile.user.email ?? "No email available"}</p>
            {profile.user.profile && typeof profile.user.profile === "object" ? (
              <p className="mt-3 text-sm text-[#271310]">
                {(profile.user.profile as { bio?: string }).bio ?? "No bio added yet."}
              </p>
            ) : (
              <p className="mt-3 text-sm text-[#271310]">No bio added yet.</p>
            )}
          </div>
          <FollowButton
            userId={profile.user.id}
            signedIn={Boolean(session?.user?.id)}
            isSelf={profile.relationship.isSelf}
            initialIsFollowing={profile.relationship.isFollowing}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#504442]">
          <span className="rounded-full bg-[#f5f4e8] px-3 py-1 ring-1 ring-[#d3c3c0]/70">Vehicles: {profile.stats.vehicleCount}</span>
          <span className="rounded-full bg-[#f5f4e8] px-3 py-1 ring-1 ring-[#d3c3c0]/70">Followers: {profile.stats.followerCount}</span>
          <span className="rounded-full bg-[#f5f4e8] px-3 py-1 ring-1 ring-[#d3c3c0]/70">Following: {profile.stats.followingCount}</span>
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-[#ffffff] p-6 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <h2 className="font-serif text-xl text-[#271310]">Vehicles</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {profile.vehicles.length === 0 ? <p className="text-sm text-[#504442]">No vehicles available yet.</p> : null}
          {profile.vehicles.map((vehicle) => (
            <article key={vehicle.id} className="rounded-2xl bg-[#f5f4e8] p-5 ring-1 ring-[#d3c3c0]/70">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-serif text-lg text-[#271310]">
                    {vehicle.manufacturer} {vehicle.model}
                  </h3>
                  <p className="mt-1 text-sm text-[#504442]">Unique ID: {vehicle.uniqueIdentifier}</p>
                  <p className="text-sm text-[#504442]">Plate: {vehicle.licensePlate ?? "Not set"}</p>
                </div>
                <span className="rounded-full bg-[#ffffff] px-2 py-1 text-xs text-[#725a39] ring-1 ring-[#d3c3c0]/70">
                  {vehicle.visibility}
                </span>
              </div>

              <p className="mt-2 text-xs text-[#765f5c]">
                Events: {vehicle._count.events} • Photos: {vehicle._count.photos}
              </p>

              <Link href={`/vehicles/${vehicle.id}`} className="mt-4 inline-block text-sm font-semibold text-[#725a39] hover:text-[#271310]">
                View Vehicle
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
