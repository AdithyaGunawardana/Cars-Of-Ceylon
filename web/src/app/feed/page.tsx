import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/auth";
import { listFollowFeed } from "@/lib/feed-queries";

export const metadata: Metadata = { title: "Following", robots: { index: false } };

const PAGE_SIZE = 20;

function describe(item: Awaited<ReturnType<typeof listFollowFeed>>["items"][number]) {
  if (item.kind === "VEHICLE") return "added a vehicle";
  if (item.kind === "EVENT") return `logged "${item.title}"`;
  return "added a photo";
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/feed");

  const requested = Number((await searchParams).page);
  const page = Number.isInteger(requested) && requested >= 1 && requested <= 100 ? requested : 1;
  const { items, pagination, followingCount } = await listFollowFeed(session.user.id, page, PAGE_SIZE);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Following</p>
        <h1 className="font-serif text-3xl text-[#271310]">Your feed</h1>
      </div>

      {followingCount === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-[#504442] ring-1 ring-[#d3c3c0]/70">
          You are not following anyone yet. Follow collectors from their profile pages, or{" "}
          <Link href="/vehicles" className="font-semibold text-[#725a39]">browse the archive</Link> to find some.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#504442]">The people you follow have no public activity yet.</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="rounded-2xl bg-white p-4 ring-1 ring-[#d3c3c0]/70">
              <p className="text-sm text-[#271310]">
                <Link href={`/users/${item.actor.id}`} className="font-semibold text-[#725a39] hover:text-[#271310]">
                  {item.actor.name ?? "A member"}
                </Link>{" "}
                {describe(item)} on{" "}
                <Link href={`/vehicles/${item.vehicle.id}`} className="font-semibold hover:text-[#725a39]">
                  {item.vehicle.year} {item.vehicle.manufacturer} {item.vehicle.model}
                </Link>
              </p>
              {item.kind === "PHOTO" ? (
                <>
                  {/* Plain <img>: photos are served from the storage host, not optimized by next/image. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.caption ?? "Vehicle photo"} className="mt-3 max-h-64 rounded-xl object-cover" />
                </>
              ) : null}
              <time dateTime={item.createdAt.toISOString()} className="mt-2 block text-xs text-[#765f5c]">
                {item.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
              </time>
            </li>
          ))}
        </ul>
      )}

      {pagination.totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/feed?page=${page - 1}`} className="font-semibold text-[#725a39]">Previous</Link> : <span />}
          <span className="text-[#504442]">Page {page} of {pagination.totalPages}</span>
          {page < pagination.totalPages ? <Link href={`/feed?page=${page + 1}`} className="font-semibold text-[#725a39]">Next</Link> : <span />}
        </nav>
      ) : null}
    </main>
  );
}
