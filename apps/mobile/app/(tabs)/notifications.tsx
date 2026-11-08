import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { api } from "@/api";
import { useAuth } from "@/auth";
import { Card, Muted, s } from "@/ui";
import { colors } from "@/theme";

type N = { id: string; title: string; body: string; createdAt: string; readAt: string | null };

export default function Notifications() {
  const { refresh } = useAuth();
  const [list, setList] = useState<N[]>([]);
  useFocusEffect(useCallback(() => {
    api<N[]>("/notifications").then(setList).then(() => api("/notifications", { method: "POST", body: {} })).then(refresh).catch(() => undefined);
  }, [refresh]));
  return (
    <FlatList style={s.screen} contentContainerStyle={{ padding: 16 }} data={list} keyExtractor={(n) => n.id}
      ListEmptyComponent={<Muted>Aucune notification pour le moment.</Muted>}
      renderItem={({ item }) => (
        <Card style={!item.readAt ? { borderColor: colors.volt } : undefined}>
          <Text style={{ fontWeight: "700" }}>{item.title}</Text>
          <Text style={{ color: colors.ink, marginTop: 2 }}>{item.body}</Text>
          <View style={{ height: 4 }} /><Muted>{new Date(item.createdAt).toLocaleString("fr-FR")}</Muted>
        </Card>
      )} />
  );
}
