import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { formatEUR } from "@licengo/core";
import { api } from "@/api";
import { Badge, Card, H1, Muted, s } from "@/ui";
import { colors } from "@/theme";

type Payment = {
  id: string; title: string; club: string; status: string; totalCents: number; clubAmountCents: number; platformFeeCents: number; installmentsCount: number;
  installments: { id: string; index: number; dueDate: string; amountCents: number; status: string }[];
  invoice: { id: string; number: string; url: string } | null;
};
const status: Record<string, [string, string]> = { ACTIVE: ["En cours", "#1F5FBF"], COMPLETED: ["Soldé", colors.pitch600], FAILED: ["Impayé", colors.danger], REFUNDED: ["Remboursé", colors.warning] };
const inst: Record<string, string> = { PAID: "✓ payée", SCHEDULED: "programmée", FAILED: "⚠ échec", CANCELLED: "annulée", REFUNDED: "remboursée", PROCESSING: "en cours" };

export default function Payments() {
  const [list, setList] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => { setLoading(true); api<Payment[]>("/payments").then(setList).catch(() => undefined).finally(() => setLoading(false)); }, []);
  useFocusEffect(load);
  const paid = list.flatMap((p) => p.installments).filter((i) => i.status === "PAID").reduce((a, i) => a + i.amountCents, 0);
  const due = list.filter((p) => ["ACTIVE", "FAILED"].includes(p.status)).flatMap((p) => p.installments).filter((i) => ["SCHEDULED", "FAILED"].includes(i.status)).reduce((a, i) => a + i.amountCents, 0);
  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={{ padding: 16 }}
      data={list}
      keyExtractor={(p) => p.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListHeaderComponent={<View style={{ marginBottom: 12 }}><H1>Mes paiements</H1><Muted>Payé : {formatEUR(paid)} · Reste à payer : {formatEUR(due)}</Muted></View>}
      ListEmptyComponent={<Muted>Aucun paiement pour l'instant.</Muted>}
      renderItem={({ item: p }) => (
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: "700" }}>{p.title}</Text><Muted>{p.club}</Muted></View>
            {status[p.status] ? <Badge label={status[p.status][0]} color={status[p.status][1]} /> : null}
          </View>
          <Muted>Total {formatEUR(p.totalCents)} · club {formatEUR(p.clubAmountCents)} · frais {formatEUR(p.platformFeeCents)}</Muted>
          {p.installments.map((i) => (
            <View key={i.id} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text>{i.index}/{p.installmentsCount} · {new Date(i.dueDate).toLocaleDateString("fr-FR")}</Text>
              <Text style={{ fontWeight: "700", color: i.status === "FAILED" ? colors.danger : colors.ink }}>{formatEUR(i.amountCents)} {inst[i.status] ?? ""}</Text>
            </View>
          ))}
          {p.invoice ? (
            <Pressable onPress={() => WebBrowser.openBrowserAsync(p.invoice!.url)} style={{ marginTop: 12, backgroundColor: colors.pitch800, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
              <Text style={{ color: colors.white, fontWeight: "700" }}>📄 Télécharger la facture</Text>
            </Pressable>
          ) : null}
        </Card>
      )}
    />
  );
}
