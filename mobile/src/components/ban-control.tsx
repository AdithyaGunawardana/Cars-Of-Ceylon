import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { banUser } from "@/lib/api";
import { palette, styles } from "@/lib/theme";
import { DangerButton, Notice, PrimaryButton, SecondaryButton, errorMessage } from "@/components/ui";

// Moderator-only account suspension. The profile does not expose the current ban state, so both actions are offered
// and the server answers if the account is already in that state.
export function BanControl({ userId, userName }: { userId: string; userName: string }) {
  const [mode, setMode] = useState<"ban" | "unban" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  async function submit() {
    if (mode === "ban" && reason.trim().length < 3) {
      setMessage({ text: "A reason is required to suspend an account.", tone: "error" });
      return;
    }
    try {
      setBusy(true);
      await banUser(userId, { banned: mode === "ban", ...(reason.trim() ? { reason: reason.trim() } : {}) });
      setMessage({ text: mode === "ban" ? `${userName} was suspended.` : `${userName}'s suspension was lifted.`, tone: "info" });
      setMode(null);
      setReason("");
    } catch (err) {
      setMessage({ text: errorMessage(err, "Moderation action failed."), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screenCard}>
      <Text style={styles.sectionTitle}>Moderator actions</Text>
      {mode ? (
        <View style={{ gap: 8 }}>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={mode === "ban" ? "Reason (required, shown in the audit log)" : "Note (optional)"}
            placeholderTextColor={palette.muted}
            style={styles.input}
          />
          <View style={styles.actionRow}>
            {mode === "ban" ? <DangerButton label="Suspend account" onPress={submit} disabled={busy} /> : <PrimaryButton label="Lift suspension" onPress={submit} disabled={busy} />}
            <SecondaryButton label="Cancel" onPress={() => setMode(null)} />
          </View>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <SecondaryButton label="Suspend user" onPress={() => setMode("ban")} />
          <SecondaryButton label="Lift suspension" onPress={() => setMode("unban")} />
        </View>
      )}
      <Notice text={message?.text ?? null} tone={message?.tone} />
    </View>
  );
}
