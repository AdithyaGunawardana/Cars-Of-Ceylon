import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "./types";

const SESSION_KEY = "cars-of-ceylon.session";

export async function saveSession(session: AuthSession | null) {
  if (!session) {
    await AsyncStorage.removeItem(SESSION_KEY);
    return;
  }

  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSavedSession() {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export async function clearSavedSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}
