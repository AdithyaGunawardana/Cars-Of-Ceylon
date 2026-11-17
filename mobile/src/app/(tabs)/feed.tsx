import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { loadFeed } from "@/lib/api";
import { mediaUrl } from "@/lib/config";
import { formatDate, labelForOption } from "@/lib/format";
import { palette, styles } from "@/lib/theme";
import type { FeedItem } from "@/lib/types";
import { Notice, SecondaryButton, errorMessage } from "@/components/ui";

function describe(item: FeedItem) {
  switch (item.kind) {
    case "VEHICLE":
      return "added a vehicle";
    case "EVENT":
      return `logged ${labelForOption(item.eventType).toLowerCase()}: ${item.title}`;
    case "PHOTO":
      return item.caption ? `added a photo: ${item.caption}` : "added a photo";
  }
}

export default function FeedScreen() {
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number) => {
    try {
      setLoading(true);
      setError(null);
      const payload = await loadFeed(nextPage);
      // Page 1 replaces the list (pull to refresh); later pages append.
      setItems((current) => (nextPage === 1 ? payload.items : [...current, ...payload.items]));
      setPage(nextPage);
      setTotalPages(payload.pagination.totalPages);
      setFollowingCount(payload.followingCount);
    } catch (err) {
      setError(errorMessage(err, "Failed to load your feed."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load; `load` sets state only after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(1);
  }, [load]);

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => `${item.kind}-${item.id}`}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}
      refreshing={loading && page === 1}
      onRefresh={() => load(1)}
      ListHeaderComponent={
        <View style={{ gap: 8, paddingBottom: 4 }}>
          <Text style={styles.sectionTitle}>Following</Text>
          <Text style={styles.sectionMeta}>New vehicles, timeline events and photos from people you follow.</Text>
          <Notice text={error} tone="error" />
        </View>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.listCard} onPress={() => router.push({ pathname: "/vehicles/[id]", params: { id: item.vehicle.id } })}>
          <Text style={styles.cardTitle}>
            {item.vehicle.manufacturer} {item.vehicle.model} ({item.vehicle.year})
          </Text>
          <Text style={styles.bodyText}>
            <Text style={{ fontWeight: "700" }}>{item.actor.name ?? "Someone"}</Text> {describe(item)}
          </Text>
          {item.kind === "PHOTO" ? <Image source={{ uri: mediaUrl(item.url) }} style={styles.photoImage} /> : null}
          <Text style={styles.cardMeta}>{formatDate(item.createdAt)}</Text>
        </Pressable>
      )}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={palette.primary} />
        ) : error ? undefined : (
          <Text style={styles.sectionMeta}>
            {followingCount === 0 ? "You are not following anyone yet. Open a profile and tap Follow." : "Nothing new from the people you follow."}
          </Text>
        )
      }
      ListFooterComponent={
        page < totalPages ? (
          <View style={{ paddingVertical: 12 }}>
            <SecondaryButton label={loading ? "Loading..." : "Load more"} onPress={() => load(page + 1)} disabled={loading} />
          </View>
        ) : undefined
      }
    />
  );
}
