import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "@/lib/config";
import { useSession } from "@/lib/session-context";
import { palette, styles } from "@/lib/theme";
import { Notice, PrimaryButton, TabButton, errorMessage } from "@/components/ui";

export default function SignInScreen() {
  const { signIn, register } = useSession();
  const [mode, setMode] = useState<"signIn" | "register">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "register" && name.trim().length < 2) {
      setError("Enter your name (at least 2 characters).");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      // The root layout's Stack.Protected guard swaps to the signed-in screens once the session is set.
      if (mode === "register") await register(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err, "Authentication failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.rootCentered}>
      <ScrollView contentContainerStyle={styles.authCard} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Warm archive</Text>
        <Text style={styles.heroTitle}>{mode === "register" ? "Create account" : "Sign In"}</Text>
        <Text style={styles.bodyText}>Access the archive to add vehicles, follow profiles, and manage reports.</Text>

        <View style={styles.modeRow}>
          <TabButton active={mode === "signIn"} label="Sign In" onPress={() => setMode("signIn")} />
          <TabButton active={mode === "register"} label="Register" onPress={() => setMode("register")} />
        </View>

        {mode === "register" ? <TextInput value={name} onChangeText={setName} placeholder="Name" style={styles.input} placeholderTextColor={palette.muted} /> : null}
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.input} placeholderTextColor={palette.muted} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password (8+ characters)" secureTextEntry style={styles.input} placeholderTextColor={palette.muted} onSubmitEditing={handleSubmit} />

        <Notice text={error} tone="error" />
        <PrimaryButton label={loading ? "Working..." : mode === "register" ? "Create Account" : "Sign In"} onPress={handleSubmit} disabled={loading} />

        {mode === "signIn" ? (
          <Link href="/forgot-password" style={styles.linkText}>
            Forgot your password?
          </Link>
        ) : null}
        {__DEV__ ? <Text style={styles.cardMeta}>Server: {API_BASE_URL}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
