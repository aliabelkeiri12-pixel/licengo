import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { colors, radius } from "./theme";

export function Button({ title, onPress, variant = "primary", loading, disabled, style }: { title: string; onPress: () => void; variant?: "primary" | "volt" | "outline"; loading?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const bg = variant === "primary" ? colors.pitch800 : variant === "volt" ? colors.volt : colors.white;
  const fg = variant === "primary" ? colors.white : colors.pitch950;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: pressed || disabled ? 0.7 : 1 }, variant === "outline" && s.outline, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...p }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...p} style={[s.input, error ? { borderColor: colors.danger } : null]} />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => <View style={[s.card, style]}>{children}</View>;
export const H1 = ({ children }: { children: React.ReactNode }) => <Text style={s.h1}>{children}</Text>;
export const Muted = ({ children }: { children: React.ReactNode }) => <Text style={s.muted}>{children}</Text>;
export function Badge({ label, color }: { label: string; color: string }) {
  return <View style={[s.badge, { backgroundColor: color + "1A" }]}><Text style={[s.badgeText, { color }]}>{label}</Text></View>;
}
export function ProgressBar({ value }: { value: number }) {
  return <View style={s.track}><View style={[s.bar, { width: `${value}%`, backgroundColor: value === 100 ? colors.pitch600 : colors.volt }]} /></View>;
}

export const s = StyleSheet.create({
  btn: { height: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  outline: { borderWidth: 1, borderColor: colors.line },
  btnText: { fontSize: 16, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink, marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, fontSize: 16, backgroundColor: colors.white, color: colors.ink },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 12 },
  h1: { fontSize: 28, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 },
  muted: { fontSize: 14, color: colors.muted },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.pitch50, overflow: "hidden", marginTop: 8 },
  bar: { height: 8, borderRadius: 4 },
  screen: { flex: 1, backgroundColor: colors.chalk },
});
