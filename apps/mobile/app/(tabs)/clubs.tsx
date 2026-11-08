import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { api } from "@/api";
import { Button, Card, Muted, s } from "@/ui";
import { colors } from "@/theme";

type Club = { slug: string; name: string; city: string; postalCode: string; emoji: string; color: string; distanceKm: number | null };

export default function Clubs() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [radius, setRadius] = useState(25);
  const [results, setResults] = useState<Club[] | null>(null);
  const [loading, setLoading] = useState(false);
  const search = async () => {
    setLoading(true);
    try { setResults((await api<{ results: Club[] }>(`/clubs?q=${encodeURIComponent(q)}&radius=${radius}&sport=football`)).results); } finally { setLoading(false); }
  };
  return (
    <View style={s.screen}>
      <View style={{ padding: 16, gap: 10 }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Ville ou code postal" placeholderTextColor={colors.muted} style={s.input} returnKeyType="search" onSubmitEditing={search} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[5, 10, 25, 50].map((r) => (
            <Pressable key={r} onPress={() => setRadius(r)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: r === radius ? colors.pitch800 : colors.white, borderWidth: 1, borderColor: colors.line }}>
              <Text style={{ color: r === radius ? colors.white : colors.ink, fontWeight: "600" }}>{r} km</Text>
            </Pressable>
          ))}
        </View>
        <Button title="Rechercher" onPress={search} loading={loading} />
      </View>
      <FlatList
        data={results ?? []}
        keyExtractor={(c) => c.slug}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={results ? <Muted>Aucun club trouvé dans ce rayon.</Muted> : undefined}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/club/${item.slug}`)}>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: item.color }} />
              <View style={{ flex: 1 }}><Text style={{ fontWeight: "700" }}>{item.name}</Text><Muted>{item.emoji} {item.postalCode} {item.city}</Muted></View>
              {item.distanceKm != null && <Text style={{ fontWeight: "700", color: colors.pitch700 }}>{item.distanceKm.toFixed(1)} km</Text>}
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}
