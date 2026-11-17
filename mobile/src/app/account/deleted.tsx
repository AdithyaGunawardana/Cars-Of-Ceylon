import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { listDeletedVehicles, restoreVehicle } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { palette, styles } from "@/lib/theme";
import type { DeletedVehicle } from "@/lib/types";
import { Notice, PrimaryButton, errorMessage } from "@/components/ui";

export default function DeletedVehiclesScreen() {
  const [items, setItems] = useState<DeletedVehicle[] | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await listDeletedVehicles());
    } catch (err) {
      setItems([]);
      setMessage({ text: errorMessage(err, "Could not load deleted vehicles."), tone: "error" });
    }
  }, []);

  useEffect(() => {
    // Load once on open; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function restore(id: string) {
    try {
      await restoreVehicle(id);
      setMessage({ text: "Vehicle restored.", tone: "info" });
      await reload();
    } catch (err) {
      setMessage({ text: errorMessage(err, "Could not restore the vehicle."), tone: "error" });
    }
  }

  if (!items) {
    return (
      <View style={styles.rootCentered}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.screenCard}>
        <Text style={styles.sectionTitle}>Deleted vehicles</Text>
        <Text style={styles.sectionMeta}>Deleted vehicles can be restored for 30 days. After that they, and their timeline and photos, are permanently erased.</Text>
        <Notice text={message?.text ?? null} tone={message?.tone} />
        {items.length === 0 ? <Text style={styles.bodyText}>You have no deleted vehicles.</Text> : null}
        {items.map((vehicle) => (
          <View key={vehicle.id} style={styles.listCard}>
            <Text style={styles.cardTitle}>
              {vehicle.manufacturer} {vehicle.model} ({vehicle.year})
            </Text>
            <Text style={styles.cardMeta}>ID {vehicle.uniqueIdentifier}</Text>
            <Text style={styles.cardMeta}>
              Deleted {formatDate(vehicle.deletedAt)} • erased on {formatDate(vehicle.purgeOn)}
            </Text>
            {vehicle.restorable ? (
              <PrimaryButton label="Restore" onPress={() => restore(vehicle.id)} />
            ) : (
              <Text style={styles.cardMeta}>Removed by a moderator, so only a moderator can restore it.</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
