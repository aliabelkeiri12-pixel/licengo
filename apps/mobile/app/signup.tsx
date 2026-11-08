import { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { signupSchema } from "@licengo/core";
import { useAuth } from "@/auth";
import { Button, Field } from "@/ui";
import { colors } from "@/theme";

export default function Signup() {
  const { signUp } = useAuth();
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const submit = async () => {
    const parsed = signupSchema.safeParse({ ...f, acceptTerms: accept });
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
    setErrors({}); setLoading(true);
    try { await signUp(f); } catch (e) { setErrors({ email: (e as Error).message }); } finally { setLoading(false); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <Field label="Prénom" value={f.firstName} onChangeText={set("firstName")} error={errors.firstName} autoComplete="given-name" />
      <Field label="Nom" value={f.lastName} onChangeText={set("lastName")} error={errors.lastName} autoComplete="family-name" />
      <Field label="Email" value={f.email} onChangeText={set("email")} error={errors.email} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Téléphone mobile" value={f.phone} onChangeText={set("phone")} error={errors.phone} keyboardType="phone-pad" />
      <Field label="Mot de passe" value={f.password} onChangeText={set("password")} error={errors.password} secureTextEntry textContentType="newPassword" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Switch value={accept} onValueChange={setAccept} trackColor={{ true: colors.pitch600 }} />
        <Text style={{ flex: 1, color: colors.ink }}>J'accepte les CGU et la politique de confidentialité. Je suis responsable légal des mineurs que j'inscris.</Text>
      </View>
      {errors.acceptTerms ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{errors.acceptTerms}</Text> : null}
      <Button title="Créer mon compte" onPress={submit} loading={loading} />
    </ScrollView>
  );
}
