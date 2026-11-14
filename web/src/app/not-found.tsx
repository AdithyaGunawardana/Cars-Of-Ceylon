import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 px-6 py-24">
      <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">404</p>
      <h1 className="font-serif text-3xl text-[#271310]">We could not find that page</h1>
      <p className="text-sm text-[#504442]">It may have been removed, hidden, or never existed.</p>
      <Link
        href="/vehicles"
        className="rounded-full bg-[#271310] px-4 py-2 text-sm font-semibold text-[#fbfaee] hover:bg-[#3e2723]"
      >
        Browse vehicles
      </Link>
    </main>
  );
}
