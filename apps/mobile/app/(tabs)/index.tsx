import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/auth";
import { Badge, Button, Card, H1, Muted, ProgressBar, s } from "@/ui";
import { colors, statusLabel } from "@/theme";

export default function Home() {
  const { me, refresh } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { refresh().catch(() => undefined); }, [refresh]));
  if (!me) return null;
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh().catch(() => undefined); setRefreshing(false); }} />}>
      <H1>Bonjour {me.user.firstName} 👋</H1>
      <Muted>Dossiers, paiements et licences de votre famille.</Muted>
      <View style={{ height: 16 }} />
      {me.children.length === 0 ? (
        <Card><Text style={{ fontWeight: "700", fontSize: 16 }}>Ajoutez votre premier enfant</Text><Muted>Ses informations seront réutilisées chaque saison.</Muted><View style={{ height: 12 }} /><Button title="Ajouter un enfant" onPress={() => router.push("/child/new")} /></Card>
      ) : me.children.map((c) => {
        const r = c.registrations[0];
        return (
          <Card key={c.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.pitch800, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.volt, fontWeight: "800", fontSize: 18 }}>{c.firstName[0]}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: "700", fontSize: 16 }}>{c.firstName} {c.lastName}</Text><Muted>{new Date(c.birthDate).toLocaleDateString("fr-FR")}</Muted></View>
            </View>
            {r ? (
              <Pressable onPress={() => router.push(`/registration/${r.id}`)} style={{ marginTop: 12, backgroundColor: colors.chalk, borderRadius: 12, padding: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ fontWeight: "700" }}>{r.club.name}</Text><Badge label={statusLabel[r.status][0]} color={statusLabel[r.status][1]} /></View>
                <Muted>{r.category.name} · {r.season}</Muted>
                <ProgressBar value={r.progress} />
              </Pressable>
            ) : <Link href="/clubs" style={{ marginTop: 12, color: colors.pitch700, fontWeight: "700" }}>Trouver un club →</Link>}
          </Card>
        );
      })}
      {me.children.length > 0 && <Button title="+ Ajouter un enfant" variant="outline" onPress={() => router.push("/child/new")} />}
    </ScrollView>
  );
}
