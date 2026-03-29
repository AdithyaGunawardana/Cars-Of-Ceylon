import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { clearSessionToken, loadSessionToken } from "./src/lib/session";
import { LoginScreen } from "./src/screens/LoginScreen";
import { VehiclesScreen } from "./src/screens/VehiclesScreen";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Boot phase: restore persisted auth marker and route user accordingly.
    loadSessionToken()
      .then((token) => {
        setAuthenticated(Boolean(token));
      })
      .finally(() => {
        setBooting(false);
      });
  }, []);

  if (booting) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      {authenticated ? (
        <VehiclesScreen
          onLogout={() => {
            // Logout clears local token marker and returns to login screen.
            clearSessionToken().finally(() => setAuthenticated(false));
          }}
        />
      ) : (
        <LoginScreen onAuthenticated={() => setAuthenticated(true)} />
      )}
    </>
  );
}
