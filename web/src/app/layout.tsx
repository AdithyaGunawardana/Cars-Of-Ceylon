import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cars of Ceylon",
  description: "A web archive for Sri Lankan vehicle history, photos, and timelines.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthSession();

  // Load role once for layout-level navigation gating.
  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, name: true, email: true },
      })
    : null;

  const canAccessModeration = currentUser?.role === "MODERATOR" || currentUser?.role === "ADMIN";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-950 text-zinc-100 flex flex-col">
        <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-3 md:px-10">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-sm font-semibold tracking-wide text-amber-300 hover:text-amber-200">
                Cars of Ceylon
              </Link>
              <Link href="/vehicles" className="text-sm text-zinc-200 hover:text-white">
                Vehicles
              </Link>
              <Link href="/vehicles/new" className="text-sm text-zinc-200 hover:text-white">
                Add Vehicle
              </Link>
              {canAccessModeration ? (
                <Link href="/moderation/reports" className="text-sm text-zinc-200 hover:text-white">
                  Moderation
                </Link>
              ) : null}
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-300">
              {currentUser ? (
                <>
                  <span className="hidden sm:inline">{currentUser.name ?? currentUser.email ?? "Signed in"}</span>
                  <Link
                    href="/api/auth/signout?callbackUrl=/"
                    className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800"
                  >
                    Sign Out
                  </Link>
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800"
                >
                  Sign In
                </Link>
              )}
            </div>
          </nav>
        </header>

        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
