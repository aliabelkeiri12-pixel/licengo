import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth";
import { Button, Field } from "@/ui";
import { colors } from "@/theme";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true); setError(undefined);
    try { await signIn(email.trim(), password); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.pitch900 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <View style={{ padding: 24 }}>
          <Text style={{ color: colors.white, fontSize: 34, fontWeight: "900" }}>LICEN<Text style={{ color: colors.volt }}>GO</Text></Text>
          <Text style={{ color: "#ffffffb3", fontSize: 18, marginTop: 8 }}>La licence sportive, sans paperasse.</Text>
        </View>
        <View style={{ backgroundColor: colors.chalk, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="username" />
          <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" error={error} />
          <Button title="Se connecter" onPress={submit} loading={loading} />
          <Link href="/signup" style={{ textAlign: "center", marginTop: 18, color: colors.pitch700, fontWeight: "700" }}>Créer un compte famille</Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
