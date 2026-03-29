import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { loginWithCredentials } from "../lib/api";
import { saveSessionToken } from "../lib/session";

type Props = {
  onAuthenticated: () => void;
};

export function LoginScreen({ onAuthenticated }: Props) {
  const [email, setEmail] = useState("admin@carsofceylon.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null as string | null);

  async function handleLogin() {
    // Login flow: authenticate against web API, persist session marker, then switch screen.
    setError(null);
    setLoading(true);

    try {
      const token = await loginWithCredentials(email, password);
      await saveSessionToken(token);
      onAuthenticated();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cars Of Ceylon</Text>
      <Text style={styles.subtitle}>Mobile MVP bootstrap</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
        placeholder="Email"
        placeholderTextColor="#94a3b8"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor="#94a3b8"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={handleLogin} disabled={loading} style={styles.button}>
        <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign In"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0f172a",
    gap: 12,
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: "#cbd5e1",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    backgroundColor: "#020617",
  },
  button: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: "#f59e0b",
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#111827",
    fontWeight: "700",
  },
  error: {
    color: "#fca5a5",
  },
});
