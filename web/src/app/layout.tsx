import type { Metadata } from "next";
import Link from "next/link";
import { Manrope, Noto_Serif } from "next/font/google";
import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
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
      className={`${manrope.variable} ${notoSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] flex flex-col">
        <header className="border-b border-[#d3c3c0]/70 bg-[#fbfaee]/95 backdrop-blur-md">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-3 md:px-10">
            <div className="flex items-center gap-3">
              <Link href="/" className="font-serif text-sm font-semibold tracking-wide text-[#271310] hover:text-[#725a39]">
                Cars of Ceylon
              </Link>
              <Link href="/vehicles" className="text-sm text-[#504442] hover:text-[#271310]">
                Vehicles
              </Link>
              <Link href="/vehicles/new" className="text-sm text-[#504442] hover:text-[#271310]">
                Add Vehicle
              </Link>
              {currentUser ? (
                <Link href={`/users/${currentUser.id}`} className="text-sm text-[#504442] hover:text-[#271310]">
                  Profile
                </Link>
              ) : null}
              {canAccessModeration ? (
                <Link href="/moderation/reports" className="text-sm text-[#504442] hover:text-[#271310]">
                  Moderation
                </Link>
              ) : null}
            </div>

            <div className="flex items-center gap-3 text-xs text-[#504442]">
              {currentUser ? (
                <>
                  <span className="hidden sm:inline">{currentUser.name ?? currentUser.email ?? "Signed in"}</span>
                  <Link
                    href="/api/auth/signout?callbackUrl=/"
                    className="rounded-full border border-[#d3c3c0] px-3 py-1.5 text-[#271310] hover:bg-[#f5f4e8]"
                  >
                    Sign Out
                  </Link>
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full border border-[#d3c3c0] px-3 py-1.5 text-[#271310] hover:bg-[#f5f4e8]"
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
