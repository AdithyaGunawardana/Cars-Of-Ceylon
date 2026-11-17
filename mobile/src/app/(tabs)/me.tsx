import { ProfileView } from "@/components/profile-view";
import { useSession } from "@/lib/session-context";

export default function MyProfileScreen() {
  const { session } = useSession();
  // The tab is unmounted by the auth guard on sign-out; render nothing for the frame in between.
  if (!session) return null;
  return <ProfileView userId={session.user.id} />;
}
