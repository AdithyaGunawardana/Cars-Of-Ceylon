import { Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/lib/session-context";
import { palette, styles } from "@/lib/theme";

function Header() {
  const { session, signOut } = useSession();
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: palette.background }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <View>
          <Text style={styles.kicker}>Cars of Ceylon</Text>
          <Text style={{ fontSize: 26, color: palette.primary, fontWeight: "700" }}>Archive</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8, maxWidth: 170 }}>
          <Text style={{ fontSize: 12, color: palette.text, textAlign: "right" }} numberOfLines={1}>
            {session?.user.name ?? session?.user.email ?? "Signed in"}
          </Text>
          <Pressable onPress={() => signOut()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function TabsLayout() {
  const { session } = useSession();
  const isModerator = session?.user.role === "MODERATOR" || session?.user.role === "ADMIN";

  return (
    <Tabs
      screenOptions={{
        header: () => <Header />,
        sceneStyle: { backgroundColor: palette.background },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: { backgroundColor: palette.paper, borderTopColor: palette.border },
        tabBarLabelStyle: { fontWeight: "700" },
        tabBarIconStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Vehicles" }} />
      <Tabs.Screen name="me" options={{ title: "Profile" }} />
      <Tabs.Screen name="reports" options={{ title: isModerator ? "Reports" : "Report" }} />
    </Tabs>
  );
}
