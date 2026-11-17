import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { registerAndSignIn, signInWithCredentials } from "@/lib/api";
import { useSession } from "@/lib/session-context";
import { palette, styles } from "@/lib/theme";
import { TabButton, errorMessage } from "@/components/ui";

export default function SignInScreen() {
  const { signIn } = useSession();
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
      const next =
        mode === "register"
          ? await registerAndSignIn(name.trim(), email.trim(), password)
          : await signInWithCredentials(email.trim(), password);
      // The root layout's Stack.Protected guard swaps to the signed-in screens once the session is set.
      await signIn(next);
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
        <Text style={styles.heroTitle}>Sign In</Text>
        <Text style={styles.bodyText}>Access the archive to add vehicles, follow profiles, and manage reports.</Text>

        <View style={styles.modeRow}>
          <TabButton active={mode === "signIn"} label="Sign In" onPress={() => setMode("signIn")} />
          <TabButton active={mode === "register"} label="Register" onPress={() => setMode("register")} />
        </View>

        {mode === "register" ? (
          <TextInput value={name} onChangeText={setName} placeholder="Name" style={styles.input} placeholderTextColor={palette.muted} />
        ) : null}
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.input} placeholderTextColor={palette.muted} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} placeholderTextColor={palette.muted} />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable onPress={handleSubmit} style={styles.primaryButton} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? "Working..." : mode === "register" ? "Create Account" : "Sign In"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
