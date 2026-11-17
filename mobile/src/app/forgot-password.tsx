import { useState } from "react";
import { ScrollView, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { requestPasswordReset } from "@/lib/api";
import { palette, styles } from "@/lib/theme";
import { Notice, PrimaryButton, errorMessage } from "@/components/ui";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  async function submit() {
    try {
      setBusy(true);
      await requestPasswordReset(email.trim());
      // The server answers the same way for unknown addresses, so this wording must not reveal whether one exists.
      setMessage({ text: "If an account exists for that address, a reset link is on its way. Open it in your browser to choose a new password.", tone: "info" });
    } catch (err) {
      setMessage({ text: errorMessage(err, "Could not send the reset email."), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.rootCentered}>
      <ScrollView contentContainerStyle={styles.authCard} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Account recovery</Text>
        <Text style={styles.heroTitle}>Reset password</Text>
        <Text style={styles.bodyText}>Enter your email and we will send you a link to choose a new password.</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.input} placeholderTextColor={palette.muted} />
        <Notice text={message?.text ?? null} tone={message?.tone} />
        <PrimaryButton label={busy ? "Sending..." : "Send reset link"} onPress={submit} disabled={busy || !email.includes("@")} />
      </ScrollView>
    </SafeAreaView>
  );
}
