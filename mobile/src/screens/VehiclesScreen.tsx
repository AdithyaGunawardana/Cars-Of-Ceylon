import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchVehicleDetail, fetchVehicles, type VehicleDetail, type VehicleListItem } from "../lib/api";

type Props = {
  onLogout: () => void;
};

export function VehiclesScreen({ onLogout }: Props) {
  const [items, setItems] = useState([] as VehicleListItem[]);
  const [selected, setSelected] = useState(null as VehicleDetail | null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null as string | null);

  async function loadVehicles() {
    // Pull first page from shared API so mobile mirrors web inventory behavior.
    setError(null);
    const data = await fetchVehicles();
    setItems(data);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadVehicles();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh vehicles.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSelectVehicle(id: string) {
    // Detail is loaded on demand to keep initial screen lightweight.
    setError(null);
    try {
      const detail = await fetchVehicleDetail(id);
      setSelected(detail);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Failed to load vehicle detail.");
    }
  }

  useEffect(() => {
    // Initial hydration of vehicle list on screen mount.
    loadVehicles()
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load vehicles.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Vehicles</Text>
        <Pressable onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#f59e0b" />}
      >
        {items.map((vehicle) => (
          <Pressable key={vehicle.id} onPress={() => handleSelectVehicle(vehicle.id)} style={styles.card}>
            <Text style={styles.cardTitle}>
              {vehicle.manufacturer} {vehicle.model}
            </Text>
            <Text style={styles.cardMeta}>UID: {vehicle.uniqueIdentifier}</Text>
            <Text style={styles.cardMeta}>Year: {vehicle.year}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {selected ? (
        <View style={styles.detailPanel}>
          {/* Simple bottom panel for MVP detail preview; full page can come next sprint. */}
          <Text style={styles.detailTitle}>
            {selected.manufacturer} {selected.model}
          </Text>
          <Text style={styles.detailMeta}>License: {selected.licensePlate ?? "Not set"}</Text>
          <Text style={styles.detailMeta}>Description: {selected.description ?? "No description"}</Text>
          <Text style={styles.detailMeta}>Events: {selected.events.length}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingTop: 56,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  headerRow: {
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    color: "#f8fafc",
    fontSize: 26,
    fontWeight: "700",
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600",
  },
  error: {
    color: "#fca5a5",
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  list: {
    flex: 1,
    paddingHorizontal: 14,
  },
  card: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 3,
  },
  cardTitle: {
    color: "#f8fafc",
    fontWeight: "700",
  },
  cardMeta: {
    color: "#cbd5e1",
    fontSize: 12,
  },
  detailPanel: {
    borderTopWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#111827",
    padding: 14,
    gap: 5,
  },
  detailTitle: {
    color: "#f8fafc",
    fontWeight: "700",
  },
  detailMeta: {
    color: "#cbd5e1",
    fontSize: 12,
  },
});
