import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { listModerationLog } from "@/lib/api";
import { formatDate, labelForOption } from "@/lib/format";
import { palette, styles } from "@/lib/theme";
import type { ModerationLogItem, Pagination } from "@/lib/types";
import { Notice, SecondaryButton, errorMessage } from "@/components/ui";

export default function ModerationLogScreen() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ModerationLogItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const payload = await listModerationLog({ page });
        if (!active) return;
        setItems(payload.items);
        setPagination(payload.pagination);
      } catch (err) {
        if (active) setError(errorMessage(err, "Could not load the audit log."));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [page]);

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}
      ListHeaderComponent={
        <View style={{ gap: 8, paddingBottom: 4 }}>
          <Text style={styles.sectionTitle}>Audit log</Text>
          <Text style={styles.sectionMeta}>Every moderator action, newest first.</Text>
          {loading ? <ActivityIndicator color={palette.primary} /> : null}
          <Notice text={error} tone="error" />
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.listCard}>
          <Text style={styles.cardTitle}>{labelForOption(item.action)}</Text>
          <Text style={styles.cardMeta}>
            {labelForOption(item.targetType)} {item.targetId}
          </Text>
          {item.reason ? <Text style={styles.bodyText}>{item.reason}</Text> : null}
          <Text style={styles.cardMeta}>
            {item.actor.name ?? "Unknown"} • {formatDate(item.createdAt)}
          </Text>
        </View>
      )}
      ListEmptyComponent={!loading && !error ? <Text style={styles.sectionMeta}>No moderation actions recorded yet.</Text> : undefined}
      ListFooterComponent={
        <View style={styles.paginationRow}>
          <SecondaryButton label="Prev" onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1} />
          <Text style={styles.sectionMeta}>
            Page {pagination.page} of {pagination.totalPages || 1}
          </Text>
          <SecondaryButton label="Next" onPress={() => setPage((p) => p + 1)} disabled={pagination.page >= pagination.totalPages} />
        </View>
      }
    />
  );
}
