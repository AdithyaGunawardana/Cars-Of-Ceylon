import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { followUser, loadProfile, unfollowUser } from "@/lib/api";
import { useSession } from "@/lib/session-context";
import { palette, styles } from "@/lib/theme";
import { errorMessage } from "@/components/ui";
import type { Profile } from "@/lib/types";

export function ProfileView({ userId }: { userId: string }) {
  const router = useRouter();
  const { session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setMessage(null);
        const payload = await loadProfile(userId);
        if (!active) return;
        setProfile(payload);
        setFollowing(payload.relationship.isFollowing);
      } catch (err) {
        if (active) setMessage(errorMessage(err, "Failed to load profile."));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [userId]);

  async function toggleFollow() {
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
      } else {
        await followUser(userId);
        setFollowing(true);
      }
    } catch (err) {
      setMessage(errorMessage(err, "Follow action failed."));
    }
  }

  if (loading || !profile) {
    return (
      <View style={styles.rootCentered}>
        <ActivityIndicator color={palette.primary} />
        {message ? <Text style={styles.errorText}>{message}</Text> : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.screenCard}>
        <Text style={styles.kicker}>Community profile</Text>
        <Text style={styles.heroTitle}>{profile.user.name ?? "User profile"}</Text>
        <Text style={styles.sectionMeta}>{profile.user.email ?? "No email available"}</Text>
        <Text style={styles.bodyText}>
          {typeof profile.user.profile === "object" && profile.user.profile ? JSON.stringify(profile.user.profile) : "No bio added yet."}
        </Text>
        {userId !== session?.user.id ? (
          <Pressable onPress={toggleFollow} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{following ? "Unfollow" : "Follow"}</Text>
          </Pressable>
        ) : null}
        <View style={styles.chipRow}>
          <View style={styles.chip}><Text style={styles.chipText}>Vehicles: {profile.stats.vehicleCount}</Text></View>
          <View style={styles.chip}><Text style={styles.chipText}>Followers: {profile.stats.followerCount}</Text></View>
          <View style={styles.chip}><Text style={styles.chipText}>Following: {profile.stats.followingCount}</Text></View>
        </View>
      </View>

      <View style={styles.screenCard}>
        <Text style={styles.sectionTitle}>Vehicles</Text>
        {profile.vehicles.map((vehicle) => (
          <Pressable key={vehicle.id} style={styles.listCard} onPress={() => router.push({ pathname: "/vehicles/[id]", params: { id: vehicle.id } })}>
            <Text style={styles.cardTitle}>{vehicle.manufacturer} {vehicle.model}</Text>
            <Text style={styles.cardMeta}>{vehicle.uniqueIdentifier}</Text>
            <Text style={styles.cardMeta}>{vehicle.licensePlate ?? "Not set"}</Text>
          </Pressable>
        ))}
      </View>

      {message ? <Text style={styles.sectionMeta}>{message}</Text> : null}
    </ScrollView>
  );
}
