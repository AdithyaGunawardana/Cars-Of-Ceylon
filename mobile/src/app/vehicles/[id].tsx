import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { createReport, deleteVehicle, getVehicle, updateVehicle } from "@/lib/api";
import { attributeRows } from "@/lib/format";
import { useSession } from "@/lib/session-context";
import { palette, styles } from "@/lib/theme";
import { fieldsFromVehicle } from "@/lib/vehicle-form";
import type { VehicleDetail } from "@/lib/types";
import { DangerButton, Notice, SecondaryButton, TabButton, errorMessage } from "@/components/ui";
import { HideControl } from "@/components/hide-control";
import { PhotosSection } from "@/components/photos-section";
import { TimelineSection } from "@/components/timeline-section";
import { VehicleForm } from "@/components/vehicle-form";

export default function VehicleDetailScreen() {
  const { id: vehicleId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportMessage, setReportMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const refresh = useCallback(async () => {
    const payload = await getVehicle(vehicleId);
    setVehicle(payload.vehicle);
  }, [vehicleId]);

  useEffect(() => {
    let active = true;
    getVehicle(vehicleId)
      .then((payload) => active && setVehicle(payload.vehicle))
      .catch((err) => active && setLoadError(errorMessage(err, "Failed to load vehicle.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [vehicleId]);

  if (loading || !vehicle) {
    return (
      <View style={styles.rootCentered}>
        {loading ? <ActivityIndicator color={palette.primary} /> : null}
        <Notice text={loadError} tone="error" />
      </View>
    );
  }

  // UI hints only; the API re-checks ownership/role on every write.
  const role = session?.user.role;
  const isModerator = role === "MODERATOR" || role === "ADMIN";
  const isOwner = session?.user.id === vehicle.createdBy.id;
  const canManage = isOwner || isModerator;
  const rows = attributeRows(vehicle.attributes);

  function confirmDelete() {
    Alert.alert("Delete vehicle", "It can be restored from Account > Deleted vehicles for 30 days.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteVehicle(vehicleId);
            router.back();
          } catch (err) {
            setMessage({ text: errorMessage(err, "Failed to delete vehicle."), tone: "error" });
          }
        },
      },
    ]);
  }

  async function submitReport() {
    try {
      await createReport({ vehicleId, reason: reportReason.trim() });
      setReportReason("");
      setReportMessage({ text: "Report submitted. A moderator will review it.", tone: "info" });
    } catch (err) {
      setReportMessage({ text: errorMessage(err, "Failed to submit report."), tone: "error" });
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.screenCard}>
        <Text style={styles.kicker}>Vehicle record</Text>
        <Text style={styles.heroTitle}>
          {vehicle.manufacturer} {vehicle.model}
        </Text>
        <Text style={styles.sectionMeta}>Year: {vehicle.year}</Text>
        <Text style={styles.sectionMeta}>Unique ID: {vehicle.uniqueIdentifier}</Text>
        <Text style={styles.sectionMeta}>License plate: {vehicle.licensePlate ?? "Not set"}</Text>
        {vehicle.visibility === "PRIVATE" ? <Text style={styles.sectionMeta}>Private - only you and moderators can see this.</Text> : null}
        {vehicle.hiddenAt ? <Text style={styles.errorText}>Hidden by a moderator.</Text> : null}
        {rows.length > 0 ? (
          <View style={styles.chipRow}>
            {rows.map((row) => (
              <View key={row.label} style={styles.chip}>
                <Text style={styles.chipText}>
                  {row.label}: {row.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.bodyText}>{vehicle.description ?? "No description added yet."}</Text>
        <Pressable onPress={() => router.push({ pathname: "/users/[id]", params: { id: vehicle.createdBy.id } })}>
          <Text style={styles.linkText}>Added by {vehicle.createdBy.name ?? vehicle.createdBy.email ?? "Unknown"}</Text>
        </Pressable>
      </View>

      {canManage ? (
        <View style={styles.screenCard}>
          <Text style={styles.sectionTitle}>Manage vehicle</Text>
          {editing ? (
            <>
              <VehicleForm
                initial={fieldsFromVehicle(vehicle)}
                submitLabel="Save changes"
                onSubmit={async (input) => {
                  await updateVehicle(vehicleId, input);
                  await refresh();
                  setEditing(false);
                  setMessage({ text: "Vehicle updated.", tone: "info" });
                }}
              />
              <SecondaryButton label="Cancel" onPress={() => setEditing(false)} />
            </>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={styles.modeRow}>
                <TabButton
                  active={vehicle.visibility !== "PRIVATE"}
                  label="Public"
                  onPress={async () => {
                    await updateVehicle(vehicleId, { visibility: "PUBLIC" }).then(refresh).catch((err) => setMessage({ text: errorMessage(err, "Update failed."), tone: "error" }));
                  }}
                />
                <TabButton
                  active={vehicle.visibility === "PRIVATE"}
                  label="Private"
                  onPress={async () => {
                    await updateVehicle(vehicleId, { visibility: "PRIVATE" }).then(refresh).catch((err) => setMessage({ text: errorMessage(err, "Update failed."), tone: "error" }));
                  }}
                />
              </View>
              <View style={styles.actionRow}>
                <SecondaryButton label="Edit details" onPress={() => setEditing(true)} />
                <DangerButton label="Delete vehicle" onPress={confirmDelete} />
              </View>
            </View>
          )}
          <Notice text={message?.text ?? null} tone={message?.tone} />
        </View>
      ) : null}

      <TimelineSection vehicleId={vehicleId} events={vehicle.events} canManage={canManage} isModerator={isModerator} onChanged={refresh} />
      <PhotosSection vehicleId={vehicleId} photos={vehicle.photos} canManage={canManage} isModerator={isModerator} onChanged={refresh} />

      {!isOwner ? (
        <View style={styles.screenCard}>
          <Text style={styles.sectionTitle}>Report this vehicle</Text>
          <TextInput value={reportReason} onChangeText={setReportReason} placeholder="Explain the issue (at least 5 characters)" placeholderTextColor={palette.muted} style={[styles.input, styles.textArea]} multiline maxLength={2000} />
          <SecondaryButton label="Submit report" onPress={submitReport} disabled={reportReason.trim().length < 5} />
          <Notice text={reportMessage?.text ?? null} tone={reportMessage?.tone} />
        </View>
      ) : null}

      {isModerator ? (
        <View style={styles.screenCard}>
          <Text style={styles.sectionTitle}>Moderator actions</Text>
          <HideControl targetType="VEHICLE" targetId={vehicle.id} hidden={Boolean(vehicle.hiddenAt)} onChanged={refresh} />
        </View>
      ) : null}
    </ScrollView>
  );
}
