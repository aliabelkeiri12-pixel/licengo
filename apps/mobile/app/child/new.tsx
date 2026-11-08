import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { childSchema } from "@licengo/core";
import { api } from "@/api";
import { useAuth } from "@/auth";
import { Button, Field } from "@/ui";
import { colors } from "@/theme";

export default function NewChild() {
  const router = useRouter();
  const { me, refresh } = useAuth();
  const [f, setF] = useState({ firstName: "", lastName: me?.user.lastName ?? "", birthDate: "", birthPlace: "" });
  const [gender, setGender] = useState<"M" | "F" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  // Date typed as JJ/MM/AAAA (works identically on iOS & Android, no native picker dependency)
  const iso = (fr: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fr.trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : fr; };
  const submit = async () => {
    const data = { ...f, birthDate: iso(f.birthDate), gender };
    const p = childSchema.safeParse(data);
    if (!p.success) { setErrors(Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
    setLoading(true);
    try { await api("/children", { body: data }); await refresh(); router.back(); } catch (e) { setErrors({ firstName: (e as Error).message }); } finally { setLoading(false); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <Field label="Prénom" value={f.firstName} onChangeText={(v) => setF({ ...f, firstName: v })} error={errors.firstName} />
      <Field label="Nom" value={f.lastName} onChangeText={(v) => setF({ ...f, lastName: v })} error={errors.lastName} />
      <Field label="Date de naissance (JJ/MM/AAAA)" value={f.birthDate} onChangeText={(v) => setF({ ...f, birthDate: v })} keyboardType="numbers-and-punctuation" error={errors.birthDate} placeholder="15/06/2016" />
      <Text style={{ fontWeight: "600", marginBottom: 6 }}>Genre</Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        {(["F", "M"] as const).map((g) => (
          <Pressable key={g} onPress={() => setGender(g)} style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 2, borderColor: gender === g ? colors.pitch700 : colors.line, alignItems: "center", justifyContent: "center", backgroundColor: gender === g ? colors.pitch50 : colors.white }}>
            <Text style={{ fontWeight: "700" }}>{g === "F" ? "Fille" : "Garçon"}</Text>
          </Pressable>
        ))}
      </View>
      {errors.gender ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{errors.gender}</Text> : null}
      <Field label="Lieu de naissance" value={f.birthPlace} onChangeText={(v) => setF({ ...f, birthPlace: v })} />
      <Button title="Ajouter" onPress={submit} loading={loading} />
    </ScrollView>
  );
}
