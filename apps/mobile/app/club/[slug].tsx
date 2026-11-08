import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { formatEUR } from "@licengo/core";
import { api } from "@/api";
import { useAuth } from "@/auth";
import { Button, Card, H1, Muted, s } from "@/ui";
import { colors } from "@/theme";

type Club = { name: string; city: string; description: string | null; color: string; sport: string; feeCents: number; categories: { id: string; name: string; birthYearMin: number; birthYearMax: number; gender: string; priceCents: number; maxInstallments: number }[] };

export default function ClubScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { me } = useAuth();
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(null);
  const [childId, setChildId] = useState<string | null>(me?.children[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { api<Club>(`/clubs/${slug}`).then(setClub).catch((e) => Alert.alert("Erreur", e.message)); }, [slug]);
  const child = me?.children.find((c) => c.id === childId);
  const eligible = useMemo(() => {
    if (!club || !child) return [];
    const y = new Date(child.birthDate).getUTCFullYear();
    return club.categories.filter((c) => y >= c.birthYearMin && y <= c.birthYearMax && (c.gender === "MIXED" || c.gender === child.gender));
  }, [club, child]);
  if (!club) return null;
  const register = async (categoryId: string) => {
    if (!childId) return;
    setLoading(true);
    try { const r = await api<{ id: string }>("/registrations", { body: { childId, categoryId } }); router.replace(`/registration/${r.id}`); }
    catch (e) { Alert.alert("Inscription impossible", (e as Error).message); } finally { setLoading(false); }
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: club.name }} />
      <View style={{ height: 6, borderRadius: 3, backgroundColor: club.color, marginBottom: 12 }} />
      <H1>{club.name}</H1>
      <Muted>{club.sport} · {club.city}</Muted>
      {club.description ? <Text style={{ marginTop: 8, color: colors.ink }}>{club.description}</Text> : null}
      <Text style={{ fontWeight: "800", fontSize: 18, marginTop: 20, marginBottom: 8 }}>Qui inscrire ?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {me?.children.map((c) => (
          <Pressable key={c.id} onPress={() => setChildId(c.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: c.id === childId ? colors.pitch800 : colors.white, borderWidth: 1, borderColor: colors.line }}>
            <Text style={{ color: c.id === childId ? colors.white : colors.ink, fontWeight: "600" }}>{c.firstName}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => router.push("/child/new")} style={{ paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: colors.pitch700, fontWeight: "700" }}>+ Ajouter</Text></Pressable>
      </View>
      <Text style={{ fontWeight: "800", fontSize: 18, marginTop: 20, marginBottom: 8 }}>Catégorie proposée</Text>
      {child && eligible.length === 0 ? <Muted>Aucune catégorie ouverte pour {child.firstName}.</Muted> : null}
      {eligible.map((c) => (
        <Card key={c.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontWeight: "700", fontSize: 16 }}>{c.name}</Text><Text style={{ fontWeight: "800" }}>{formatEUR(c.priceCents)}</Text></View>
          <Muted>+ {formatEUR(club.feeCents)} de frais LICENGO · jusqu'à {c.maxInstallments}× sans frais</Muted>
          <Button title="Commencer l'inscription" variant="volt" style={{ marginTop: 12 }} loading={loading} onPress={() => register(c.id)} />
        </Card>
      ))}
    </ScrollView>
  );
}
