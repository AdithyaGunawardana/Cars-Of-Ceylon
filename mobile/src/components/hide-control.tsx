import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { hideContent } from "@/lib/api";
import { palette, styles } from "@/lib/theme";
import { DangerButton, Notice, PrimaryButton, SecondaryButton, errorMessage } from "@/components/ui";

type Props = {
  targetType: "VEHICLE" | "PHOTO" | "EVENT";
  targetId: string;
  hidden: boolean;
  onChanged: () => void | Promise<void>;
};

// Moderator-only: hide or restore a piece of content. Hiding must be explained, so it asks for a reason first.
export function HideControl({ targetType, targetId, hidden, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (reason.trim().length < 3) {
      setError("Give a reason (at least 3 characters).");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      await hideContent({ targetType, targetId, hidden: !hidden, reason: reason.trim() });
      setOpen(false);
      setReason("");
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Moderation action failed."));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <SecondaryButton label={hidden ? "Unhide (moderator)" : "Hide (moderator)"} onPress={() => setOpen(true)} />;
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionMeta}>{hidden ? "Why is this being restored?" : "Why is this being hidden?"}</Text>
      <TextInput value={reason} onChangeText={setReason} placeholder="Reason (recorded in the audit log)" placeholderTextColor={palette.muted} style={styles.input} />
      <Notice text={error} tone="error" />
      <View style={styles.actionRow}>
        {hidden ? <PrimaryButton label="Unhide" onPress={submit} disabled={busy} /> : <DangerButton label="Hide" onPress={submit} disabled={busy} />}
        <SecondaryButton label="Cancel" onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}
