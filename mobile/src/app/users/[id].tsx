import { useLocalSearchParams } from "expo-router";
import { ProfileView } from "@/components/profile-view";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProfileView userId={id} />;
}
