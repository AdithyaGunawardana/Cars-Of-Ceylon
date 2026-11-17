import type { Metadata } from "next";
import Link from "next/link";
import { Manrope, Noto_Serif } from "next/font/google";
import { getAuthSession } from "@/auth";
import { MobileMenu } from "@/components/mobile-menu";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
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
  metadataBase: new URL(getSiteUrl()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_LK" },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthSession();

  // Role comes from the JWT (refreshed periodically); pages and API routes re-check permissions server-side.
  const currentUser = session?.user?.id
    ? { id: session.user.id, role: session.user.role, name: session.user.name, email: session.user.email }
    : null;

  const canAccessModeration = currentUser?.role === "MODERATOR" || currentUser?.role === "ADMIN";

  // One list drives both the inline desktop links and the phone dropdown, so they can never drift apart.
  const navLinks = [
    { href: "/vehicles", label: "Vehicles" },
    { href: "/vehicles/new", label: "Add Vehicle" },
    ...(currentUser
      ? [
          { href: `/users/${currentUser.id}`, label: "Profile" },
          { href: "/feed", label: "Following" },
          { href: "/account", label: "Settings" },
        ]
      : []),
    ...(canAccessModeration
      ? [
          { href: "/moderation/reports", label: "Moderation" },
          { href: "/moderation/log", label: "Audit log" },
        ]
      : []),
  ];

  const authButtonClass = "rounded-full border border-[#d3c3c0] px-3 py-1.5 text-[#271310] hover:bg-[#f5f4e8]";

  return (
    <html
      lang="en"
      className={`${manrope.variable} ${notoSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] flex flex-col">
        <header className="border-b border-[#d3c3c0]/70 bg-[#fbfaee]/95 backdrop-blur-md">
          <nav
            aria-label="Main"
            className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:px-10"
          >
            <div className="flex min-w-0 items-center gap-4">
              <Link
                href="/"
                className="shrink-0 whitespace-nowrap font-serif text-sm font-semibold tracking-wide text-[#271310] hover:text-[#725a39]"
              >
                Cars of Ceylon
              </Link>
              {/* Desktop: all links inline. Phones use the dropdown below. */}
              <div className="hidden items-center gap-4 md:flex">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="text-sm text-[#504442] hover:text-[#271310]">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-xs text-[#504442]">
              {currentUser ? (
                <>
                  <span className="hidden max-w-[10rem] truncate sm:inline">
                    {currentUser.name ?? currentUser.email ?? "Signed in"}
                  </span>
                  {/* prefetch off: this is an action URL, there is nothing to warm up. */}
                  <Link href="/api/auth/signout?callbackUrl=/" prefetch={false} className={authButtonClass}>
                    Sign Out
                  </Link>
                </>
              ) : (
                <Link href="/login" className={authButtonClass}>
                  Sign In
                </Link>
              )}
              <MobileMenu>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-xl px-3 py-2 text-sm text-[#271310] hover:bg-[#f5f4e8]"
                  >
                    {link.label}
                  </Link>
                ))}
              </MobileMenu>
            </div>
          </nav>
        </header>

        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
