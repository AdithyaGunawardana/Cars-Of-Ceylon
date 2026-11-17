import { useState } from "react";
import { Alert, Linking, Pressable, Text, TextInput, View } from "react-native";
import { createVehicleEvent, deleteVehicleEvent, updateVehicleEvent } from "@/lib/api";
import { formatDate, isHttpUrl, labelForOption } from "@/lib/format";
import { palette, styles } from "@/lib/theme";
import { EVENT_TYPES, type VehicleEvent } from "@/lib/types";
import { ChoiceRow, DangerButton, Notice, PrimaryButton, SecondaryButton, errorMessage } from "@/components/ui";
import { HideControl } from "@/components/hide-control";

const SELECTABLE_TYPES = EVENT_TYPES.filter((type) => type !== "CREATED");

type Draft = { type: string; title: string; details: string; sourceUrl: string };
const emptyDraft: Draft = { type: "NOTE", title: "", details: "", sourceUrl: "" };

function validateDraft(draft: Draft): string | null {
  const title = draft.title.trim();
  if (title.length < 2 || title.length > 140) return "Title must be 2-140 characters.";
  if (draft.details.trim().length > 5000) return "Details are too long.";
  if (draft.sourceUrl.trim() && !isHttpUrl(draft.sourceUrl)) return "Source link must start with http:// or https://";
  return null;
}

function DraftFields({ draft, onChange }: { draft: Draft; onChange: (draft: Draft) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <ChoiceRow options={SELECTABLE_TYPES} value={draft.type} onChange={(type) => onChange({ ...draft, type: type || draft.type })} />
      <TextInput value={draft.title} onChangeText={(title) => onChange({ ...draft, title })} placeholder="Title" placeholderTextColor={palette.muted} style={styles.input} />
      <TextInput value={draft.details} onChangeText={(details) => onChange({ ...draft, details })} placeholder="Details (optional)" placeholderTextColor={palette.muted} style={[styles.input, styles.textArea]} multiline />
      <TextInput value={draft.sourceUrl} onChangeText={(sourceUrl) => onChange({ ...draft, sourceUrl })} placeholder="Source link (optional)" placeholderTextColor={palette.muted} autoCapitalize="none" keyboardType="url" style={styles.input} />
    </View>
  );
}

type Props = {
  vehicleId: string;
  events: VehicleEvent[];
  canManage: boolean;
  isModerator: boolean;
  onChanged: () => Promise<void>;
};

export function TimelineSection({ vehicleId, events, canManage, isModerator, onChanged }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      await onChanged();
      setMessage({ text: success, tone: "info" });
    } catch (err) {
      setMessage({ text: errorMessage(err, "Something went wrong."), tone: "error" });
    }
  }

  function addEvent() {
    const problem = validateDraft(draft);
    if (problem) return setMessage({ text: problem, tone: "error" });
    run(async () => {
      await createVehicleEvent(vehicleId, {
        type: draft.type,
        title: draft.title.trim(),
        details: draft.details.trim() || null,
        sourceUrl: draft.sourceUrl.trim() || null,
      });
      setDraft(emptyDraft);
    }, "Event added.");
  }

  function saveEdit(event: VehicleEvent) {
    const problem = validateDraft(editDraft);
    if (problem) return setMessage({ text: problem, tone: "error" });
    run(async () => {
      await updateVehicleEvent(vehicleId, event.id, {
        type: editDraft.type,
        title: editDraft.title.trim(),
        details: editDraft.details.trim() || null,
        sourceUrl: editDraft.sourceUrl.trim() || null,
      });
      setEditingId(null);
    }, "Event updated.");
  }

  function confirmDelete(eventId: string) {
    Alert.alert("Delete event", "Remove this timeline item?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => run(() => deleteVehicleEvent(vehicleId, eventId), "Event deleted.") },
    ]);
  }

  return (
    <View style={styles.screenCard}>
      <Text style={styles.sectionTitle}>Timeline</Text>

      {canManage ? (
        <View style={{ gap: 8 }}>
          <DraftFields draft={draft} onChange={setDraft} />
          <SecondaryButton label="Add event" onPress={addEvent} />
        </View>
      ) : null}
      <Notice text={message?.text ?? null} tone={message?.tone} />

      {events.length === 0 ? <Text style={styles.sectionMeta}>No events recorded yet.</Text> : null}
      {events.map((event) => (
        <View key={event.id} style={styles.listCard}>
          {editingId === event.id ? (
            <>
              <DraftFields draft={editDraft} onChange={setEditDraft} />
              <View style={styles.actionRow}>
                <PrimaryButton label="Save event" onPress={() => saveEdit(event)} />
                <SecondaryButton label="Cancel" onPress={() => setEditingId(null)} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>{event.title}</Text>
              <Text style={styles.cardMeta}>
                {labelForOption(event.type)}
                {event.occurredAt || event.createdAt ? ` • ${formatDate(event.occurredAt ?? event.createdAt)}` : ""}
                {event.hiddenAt ? " • Hidden" : ""}
              </Text>
              {event.details ? <Text style={styles.bodyText}>{event.details}</Text> : null}
              {event.sourceUrl && isHttpUrl(event.sourceUrl) ? (
                <Pressable onPress={() => Linking.openURL(event.sourceUrl!)}>
                  <Text style={styles.linkText}>Open source</Text>
                </Pressable>
              ) : null}
              {canManage ? (
                <View style={styles.actionRow}>
                  <SecondaryButton
                    label="Edit"
                    onPress={() => {
                      setEditingId(event.id);
                      setEditDraft({ type: event.type, title: event.title, details: event.details ?? "", sourceUrl: event.sourceUrl ?? "" });
                    }}
                  />
                  <DangerButton label="Delete" onPress={() => confirmDelete(event.id)} />
                </View>
              ) : null}
              {isModerator ? <HideControl targetType="EVENT" targetId={event.id} hidden={Boolean(event.hiddenAt)} onChanged={onChanged} /> : null}
            </>
          )}
        </View>
      ))}
    </View>
  );
}
