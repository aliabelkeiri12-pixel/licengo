import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/auth";
import { colors } from "@/theme";

export default function TabsLayout() {
  const { me } = useAuth();
  const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: unknown; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.pitch800, tabBarInactiveTintColor: colors.muted, headerStyle: { backgroundColor: colors.pitch900 }, headerTintColor: colors.white, headerTitleStyle: { fontWeight: "800" } }}>
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="clubs" options={{ title: "Clubs", tabBarIcon: icon("search") }} />
      <Tabs.Screen name="payments" options={{ title: "Paiements", tabBarIcon: icon("card") }} />
      <Tabs.Screen name="notifications" options={{ title: "Alertes", tabBarIcon: icon("notifications"), tabBarBadge: me?.unread ? me.unread : undefined }} />
      <Tabs.Screen name="account" options={{ title: "Compte", tabBarIcon: icon("person-circle") }} />
    </Tabs>
  );
}
