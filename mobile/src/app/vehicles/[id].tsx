import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  createReport,
  createVehicleEvent,
  deleteVehicle,
  deleteVehicleEvent,
  finalizePhoto,
  getVehicle,
  requestPhotoUpload,
  updateVehicle,
  updateVehicleEvent,
  uploadPhotoWithProgress,
} from "@/lib/api";
import { useSession } from "@/lib/session-context";
import { palette, styles } from "@/lib/theme";
import { TabButton, errorMessage } from "@/components/ui";
import type { VehicleDetail, VehicleEvent } from "@/lib/types";

export default function VehicleDetailScreen() {
  const { id: vehicleId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [uniqueIdentifier, setUniqueIdentifier] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");

  // Fixed to NOTE for now; an event-type picker (like the web form) is part of the P4 feature work.
  const [eventType] = useState("NOTE");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDetails, setEventDetails] = useState("");
  const [editingEvent, setEditingEvent] = useState<VehicleEvent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editSourceUrl, setEditSourceUrl] = useState("");

  const [pickedImage, setPickedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cancelUpload, setCancelUpload] = useState<(() => void) | null>(null);

  const [reportReason, setReportReason] = useState("");
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setMessage(null);
        const payload = await getVehicle(vehicleId);
        if (!active) return;
        setVehicle(payload.vehicle);
        setUniqueIdentifier(payload.vehicle.uniqueIdentifier);
        setLicensePlate(payload.vehicle.licensePlate ?? "");
        setManufacturer(payload.vehicle.manufacturer);
        setModel(payload.vehicle.model);
        setYear(String(payload.vehicle.year));
        setDescription(payload.vehicle.description ?? "");
        setVisibility(payload.vehicle.visibility ?? "PUBLIC");
      } catch (err) {
        if (active) setMessage(errorMessage(err, "Failed to load vehicle."));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [vehicleId]);

  const refresh = useCallback(async () => {
    const payload = await getVehicle(vehicleId);
    setVehicle(payload.vehicle);
  }, [vehicleId]);

  async function saveVehicle() {
    try {
      setMessage(null);
      await updateVehicle(vehicleId, {
        uniqueIdentifier,
        licensePlate: licensePlate.trim() || null,
        manufacturer,
        model,
        year: Number(year),
        description: description.trim() || null,
        visibility,
      });
      await refresh();
      setMessage("Vehicle updated.");
    } catch (err) {
      setMessage(errorMessage(err, "Failed to update vehicle."));
    }
  }

  function removeVehicle() {
    Alert.alert("Delete vehicle", "This removes the vehicle and all related events/photos.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteVehicle(vehicleId);
            router.back();
          } catch (err) {
            setMessage(errorMessage(err, "Failed to delete vehicle."));
          }
        },
      },
    ]);
  }

  async function createEventHandler() {
    try {
      await createVehicleEvent(vehicleId, { type: eventType, title: eventTitle, details: eventDetails || null });
      setEventTitle("");
      setEventDetails("");
      await refresh();
      setMessage("Event added.");
    } catch (err) {
      setMessage(errorMessage(err, "Failed to add event."));
    }
  }

  async function saveEvent(event: VehicleEvent) {
    try {
      await updateVehicleEvent(vehicleId, event.id, {
        title: editTitle,
        details: editDetails || null,
        sourceUrl: editSourceUrl || null,
      });
      setEditingEvent(null);
      await refresh();
      setMessage("Event updated.");
    } catch (err) {
      setMessage(errorMessage(err, "Failed to update event."));
    }
  }

  function deleteEvent(eventId: string) {
    Alert.alert("Delete event", "Remove this timeline item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteVehicleEvent(vehicleId, eventId);
            await refresh();
            setMessage("Event deleted.");
          } catch (err) {
            setMessage(errorMessage(err, "Failed to delete event."));
          }
        },
      },
    ]);
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadError("Photo library permission is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled) {
      setPickedImage(result.assets[0]);
      setUploadError(null);
    }
  }

  async function uploadPhoto() {
    if (!pickedImage) {
      setUploadError("Select a photo first.");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      setUploadProgress(0);

      const uploadSession = await requestPhotoUpload(vehicleId, {
        fileName: pickedImage.fileName ?? "photo.jpg",
        fileType: pickedImage.mimeType ?? "image/jpeg",
        fileSize: pickedImage.fileSize ?? 1,
      });

      const upload = await uploadPhotoWithProgress(
        uploadSession.uploadUrl,
        pickedImage.uri,
        pickedImage.mimeType ?? "image/jpeg",
        setUploadProgress,
      );
      setCancelUpload(() => upload.cancel);
      await upload.promise;

      await finalizePhoto(vehicleId, { storageKey: uploadSession.storageKey, caption: photoCaption.trim() || null });

      setPickedImage(null);
      setPhotoCaption("");
      await refresh();
      setMessage("Photo uploaded.");
    } catch (err) {
      setUploadError(errorMessage(err, "Photo upload failed."));
    } finally {
      setUploading(false);
      setCancelUpload(null);
    }
  }

  async function submitReport() {
    try {
      await createReport({ vehicleId, reason: reportReason });
      setReportReason("");
      setReportMessage("Report submitted. A moderator will review it.");
    } catch (err) {
      setReportMessage(errorMessage(err, "Failed to submit report."));
    }
  }

  if (loading || !vehicle) {
    return (
      <View style={styles.rootCentered}>
        <ActivityIndicator color={palette.primary} />
        {message ? <Text style={styles.errorText}>{message}</Text> : null}
      </View>
    );
  }

  // UI hint only; the API re-checks ownership/role on every write.
  const role = session?.user.role;
  const canManage = session?.user.id === vehicle.createdBy.id || role === "MODERATOR" || role === "ADMIN";

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.screenCard}>
        <Text style={styles.kicker}>Vehicle record</Text>
        <Text style={styles.heroTitle}>
          {vehicle.manufacturer} {vehicle.model}
        </Text>
        <Text style={styles.sectionMeta}>Year: {vehicle.year}</Text>
        <Text style={styles.sectionMeta}>Unique ID: {vehicle.uniqueIdentifier}</Text>
        <Text style={styles.sectionMeta}>License Plate: {vehicle.licensePlate ?? "Not set"}</Text>
        <Text style={styles.bodyText}>{vehicle.description ?? "No description added yet."}</Text>
        <Pressable onPress={() => router.push({ pathname: "/users/[id]", params: { id: vehicle.createdBy.id } })}>
          <Text style={styles.linkText}>Added by {vehicle.createdBy.name ?? vehicle.createdBy.email ?? "Unknown"}</Text>
        </Pressable>
      </View>

      {canManage ? (
        <View style={styles.screenCard}>
          <Text style={styles.sectionTitle}>Manage Vehicle</Text>
          <TextInput value={uniqueIdentifier} onChangeText={setUniqueIdentifier} placeholder="Unique Identifier" style={styles.input} placeholderTextColor={palette.muted} />
          <TextInput value={licensePlate} onChangeText={setLicensePlate} placeholder="License Plate" style={styles.input} placeholderTextColor={palette.muted} />
          <TextInput value={manufacturer} onChangeText={setManufacturer} placeholder="Manufacturer" style={styles.input} placeholderTextColor={palette.muted} />
          <TextInput value={model} onChangeText={setModel} placeholder="Model" style={styles.input} placeholderTextColor={palette.muted} />
          <TextInput value={year} onChangeText={setYear} placeholder="Year" keyboardType="numeric" style={styles.input} placeholderTextColor={palette.muted} />
          <TextInput value={description} onChangeText={setDescription} placeholder="Description" style={[styles.input, styles.textArea]} multiline placeholderTextColor={palette.muted} />
          <View style={styles.modeRow}>
            <TabButton active={visibility === "PUBLIC"} label="Public" onPress={() => setVisibility("PUBLIC")} />
            <TabButton active={visibility === "PRIVATE"} label="Private" onPress={() => setVisibility("PRIVATE")} />
          </View>
          <View style={styles.actionRow}>
            <Pressable onPress={saveVehicle} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Save Changes</Text></Pressable>
            <Pressable onPress={removeVehicle} style={styles.dangerButton}><Text style={styles.primaryButtonText}>Delete Vehicle</Text></Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.screenCard}>
        <Text style={styles.sectionTitle}>Timeline</Text>
        <TextInput value={eventTitle} onChangeText={setEventTitle} placeholder="Event title" style={styles.input} placeholderTextColor={palette.muted} />
        <TextInput value={eventDetails} onChangeText={setEventDetails} placeholder="Event details" style={[styles.input, styles.textArea]} multiline placeholderTextColor={palette.muted} />
        <Pressable onPress={createEventHandler} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Add Event</Text></Pressable>

        {vehicle.events.map((event) => (
          <View key={event.id} style={styles.listCard}>
            {editingEvent?.id === event.id ? (
              <>
                <TextInput value={editTitle} onChangeText={setEditTitle} placeholder="Title" style={styles.input} placeholderTextColor={palette.muted} />
                <TextInput value={editDetails} onChangeText={setEditDetails} placeholder="Details" style={[styles.input, styles.textArea]} multiline placeholderTextColor={palette.muted} />
                <TextInput value={editSourceUrl} onChangeText={setEditSourceUrl} placeholder="Source URL" autoCapitalize="none" style={styles.input} placeholderTextColor={palette.muted} />
                <View style={styles.actionRow}>
                  <Pressable onPress={() => saveEvent(event)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Save Event</Text></Pressable>
                  <Pressable onPress={() => setEditingEvent(null)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>{event.title}</Text>
                <Text style={styles.cardMeta}>{event.type}</Text>
                <Text style={styles.bodyText}>{event.details ?? "No details provided."}</Text>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => {
                      setEditingEvent(event);
                      setEditTitle(event.title);
                      setEditDetails(event.details ?? "");
                      setEditSourceUrl(event.sourceUrl ?? "");
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteEvent(event.id)} style={styles.dangerButton}><Text style={styles.primaryButtonText}>Delete</Text></Pressable>
                </View>
              </>
            )}
          </View>
        ))}
      </View>

      <View style={styles.screenCard}>
        <Text style={styles.sectionTitle}>Photo Album</Text>
        {pickedImage ? <Image source={{ uri: pickedImage.uri }} style={styles.previewImage} /> : null}
        <Pressable onPress={pickPhoto} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Choose Photo</Text></Pressable>
        <TextInput value={photoCaption} onChangeText={setPhotoCaption} placeholder="Caption (optional)" style={styles.input} placeholderTextColor={palette.muted} />
        <View style={styles.actionRow}>
          <Pressable onPress={uploadPhoto} style={styles.primaryButton} disabled={uploading}>
            <Text style={styles.primaryButtonText}>{uploading ? `Uploading ${uploadProgress}%` : "Upload Photo"}</Text>
          </Pressable>
          {cancelUpload ? <Pressable onPress={cancelUpload} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable> : null}
        </View>
        {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}
        {vehicle.photos.map((photo) => (
          <View key={photo.id} style={styles.listCard}>
            <Image source={{ uri: photo.url }} style={styles.photoImage} />
            <Text style={styles.bodyText}>{photo.caption ?? "Untitled photo"}</Text>
          </View>
        ))}
      </View>

      <View style={styles.screenCard}>
        <Text style={styles.sectionTitle}>Report This Vehicle</Text>
        <TextInput value={reportReason} onChangeText={setReportReason} placeholder="Explain the issue" style={[styles.input, styles.textArea]} multiline placeholderTextColor={palette.muted} />
        <Pressable onPress={submitReport} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Submit Report</Text></Pressable>
        {reportMessage ? <Text style={styles.sectionMeta}>{reportMessage}</Text> : null}
      </View>

      {message ? <Text style={styles.sectionMeta}>{message}</Text> : null}
    </ScrollView>
  );
}
