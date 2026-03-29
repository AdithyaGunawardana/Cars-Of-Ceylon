import * as SecureStore from "expo-secure-store";

const SESSION_TOKEN_KEY = "cars-of-ceylon-session-token";

export async function saveSessionToken(token: string) {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export async function loadSessionToken() {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export async function clearSessionToken() {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}
