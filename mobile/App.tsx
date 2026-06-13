import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  clearSavedSession,
  loadSavedSession,
  saveSession,
} from "./src/lib/session";
import type {
  AuthSession,
  Profile,
  ReportItem,
  VehicleDetail,
  VehicleEvent,
  VehicleListItem,
} from "./src/lib/types";
import {
  createReport,
  createVehicleEvent,
  deleteVehicle,
  deleteVehicleEvent,
  followUser,
  finalizePhoto,
  getVehicle,
  listReports,
  listVehicles,
  loadProfile,
  restoreSession,
  signInWithCredentials,
  signOutSession,
  registerAndSignIn,
  unfollowUser,
  updateReportStatus,
  updateVehicle,
  updateVehicleEvent,
  requestPhotoUpload,
  uploadPhotoWithProgress,
} from "./src/lib/api";

const palette = {
  background: "#fbfaee",
  paper: "#ffffff",
  surface: "#f5f4e8",
  primary: "#271310",
  secondary: "#725a39",
  text: "#504442",
  muted: "#765f5c",
  border: "#d3c3c0",
  danger: "#9e2a2b",
  success: "#406c50",
};

type ScreenState =
  | { name: "vehicles" }
  | { name: "vehicle"; vehicleId: string }
  | { name: "profile"; userId: string }
  | { name: "reports" };

