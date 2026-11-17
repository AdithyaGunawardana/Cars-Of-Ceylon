import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { createReport, listReports, updateReportStatus } from "@/lib/api";
import { useSession } from "@/lib/session-context";
import { palette, styles } from "@/lib/theme";
import { TabButton, errorMessage } from "@/components/ui";
import type { ReportItem } from "@/lib/types";

export default function ReportsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [vehicleId, setVehicleId] = useState("");
  const [reason, setReason] = useState("");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [status, setStatus] = useState<string>("");
  // Role comes from the web session (UI hint only; the API re-checks permissions on every call).
  const isModerator = session?.user.role === "MODERATOR" || session?.user.role === "ADMIN";
  // Only moderators load the queue, so everyone else starts out "not loading" (no state change needed in the effect).
  const [loading, setLoading] = useState(isModerator);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isModerator) return;
    let active = true;

    async function loadQueue() {
      try {
        setLoading(true);
        setQueueMessage(null);
        const payload = await listReports({ status: status || undefined, page: 1, pageSize: 10 });
        if (active) setReports(payload.items);
      } catch (err) {
        if (active) setQueueMessage(errorMessage(err, "Failed to load report queue."));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadQueue();
    return () => {
      active = false;
    };
  }, [status, isModerator]);

  async function submitReport() {
    if (!vehicleId.trim() || reason.trim().length < 5) {
      setSubmitMessage("Enter the vehicle ID and a reason of at least 5 characters. Tip: you can also report from a vehicle's page.");
      return;
    }
    try {
      await createReport({ vehicleId: vehicleId.trim(), reason: reason.trim() });
      setSubmitMessage("Report submitted.");
      setVehicleId("");
      setReason("");
    } catch (err) {
      setSubmitMessage(errorMessage(err, "Failed to submit report."));
    }
  }

  async function updateStatus(reportId: string, nextStatus: "REVIEWING" | "RESOLVED" | "REJECTED") {
    try {
      await updateReportStatus(reportId, nextStatus);
      const payload = await listReports({ status: status || undefined, page: 1, pageSize: 10 });
      setReports(payload.items);
    } catch (err) {
      setQueueMessage(errorMessage(err, "Failed to update report."));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.screenCard}>
        <Text style={styles.sectionTitle}>Submit Report</Text>
        <TextInput value={vehicleId} onChangeText={setVehicleId} placeholder="Vehicle ID" autoCapitalize="none" style={styles.input} placeholderTextColor={palette.muted} />
        <TextInput value={reason} onChangeText={setReason} placeholder="Explain the issue (at least 5 characters)" style={[styles.input, styles.textArea]} multiline maxLength={2000} placeholderTextColor={palette.muted} />
        <Pressable onPress={submitReport} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Submit Report</Text></Pressable>
        {submitMessage ? <Text style={styles.sectionMeta}>{submitMessage}</Text> : null}
      </View>

      {isModerator ? (
        <View style={styles.screenCard}>
          <Text style={styles.sectionTitle}>Moderator Queue</Text>
          <View style={styles.modeRow}>
            <TabButton active={!status} label="All" onPress={() => setStatus("")} />
            <TabButton active={status === "PENDING"} label="Pending" onPress={() => setStatus("PENDING")} />
            <TabButton active={status === "REVIEWING"} label="Reviewing" onPress={() => setStatus("REVIEWING")} />
          </View>
          {loading ? <ActivityIndicator color={palette.primary} /> : null}
          {queueMessage ? <Text style={styles.errorText}>{queueMessage}</Text> : null}
          {reports.map((report) => (
            <View key={report.id} style={styles.listCard}>
              <Text style={styles.cardTitle}>{report.vehicle.manufacturer} {report.vehicle.model}</Text>
              <Text style={styles.cardMeta}>Status: {report.status}</Text>
              <Text style={styles.bodyText}>{report.reason}</Text>
              <Pressable onPress={() => router.push({ pathname: "/vehicles/[id]", params: { id: report.vehicle.id } })}>
                <Text style={styles.linkText}>Open vehicle</Text>
              </Pressable>
              {/* Mirror server workflow: PENDING -> REVIEWING -> RESOLVED | REJECTED. */}
              <View style={styles.actionRow}>
                {report.status === "PENDING" ? (
                  <Pressable onPress={() => updateStatus(report.id, "REVIEWING")} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Review</Text></Pressable>
                ) : null}
                {report.status === "REVIEWING" ? (
                  <>
                    <Pressable onPress={() => updateStatus(report.id, "RESOLVED")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Resolve</Text></Pressable>
                    <Pressable onPress={() => updateStatus(report.id, "REJECTED")} style={styles.dangerButton}><Text style={styles.primaryButtonText}>Reject</Text></Pressable>
                  </>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
