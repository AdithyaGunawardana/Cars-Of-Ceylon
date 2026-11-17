import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { listVehicles } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks";
import { attributeRows } from "@/lib/format";
import { palette, styles } from "@/lib/theme";
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, type Pagination, type VehicleListItem, type VehicleSort } from "@/lib/types";
import { activeFilterCount, emptyFilters, SORT_OPTIONS, toQuery, type FilterState } from "@/lib/vehicle-filters";
import { ChoiceRow, Notice, PrimaryButton, SecondaryButton, TabButton, errorMessage } from "@/components/ui";

export default function VehiclesScreen() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [items, setItems] = useState<VehicleListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debounced = useDebouncedValue(filters);
  const query = useMemo(() => toQuery(debounced), [debounced]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const payload = await listVehicles({ ...query, page, pageSize: 10 });
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
  }, [query, page, reloadKey]);

  function change(patch: Partial<FilterState>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  const activeCount = activeFilterCount(filters);
  const field = (key: keyof FilterState, placeholder: string, extra: object = {}) => (
    <TextInput
      value={filters[key]}
      onChangeText={(value) => change({ [key]: value })}
      placeholder={placeholder}
      placeholderTextColor={palette.muted}
      style={styles.input}
      {...extra}
    />
  );

  const header = (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Vehicle Archive</Text>
          <Text style={styles.sectionMeta}>Browse and search Sri Lankan vehicle history records.</Text>
        </View>
        <PrimaryButton label="+ Add" onPress={() => router.push("/vehicles/new")} />
      </View>

      <TextInput
        value={filters.q}
        onChangeText={(q) => change({ q })}
        placeholder="Search make, model, plate, ID, history..."
        placeholderTextColor={palette.muted}
        style={styles.input}
        returnKeyType="search"
        autoCorrect={false}
      />
      <View style={styles.actionRow}>
        <SecondaryButton label={showFilters ? "Hide filters" : activeCount ? `Filters (${activeCount})` : "Filters & sort"} onPress={() => setShowFilters((v) => !v)} />
        {activeCount > 0 || filters.sort ? <SecondaryButton label="Clear" onPress={() => { setFilters(emptyFilters); setPage(1); }} /> : null}
      </View>

      {showFilters ? (
        <View style={[styles.listCard, { marginTop: 0 }]}>
          <Text style={styles.sectionMeta}>Sort by</Text>
          <View style={styles.modeRow}>
            {SORT_OPTIONS.map((option) => (
              <TabButton key={option.value} active={filters.sort === option.value} label={option.label} onPress={() => change({ sort: (filters.sort === option.value ? "" : option.value) as VehicleSort | "" })} />
            ))}
          </View>
          {field("manufacturer", "Manufacturer")}
          {field("model", "Model")}
          <View style={styles.actionRow}>
            <View style={{ flex: 1 }}>{field("yearFrom", "Year from", { keyboardType: "number-pad", maxLength: 4 })}</View>
            <View style={{ flex: 1 }}>{field("yearTo", "Year to", { keyboardType: "number-pad", maxLength: 4 })}</View>
          </View>
          {field("color", "Colour")}
          <Text style={styles.sectionMeta}>Fuel</Text>
          <ChoiceRow options={FUEL_TYPES} value={filters.fuelType} onChange={(fuelType) => change({ fuelType })} clearable />
          <Text style={styles.sectionMeta}>Transmission</Text>
          <ChoiceRow options={TRANSMISSIONS} value={filters.transmission} onChange={(transmission) => change({ transmission })} clearable />
          <Text style={styles.sectionMeta}>Body type</Text>
          <ChoiceRow options={BODY_TYPES} value={filters.bodyType} onChange={(bodyType) => change({ bodyType })} clearable />
        </View>
      ) : null}

      {loading ? <ActivityIndicator color={palette.primary} /> : null}
      <Notice text={error} tone="error" />
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshing={loading}
      onRefresh={() => setReloadKey((key) => key + 1)}
      ListHeaderComponent={header}
      renderItem={({ item }) => {
        const rows = attributeRows(item.attributes).slice(0, 3);
        return (
          <Pressable style={styles.listCard} onPress={() => router.push({ pathname: "/vehicles/[id]", params: { id: item.id } })}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {item.manufacturer} {item.model}
                </Text>
                <Text style={styles.cardMeta}>Unique ID: {item.uniqueIdentifier}</Text>
                <Text style={styles.cardMeta}>Plate: {item.licensePlate ?? "Not set"}</Text>
                <Text style={styles.cardMeta}>
                  Events: {item._count?.events ?? 0} • Photos: {item._count?.photos ?? 0}
                </Text>
                {rows.length > 0 ? <Text style={styles.cardMeta}>{rows.map((row) => row.value).join(" • ")}</Text> : null}
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
        );
      }}
      // FlatList's prop type no longer accepts null (React Native 0.88 types); undefined renders nothing.
      ListEmptyComponent={!loading && !error ? <Text style={styles.sectionMeta}>No vehicles matched your search.</Text> : undefined}
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
