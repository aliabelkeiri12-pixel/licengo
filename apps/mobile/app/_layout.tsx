import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "@/auth";
import { colors } from "@/theme";

function Gate() {
  const { me, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === "login" || segments[0] === "signup";
    if (!me && !inAuth) router.replace("/login");
    else if (me && inAuth) router.replace("/");
  }, [me, ready, segments, router]);
  if (!ready) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.pitch900 }}><ActivityIndicator color={colors.volt} /></View>;
  return (
    <Stack screenOptions={{ headerTintColor: colors.pitch800, headerStyle: { backgroundColor: colors.chalk }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.chalk }, headerBackTitle: "Retour" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ title: "Créer un compte" }} />
      <Stack.Screen name="club/[slug]" options={{ title: "Club" }} />
      <Stack.Screen name="registration/[id]" options={{ title: "Dossier" }} />
      <Stack.Screen name="child/new" options={{ title: "Ajouter un enfant", presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return <AuthProvider><StatusBar style="dark" /><Gate /></AuthProvider>;
}
