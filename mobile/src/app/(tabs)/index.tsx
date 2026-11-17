import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { listVehicles } from "@/lib/api";
import { palette, styles } from "@/lib/theme";
import { errorMessage } from "@/components/ui";
import type { VehicleListItem } from "@/lib/types";

type Query = { manufacturer: string; model: string; year: string; search: string; page: number; pageSize: number };

export default function VehiclesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState<Query>({ manufacturer: "", model: "", year: "", search: "", page: 1, pageSize: 10 });
  const [items, setItems] = useState<VehicleListItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const payload = await listVehicles({
          manufacturer: query.manufacturer || undefined,
          model: query.model || undefined,
          year: query.year || undefined,
          search: query.search || undefined,
          page: query.page,
          pageSize: query.pageSize,
        });
        if (!active) return;
        setItems(payload.items);
        setPagination(payload.pagination);
      } catch (err) {
        if (active) setError(errorMessage(err, "Failed to load vehicles."));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [query]);

  function setFilter(patch: Partial<Query>) {
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  }

  return (
    <View style={[styles.screenCard, { flex: 1, marginHorizontal: 16, marginTop: 8 }]}>
      <Text style={styles.sectionTitle}>Vehicle Archive</Text>
      <Text style={styles.sectionMeta}>Browse and search Sri Lankan vehicle history records.</Text>

      <View style={styles.filterGrid}>
        <TextInput placeholder="Plate / Unique ID" value={query.search} onChangeText={(search) => setFilter({ search })} style={styles.input} placeholderTextColor={palette.muted} />
        <TextInput placeholder="Manufacturer" value={query.manufacturer} onChangeText={(manufacturer) => setFilter({ manufacturer })} style={styles.input} placeholderTextColor={palette.muted} />
        <TextInput placeholder="Model" value={query.model} onChangeText={(model) => setFilter({ model })} style={styles.input} placeholderTextColor={palette.muted} />
        <TextInput placeholder="Year" value={query.year} onChangeText={(year) => setFilter({ year })} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.muted} />
      </View>

      {loading ? <ActivityIndicator color={palette.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.listCard} onPress={() => router.push({ pathname: "/vehicles/[id]", params: { id: item.id } })}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {item.manufacturer} {item.model}
                </Text>
                <Text style={styles.cardMeta}>Unique ID: {item.uniqueIdentifier}</Text>
                <Text style={styles.cardMeta}>Plate: {item.licensePlate ?? "Not set"}</Text>
                <Text style={styles.cardMeta}>Events: {item._count?.events ?? 0} • Photos: {item._count?.photos ?? 0}</Text>
              </View>
              <View style={styles.yearBadge}>
                <Text style={styles.yearBadgeText}>{item.year}</Text>
              </View>
            </View>
            {item.createdBy?.id ? (
              <Pressable onPress={() => router.push({ pathname: "/users/[id]", params: { id: item.createdBy!.id } })}>
                <Text style={styles.linkText}>Added by {item.createdBy.name ?? "Unknown"}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        )}
        // FlatList's prop type no longer accepts null (React Native 0.88 types); undefined renders nothing.
        ListEmptyComponent={!loading ? <Text style={styles.sectionMeta}>No vehicles matched your filters.</Text> : undefined}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      />

      <View style={styles.paginationRow}>
        <Pressable
          onPress={() => setQuery((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
          disabled={pagination.page <= 1}
          style={[styles.secondaryButton, pagination.page <= 1 ? styles.buttonDisabled : null]}
        >
          <Text style={styles.secondaryButtonText}>Prev</Text>
        </Pressable>
        <Text style={styles.sectionMeta}>
          Page {pagination.page} of {pagination.totalPages || 1}
        </Text>
        <Pressable
          onPress={() => setQuery((current) => ({ ...current, page: Math.min(pagination.totalPages || 1, current.page + 1) }))}
          disabled={pagination.page >= pagination.totalPages}
          style={[styles.secondaryButton, pagination.page >= pagination.totalPages ? styles.buttonDisabled : null]}
        >
          <Text style={styles.secondaryButtonText}>Next</Text>
        </Pressable>
      </View>
    </View>
  );
}
