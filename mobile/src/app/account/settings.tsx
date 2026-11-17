import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Link } from "expo-router";
import { changePassword, finalizeAvatar, loadAccount, requestAvatarUpload, sendVerificationEmail, updateAccount } from "@/lib/api";
import { mediaUrl } from "@/lib/config";
import { useSession } from "@/lib/session-context";
import { palette, styles } from "@/lib/theme";
import { uploadWithProgress } from "@/lib/upload";
import type { Account } from "@/lib/types";
import { DangerButton, Notice, PrimaryButton, SecondaryButton, errorMessage } from "@/components/ui";

type Msg = { text: string; tone: "info" | "error" } | null;

export default function AccountSettingsScreen() {
  const { session, signOut } = useSession();
  const [account, setAccount] = useState<Account | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [profileMsg, setProfileMsg] = useState<Msg>(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<Msg>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<Msg>(null);

  const [verifyMsg, setVerifyMsg] = useState<Msg>(null);

  useEffect(() => {
    let active = true;
    loadAccount()
      .then((loaded) => {
        if (!active) return;
        setAccount(loaded);
        setName(loaded.name ?? "");
        setBio(loaded.bio ?? "");
      })
      .catch((err) => active && setLoadError(errorMessage(err, "Could not load your account.")));
    return () => {
      active = false;
    };
  }, []);

  if (!account) {
    return (
      <View style={styles.rootCentered}>
        {loadError ? <Notice text={loadError} tone="error" /> : <ActivityIndicator color={palette.primary} />}
      </View>
    );
  }

  const isModerator = session?.user.role === "MODERATOR" || session?.user.role === "ADMIN";

  async function saveProfile() {
    try {
      setAccount(await updateAccount({ name: name.trim(), bio: bio.trim() }));
      setProfileMsg({ text: "Profile saved.", tone: "info" });
    } catch (err) {
      setProfileMsg({ text: errorMessage(err, "Could not save your profile."), tone: "error" });
    }
  }

  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarMsg({ text: "Photo library permission is required.", tone: "error" });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    try {
      setAvatarBusy(true);
      setAvatarMsg(null);
      const type = asset.mimeType ?? "image/jpeg";
      const target = await requestAvatarUpload({ fileType: type, fileSize: asset.fileSize ?? 1 });
      await uploadWithProgress(target.uploadUrl, asset.uri, type).promise;
      await finalizeAvatar(target.storageKey);
      setAccount(await loadAccount());
      setAvatarMsg({ text: "Photo updated.", tone: "info" });
    } catch (err) {
      setAvatarMsg({ text: errorMessage(err, "Could not update your photo."), tone: "error" });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function submitPassword() {
    if (newPassword.length < 8) {
      setPasswordMsg({ text: "The new password must be at least 8 characters.", tone: "error" });
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMsg({ text: "Password changed. Other devices will be asked to sign in again.", tone: "info" });
    } catch (err) {
      setPasswordMsg({ text: errorMessage(err, "Could not change your password."), tone: "error" });
    }
  }

  async function resendVerification() {
    try {
      await sendVerificationEmail();
      setVerifyMsg({ text: "Verification email sent. Open the link in your browser.", tone: "info" });
    } catch (err) {
      setVerifyMsg({ text: errorMessage(err, "Could not send the email."), tone: "error" });
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.screenCard}>
        <Text style={styles.sectionTitle}>Profile</Text>
        {account.image ? <Image source={{ uri: mediaUrl(account.image) }} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: palette.surface }} /> : null}
        <SecondaryButton label={avatarBusy ? "Uploading..." : "Change photo"} onPress={chooseAvatar} disabled={avatarBusy} />
        <Notice text={avatarMsg?.text ?? null} tone={avatarMsg?.tone} />
        <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={palette.muted} style={styles.input} />
        <TextInput value={bio} onChangeText={setBio} placeholder="Bio (optional)" placeholderTextColor={palette.muted} style={[styles.input, styles.textArea]} multiline maxLength={500} />
        <PrimaryButton label="Save profile" onPress={saveProfile} />
        <Notice text={profileMsg?.text ?? null} tone={profileMsg?.tone} />
      </View>

      <View style={styles.screenCard}>
        <Text style={styles.sectionTitle}>Email</Text>
        <Text style={styles.bodyText}>{account.email}</Text>
        {account.emailVerified ? (
          <Text style={{ color: palette.success, fontWeight: "700" }}>Verified</Text>
        ) : (
          <>
            <Text style={styles.sectionMeta}>Your email is not verified yet.</Text>
            <SecondaryButton label="Resend verification email" onPress={resendVerification} />
            <Notice text={verifyMsg?.text ?? null} tone={verifyMsg?.tone} />
          </>
        )}
      </View>

      <View style={styles.screenCard}>
        <Text style={styles.sectionTitle}>Change password</Text>
        <TextInput value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" secureTextEntry placeholderTextColor={palette.muted} style={styles.input} />
        <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="New password (8+ characters)" secureTextEntry placeholderTextColor={palette.muted} style={styles.input} />
        <PrimaryButton label="Change password" onPress={submitPassword} disabled={!currentPassword || !newPassword} />
        <Notice text={passwordMsg?.text ?? null} tone={passwordMsg?.tone} />
      </View>

      <View style={styles.screenCard}>
        <Text style={styles.sectionTitle}>More</Text>
        <Link href="/account/deleted" style={styles.linkText}>
          Deleted vehicles
        </Link>
        {isModerator ? (
          <Link href="/moderation/log" style={styles.linkText}>
            Moderation audit log
          </Link>
        ) : null}
        <DangerButton label="Sign out" onPress={() => signOut()} />
      </View>
    </ScrollView>
  );
}
