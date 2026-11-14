import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/auth";
import { AccountSettingsForm } from "@/components/account-settings-form";
import { prisma } from "@/lib/prisma";

export default async function AccountPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, profile: true },
  });
  if (!user) redirect("/login?callbackUrl=/account");

  const bio = user.profile && typeof user.profile === "object" ? (user.profile as { bio?: unknown }).bio : "";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Account</p>
        <h1 className="font-serif text-3xl text-[#271310]">Settings</h1>
        <p className="mt-1 text-sm text-[#504442]">Signed in as {user.email}</p>
      </div>
      <Link href="/account/vehicles" className="w-fit text-sm font-semibold text-[#725a39] hover:text-[#271310]">
        Deleted vehicles (restore within 30 days)
      </Link>
      <AccountSettingsForm
        initial={{ name: user.name ?? "", bio: typeof bio === "string" ? bio : "", image: user.image ?? "" }}
      />
    </main>
  );
}