function parseDeepLink(url: string): ScreenState | null {
  const normalized = url.replace("carsceylon://", "").replace("/", "");
  const [segment, value] = normalized.split("/");

  if (segment === "vehicle" && value) {
    return { name: "vehicle", vehicleId: value };
  }

  if (segment === "profile" && value) {
    return { name: "profile", userId: value };
  }

  if (segment === "reports") {
    return { name: "reports" };
  }

  return null;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [screen, setScreen] = useState<ScreenState>({ name: "vehicles" });

  useEffect(() => {
    async function bootstrap() {
      const savedSession = await loadSavedSession();
      if (savedSession) {
        setSession(savedSession);
      }

      const freshSession = await restoreSession();
      if (freshSession) {
        setSession(freshSession);
        await saveSession(freshSession);
      } else if (savedSession) {
        await clearSavedSession();
      }

      setBooting(false);
    }

    bootstrap();
  }, []);

  useEffect(() => {
    async function handleInitialLink() {
      const initialUrl = await Linking.getInitialURL();
      if (!initialUrl) {
        return;
      }

      const nextScreen = parseDeepLink(initialUrl);
      if (nextScreen) {
        setScreen(nextScreen);
      }
    }

    handleInitialLink();

    const subscription = Linking.addEventListener("url", ({ url }) => {
      const nextScreen = parseDeepLink(url);
      if (nextScreen) {
        setScreen(nextScreen);
      }
    });

    return () => subscription.remove();
  }, []);

  const currentTab = useMemo(() => {
    if (screen.name === "vehicle" || screen.name === "profile") {
      return null;
    }

    return screen.name;
  }, [screen]);

  async function handleAuthenticated(nextSession: AuthSession) {
    setSession(nextSession);
    await saveSession(nextSession);
    setScreen({ name: "vehicles" });
  }

  async function handleSignOut() {
    await signOutSession();
    await clearSavedSession();
    setSession(null);
    setScreen({ name: "vehicles" });
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.rootCentered}>
        <ActivityIndicator color={palette.primary} />
        <Text style={styles.mutedText}>Restoring session...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Cars of Ceylon</Text>
          <Text style={styles.headerTitle}>Archive</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerMeta} numberOfLines={1}>
            {session.user.name ?? session.user.email ?? "Signed in"}
          </Text>
          <Pressable onPress={handleSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tabs}>
        <TabButton active={currentTab === "vehicles"} label="Vehicles" onPress={() => setScreen({ name: "vehicles" })} />
        <TabButton active={currentTab === "profile"} label="Profile" onPress={() => setScreen({ name: "profile", userId: session.user.id })} />
        <TabButton active={currentTab === "reports"} label="Reports" onPress={() => setScreen({ name: "reports" })} />
      </View>

      <View style={styles.content}>
        {screen.name === "vehicles" ? (
          <VehiclesScreen
            onOpenVehicle={(vehicleId) => setScreen({ name: "vehicle", vehicleId })}
            onOpenProfile={(userId) => setScreen({ name: "profile", userId })}
          />
        ) : null}

        {screen.name === "vehicle" ? (
          <VehicleDetailScreen
            vehicleId={screen.vehicleId}
            session={session}
            onBack={() => setScreen({ name: "vehicles" })}
            onOpenProfile={(userId) => setScreen({ name: "profile", userId })}
          />
        ) : null}

        {screen.name === "profile" ? (
          <ProfileScreen
            userId={screen.userId}
            currentUserId={session.user.id}
            onBack={() => setScreen({ name: "vehicles" })}
            onOpenVehicle={(vehicleId) => setScreen({ name: "vehicle", vehicleId })}
          />
        ) : null}

        {screen.name === "reports" ? (
          <ReportsScreen session={session} onOpenVehicle={(vehicleId) => setScreen({ name: "vehicle", vehicleId })} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active ? styles.tabButtonActive : null]}>
      <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<"signIn" | "register">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    try {
      setLoading(true);
      setError(null);

      const nextSession =
        mode === "register"
          ? await registerAndSignIn(name.trim(), email.trim(), password)
          : await signInWithCredentials(email.trim(), password);

      await onAuthenticated(nextSession);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.rootCentered}>
      <ScrollView contentContainerStyle={styles.authCard}>
        <Text style={styles.kicker}>Warm archive</Text>
        <Text style={styles.heroTitle}>Sign In</Text>
        <Text style={styles.bodyText}>Access the archive to add vehicles, follow profiles, and manage reports.</Text>

        <View style={styles.modeRow}>
          <TabButton active={mode === "signIn"} label="Sign In" onPress={() => setMode("signIn")} />
          <TabButton active={mode === "register"} label="Register" onPress={() => setMode("register")} />
        </View>

        {mode === "register" ? (
          <TextInput value={name} onChangeText={setName} placeholder="Name" style={styles.input} placeholderTextColor={palette.muted} />
        ) : null}
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={styles.input} placeholderTextColor={palette.muted} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} placeholderTextColor={palette.muted} />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable onPress={handleSubmit} style={styles.primaryButton} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? "Working..." : mode === "register" ? "Create Account" : "Sign In"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function VehiclesScreen({ onOpenVehicle, onOpenProfile }: { onOpenVehicle: (vehicleId: string) => void; onOpenProfile: (userId: string) => void }) {
  const [query, setQuery] = useState({ manufacturer: "", model: "", year: "", search: "", page: 1, pageSize: 10 });
  const [items, setItems] = useState<VehicleListItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const payload = await listVehicles({
          manufacturer: query.manufacturer || undefined,
          model: query.model || undefined,
          year: query.year || undefined,
          search: query.search || undefined,
          page: query.page,
          pageSize: query.pageSize,
        });
        if (!active) return;
        setItems(payload.items);
        setPagination(payload.pagination);
      } catch (error) {
        if (!active) return;
        setError(error instanceof Error ? error.message : "Failed to load vehicles.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [query.manufacturer, query.model, query.page, query.pageSize, query.search, query.year]);

  return (
    <View style={styles.screenCard}>
      <Text style={styles.sectionTitle}>Vehicle Archive</Text>
      <Text style={styles.sectionMeta}>Browse and search Sri Lankan vehicle history records.</Text>

      <View style={styles.filterGrid}>
        <TextInput placeholder="Plate / Unique ID" value={query.search} onChangeText={(search) => setQuery((current) => ({ ...current, search, page: 1 }))} style={styles.input} placeholderTextColor={palette.muted} />
        <TextInput placeholder="Manufacturer" value={query.manufacturer} onChangeText={(manufacturer) => setQuery((current) => ({ ...current, manufacturer, page: 1 }))} style={styles.input} placeholderTextColor={palette.muted} />
        <TextInput placeholder="Model" value={query.model} onChangeText={(model) => setQuery((current) => ({ ...current, model, page: 1 }))} style={styles.input} placeholderTextColor={palette.muted} />
        <TextInput placeholder="Year" value={query.year} onChangeText={(year) => setQuery((current) => ({ ...current, year, page: 1 }))} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.muted} />
      </View>

      {loading ? <ActivityIndicator color={palette.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.listCard} onPress={() => onOpenVehicle(item.id)}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {item.manufacturer} {item.model}
                </Text>
                <Text style={styles.cardMeta}>Unique ID: {item.uniqueIdentifier}</Text>
                <Text style={styles.cardMeta}>Plate: {item.licensePlate ?? "Not set"}</Text>
                <Text style={styles.cardMeta}>Events: {item._count?.events ?? 0} • Photos: {item._count?.photos ?? 0}</Text>
              </View>
              <View style={styles.yearBadge}><Text style={styles.yearBadgeText}>{item.year}</Text></View>
            </View>
            {item.createdBy?.id ? (
              <Pressable onPress={() => onOpenProfile(item.createdBy!.id)}>
                <Text style={styles.linkText}>Added by {item.createdBy?.name ?? "Unknown"}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.sectionMeta}>No vehicles matched your filters.</Text> : null}
        contentContainerStyle={{ paddingBottom: 16 }}
      />

      <View style={styles.paginationRow}>
        <Pressable
          onPress={() => setQuery((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
          disabled={pagination.page <= 1}
          style={[styles.secondaryButton, pagination.page <= 1 ? styles.buttonDisabled : null]}
        >
          <Text style={styles.secondaryButtonText}>Prev</Text>
        </Pressable>
        <Text style={styles.sectionMeta}>Page {pagination.page} of {pagination.totalPages || 1}</Text>
        <Pressable
          onPress={() => setQuery((current) => ({ ...current, page: Math.min(pagination.totalPages || 1, current.page + 1) }))}
          disabled={pagination.page >= pagination.totalPages}
          style={[styles.secondaryButton, pagination.page >= pagination.totalPages ? styles.buttonDisabled : null]}
        >
          <Text style={styles.secondaryButtonText}>Next</Text>
        </Pressable>
      </View>
    </View>
  );
}

function VehicleDetailScreen({ vehicleId, session, onBack, onOpenProfile }: { vehicleId: string; session: AuthSession; onBack: () => void; onOpenProfile: (userId: string) => void }) {
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

  const [eventType, setEventType] = useState("NOTE");
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
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Failed to load vehicle.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [vehicleId]);

  async function refresh() {
    const payload = await getVehicle(vehicleId);
    setVehicle(payload.vehicle);
  }

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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update vehicle.");
    }
  }

  async function removeVehicle() {
    Alert.alert("Delete vehicle", "This removes the vehicle and all related events/photos.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteVehicle(vehicleId);
            onBack();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to delete vehicle.");
          }
        },
      },
    ]);
  }

  async function createEventHandler() {
    try {
      await createVehicleEvent(vehicleId, {
        type: eventType,
        title: eventTitle,
        details: eventDetails || null,
      });
      setEventTitle("");
      setEventDetails("");
      await refresh();
      setMessage("Event added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add event.");
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update event.");
    }
  }

  async function deleteEvent(eventId: string) {
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
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to delete event.");
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

      await finalizePhoto(vehicleId, {
        storageKey: uploadSession.storageKey,
        caption: photoCaption.trim() || null,
      });

      setPickedImage(null);
      setPhotoCaption("");
      await refresh();
      setMessage("Photo uploaded.");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Photo upload failed.");
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
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : "Failed to submit report.");
    }
  }

  if (loading || !vehicle) {
    return (
      <View style={styles.screenCard}>
        <Pressable onPress={onBack}><Text style={styles.linkText}>Back to vehicles</Text></Pressable>
        <ActivityIndicator color={palette.primary} />
        {message ? <Text style={styles.errorText}>{message}</Text> : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      <Pressable onPress={onBack}><Text style={styles.linkText}>Back to vehicles</Text></Pressable>

      <View style={styles.screenCard}>
        <Text style={styles.kicker}>Vehicle record</Text>
        <Text style={styles.heroTitle}>
          {vehicle.manufacturer} {vehicle.model}
        </Text>
        <Text style={styles.sectionMeta}>Year: {vehicle.year}</Text>
        <Text style={styles.sectionMeta}>Unique ID: {vehicle.uniqueIdentifier}</Text>
        <Text style={styles.sectionMeta}>License Plate: {vehicle.licensePlate ?? "Not set"}</Text>
        <Text style={styles.bodyText}>{vehicle.description ?? "No description added yet."}</Text>
        <Pressable onPress={() => onOpenProfile(vehicle.createdBy.id)}>
          <Text style={styles.linkText}>Added by {vehicle.createdBy.name ?? vehicle.createdBy.email ?? "Unknown"}</Text>
        </Pressable>
      </View>

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
                <TextInput value={editSourceUrl} onChangeText={setEditSourceUrl} placeholder="Source URL" style={styles.input} placeholderTextColor={palette.muted} />
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
                  <Pressable onPress={() => { setEditingEvent(event); setEditTitle(event.title); setEditDetails(event.details ?? ""); setEditSourceUrl(event.sourceUrl ?? ""); }} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Edit</Text></Pressable>
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
          <Pressable onPress={uploadPhoto} style={styles.primaryButton} disabled={uploading}><Text style={styles.primaryButtonText}>{uploading ? `Uploading ${uploadProgress}%` : "Upload Photo"}</Text></Pressable>
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

function ProfileScreen({ userId, currentUserId, onBack, onOpenVehicle }: { userId: string; currentUserId: string; onBack: () => void; onOpenVehicle: (vehicleId: string) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setMessage(null);
        const payload = await loadProfile(userId);
        if (!active) return;
        setProfile(payload);
        setFollowing(payload.relationship.isFollowing);
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Failed to load profile.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [userId]);

  async function toggleFollow() {
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
      } else {
        await followUser(userId);
        setFollowing(true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Follow action failed.");
    }
  }

  if (loading || !profile) {
    return (
      <View style={styles.screenCard}>
        <Pressable onPress={onBack}><Text style={styles.linkText}>Back to vehicles</Text></Pressable>
        <ActivityIndicator color={palette.primary} />
        {message ? <Text style={styles.errorText}>{message}</Text> : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
      <Pressable onPress={onBack}><Text style={styles.linkText}>Back to vehicles</Text></Pressable>
      <View style={styles.screenCard}>
        <Text style={styles.kicker}>Community profile</Text>
        <Text style={styles.heroTitle}>{profile.user.name ?? "User profile"}</Text>
        <Text style={styles.sectionMeta}>{profile.user.email ?? "No email available"}</Text>
        <Text style={styles.bodyText}>{typeof profile.user.profile === "object" && profile.user.profile ? JSON.stringify(profile.user.profile) : "No bio added yet."}</Text>
        {userId !== currentUserId ? (
          <Pressable onPress={toggleFollow} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{following ? "Unfollow" : "Follow"}</Text></Pressable>
        ) : null}
        <View style={styles.chipRow}>
          <View style={styles.chip}><Text style={styles.chipText}>Vehicles: {profile.stats.vehicleCount}</Text></View>
          <View style={styles.chip}><Text style={styles.chipText}>Followers: {profile.stats.followerCount}</Text></View>
          <View style={styles.chip}><Text style={styles.chipText}>Following: {profile.stats.followingCount}</Text></View>
        </View>
      </View>

      <View style={styles.screenCard}>
        <Text style={styles.sectionTitle}>Vehicles</Text>
        {profile.vehicles.map((vehicle) => (
          <Pressable key={vehicle.id} style={styles.listCard} onPress={() => onOpenVehicle(vehicle.id)}>
            <Text style={styles.cardTitle}>{vehicle.manufacturer} {vehicle.model}</Text>
            <Text style={styles.cardMeta}>{vehicle.uniqueIdentifier}</Text>
            <Text style={styles.cardMeta}>{vehicle.licensePlate ?? "Not set"}</Text>
          </Pressable>
        ))}
      </View>

      {message ? <Text style={styles.sectionMeta}>{message}</Text> : null}
    </ScrollView>
  );
}

function ReportsScreen({ session, onOpenVehicle }: { session: AuthSession; onOpenVehicle: (vehicleId: string) => void }) {
  const [vehicleId, setVehicleId] = useState("");
  const [reason, setReason] = useState("");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadQueue() {
      try {
        setLoading(true);
        setQueueMessage(null);
        const payload = await listReports({ status: status || undefined, page: 1, pageSize: 10 });
        if (!active) return;
        setReports(payload.items);
      } catch (error) {
        if (!active) return;
        setQueueMessage(error instanceof Error ? error.message : "Failed to load report queue.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadQueue();
    return () => {
      active = false;
    };
  }, [status]);

  async function submitReport() {
    try {
      await createReport({ vehicleId, reason });
      setSubmitMessage("Report submitted.");
      setVehicleId("");
      setReason("");
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "Failed to submit report.");
    }
  }

  async function updateStatus(reportId: string, nextStatus: "REVIEWING" | "RESOLVED" | "REJECTED") {
    try {
      await updateReportStatus(reportId, nextStatus);
      const payload = await listReports({ status: status || undefined, page: 1, pageSize: 10 });
      setReports(payload.items);
    } catch (error) {
      setQueueMessage(error instanceof Error ? error.message : "Failed to update report.");
    }
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={styles.screenCard}>
        <Text style={styles.sectionTitle}>Submit Report</Text>
        <TextInput value={vehicleId} onChangeText={setVehicleId} placeholder="Vehicle ID" style={styles.input} placeholderTextColor={palette.muted} />
        <TextInput value={reason} onChangeText={setReason} placeholder="Explain the issue" style={[styles.input, styles.textArea]} multiline placeholderTextColor={palette.muted} />
        <Pressable onPress={submitReport} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Submit Report</Text></Pressable>
        {submitMessage ? <Text style={styles.sectionMeta}>{submitMessage}</Text> : null}
      </View>

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
            <Pressable onPress={() => onOpenVehicle(report.vehicle.id)}><Text style={styles.linkText}>Open vehicle</Text></Pressable>
            <View style={styles.actionRow}>
              <Pressable onPress={() => updateStatus(report.id, "REVIEWING")} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Review</Text></Pressable>
              <Pressable onPress={() => updateStatus(report.id, "RESOLVED")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Resolve</Text></Pressable>
              <Pressable onPress={() => updateStatus(report.id, "REJECTED")} style={styles.dangerButton}><Text style={styles.primaryButtonText}>Reject</Text></Pressable>
            </View>
          </View>
        ))}
        <Text style={styles.sectionMeta}>{session.user.name ?? session.user.email ?? "Signed in"}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  rootCentered: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 8,
    maxWidth: 170,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: palette.secondary,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    color: palette.primary,
    fontWeight: "700",
  },
  headerMeta: {
    fontSize: 12,
    color: palette.text,
    textAlign: "right",
  },
  signOutButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.paper,
  },
  signOutText: {
    color: palette.primary,
    fontWeight: "700",
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tabButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: palette.paper,
  },
  tabButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  tabButtonText: {
    color: palette.primary,
    fontWeight: "700",
  },
  tabButtonTextActive: {
    color: palette.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  authCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: palette.paper,
    borderRadius: 28,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  heroTitle: {
    fontSize: 34,
    color: palette.primary,
    fontWeight: "700",
  },
  bodyText: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionMeta: {
    color: palette.text,
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 20,
    color: palette.primary,
    fontWeight: "700",
    marginBottom: 8,
  },
  screenCard: {
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    backgroundColor: palette.background,
    color: palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  filterGrid: {
    gap: 8,
  },
  listCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    padding: 14,
    gap: 8,
    marginTop: 8,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitle: {
    color: palette.primary,
    fontWeight: "700",
    fontSize: 16,
  },
  cardMeta: {
    color: palette.text,
    fontSize: 13,
  },
  yearBadge: {
    backgroundColor: palette.paper,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  yearBadgeText: {
    color: palette.secondary,
    fontWeight: "700",
  },
  linkText: {
    color: palette.secondary,
    fontWeight: "700",
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  primaryButton: {
    backgroundColor: palette.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  dangerButton: {
    backgroundColor: palette.danger,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: palette.paper,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.border,
  },
  secondaryButtonText: {
    color: palette.primary,
    fontWeight: "700",
  },
  primaryButtonText: {
    color: palette.background,
    fontWeight: "700",
  },
  errorText: {
    color: palette.danger,
    fontWeight: "700",
  },
  mutedText: {
    color: palette.text,
    marginTop: 12,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 20,
    backgroundColor: palette.surface,
  },
  photoImage: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    backgroundColor: palette.surface,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: palette.surface,
  },
  chipText: {
    color: palette.primary,
    fontWeight: "700",
    fontSize: 12,
  },
});
