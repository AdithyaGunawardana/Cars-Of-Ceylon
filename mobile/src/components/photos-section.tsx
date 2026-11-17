import { useState } from "react";
import { Alert, Image, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { deletePhoto, finalizePhoto, requestPhotoUpload, updatePhotoCaption } from "@/lib/api";
import { mediaUrl } from "@/lib/config";
import { palette, styles } from "@/lib/theme";
import { uploadWithProgress } from "@/lib/upload";
import type { VehiclePhoto } from "@/lib/types";
import { DangerButton, Notice, PrimaryButton, SecondaryButton, errorMessage } from "@/components/ui";
import { HideControl } from "@/components/hide-control";

type Props = {
  vehicleId: string;
  photos: VehiclePhoto[];
  canManage: boolean;
  isModerator: boolean;
  onChanged: () => Promise<void>;
};

export function PhotosSection({ vehicleId, photos, canManage, isModerator, onChanged }: Props) {
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [cancel, setCancel] = useState<(() => void) | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage({ text: "Photo library permission is required.", tone: "error" });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.85 });
    if (!result.canceled) {
      setPicked(result.assets[0] ?? null);
      setMessage(null);
    }
  }

  async function upload() {
    if (!picked) {
      setMessage({ text: "Select a photo first.", tone: "error" });
      return;
    }
    try {
      setUploading(true);
      setProgress(0);
      setMessage(null);
      const type = picked.mimeType ?? "image/jpeg";
      const session = await requestPhotoUpload(vehicleId, { fileName: picked.fileName ?? "photo.jpg", fileType: type, fileSize: picked.fileSize ?? 1 });
      const transfer = uploadWithProgress(session.uploadUrl, picked.uri, type, setProgress);
      setCancel(() => transfer.cancel);
      await transfer.promise;
      await finalizePhoto(vehicleId, { storageKey: session.storageKey, caption: caption.trim() || null });
      setPicked(null);
      setCaption("");
      await onChanged();
      setMessage({ text: "Photo uploaded.", tone: "info" });
    } catch (err) {
      setMessage({ text: errorMessage(err, "Photo upload failed."), tone: "error" });
    } finally {
      setUploading(false);
      setCancel(null);
    }
  }

  async function saveCaption(photoId: string) {
    try {
      await updatePhotoCaption(vehicleId, photoId, editCaption.trim() || null);
      setEditingId(null);
      await onChanged();
      setMessage({ text: "Caption updated.", tone: "info" });
    } catch (err) {
      setMessage({ text: errorMessage(err, "Could not update the caption."), tone: "error" });
    }
  }

  function confirmDelete(photoId: string) {
    Alert.alert("Delete photo", "This permanently removes the photo.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePhoto(vehicleId, photoId);
            await onChanged();
            setMessage({ text: "Photo deleted.", tone: "info" });
          } catch (err) {
            setMessage({ text: errorMessage(err, "Could not delete the photo."), tone: "error" });
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screenCard}>
      <Text style={styles.sectionTitle}>Photo Album</Text>

      {canManage ? (
        <View style={{ gap: 8 }}>
          {picked ? <Image source={{ uri: picked.uri }} style={styles.previewImage} /> : null}
          <SecondaryButton label={picked ? "Choose a different photo" : "Choose photo"} onPress={pick} disabled={uploading} />
          {picked ? (
            <>
              <TextInput value={caption} onChangeText={setCaption} placeholder="Caption (optional)" placeholderTextColor={palette.muted} style={styles.input} />
              <View style={styles.actionRow}>
                <PrimaryButton label={uploading ? `Uploading ${progress}%` : "Upload photo"} onPress={upload} disabled={uploading} />
                {cancel ? <SecondaryButton label="Cancel" onPress={cancel} /> : null}
              </View>
            </>
          ) : null}
        </View>
      ) : null}
      <Notice text={message?.text ?? null} tone={message?.tone} />

      {photos.length === 0 ? <Text style={styles.sectionMeta}>No photos yet.</Text> : null}
      {photos.map((photo) => (
        <View key={photo.id} style={styles.listCard}>
          <Image source={{ uri: mediaUrl(photo.url) }} style={styles.photoImage} />
          {editingId === photo.id ? (
            <>
              <TextInput value={editCaption} onChangeText={setEditCaption} placeholder="Caption" placeholderTextColor={palette.muted} style={styles.input} />
              <View style={styles.actionRow}>
                <PrimaryButton label="Save caption" onPress={() => saveCaption(photo.id)} />
                <SecondaryButton label="Cancel" onPress={() => setEditingId(null)} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.bodyText}>
                {photo.caption ?? "No caption"}
                {photo.hiddenAt ? " • Hidden" : ""}
              </Text>
              {canManage ? (
                <View style={styles.actionRow}>
                  <SecondaryButton
                    label="Edit caption"
                    onPress={() => {
                      setEditingId(photo.id);
                      setEditCaption(photo.caption ?? "");
                    }}
                  />
                  <DangerButton label="Delete" onPress={() => confirmDelete(photo.id)} />
                </View>
              ) : null}
            </>
          )}
          {isModerator ? <HideControl targetType="PHOTO" targetId={photo.id} hidden={Boolean(photo.hiddenAt)} onChanged={onChanged} /> : null}
        </View>
      ))}
    </View>
  );
}
