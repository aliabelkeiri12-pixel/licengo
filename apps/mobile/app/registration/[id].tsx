import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import SignatureScreen, { type SignatureViewRef } from "react-native-signature-canvas";
import { buildLicenseCheckout, DOCUMENT_LABELS, SIGNATURE_LABELS, formatEUR, type DocumentType, type SignableDocument } from "@licengo/core";
import { api } from "@/api";
import { useAuth } from "@/auth";
import { Badge, Button, Card, H1, Muted, ProgressBar, s } from "@/ui";
import { colors, statusLabel } from "@/theme";

type Reg = {
  id: string; status: string; paymentStatus: string; season: string; healthAnswer: string | null; decisionReason: string | null;
  child: { id: string; firstName: string; lastName: string }; club: { name: string }; category: { name: string; maxInstallments: number };
  licenseFeeCents: number; platformFeeCents: number;
  completeness: { state: string; progress: number; requiredUploads: DocumentType[]; requiredSignatures: SignableDocument[]; missingUploads: DocumentType[]; summary: string[] };
  documents: { id: string; type: DocumentType; status: string; rejectReason: string | null }[];
  signatures: { type: SignableDocument; accepted: boolean }[];
  payments: { id: string; status: string; totalCents: number; installments: { index: number; dueDate: string; amountCents: number; status: string }[] }[];
};

export default function RegistrationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, refresh } = useAuth();
  const [r, setR] = useState<Reg | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [signing, setSigning] = useState<SignableDocument | null>(null);
  const [n, setN] = useState(1);
  const [clause, setClause] = useState(false);
  const sigRef = useRef<SignatureViewRef>(null);
  const load = useCallback(() => api<Reg>(`/registrations/${id}`).then(setR).catch((e) => Alert.alert("Erreur", e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  if (!r) return null;
  const editable = ["DRAFT", "INCOMPLETE", "TO_FIX"].includes(r.status);
  const signerName = `${me?.user.firstName} ${me?.user.lastName}`;

  /** Takes the photo with the camera, compresses it (≈2000 px JPEG) and uploads it. */
  const capture = async (type: DocumentType, fromLibrary = false) => {
    const perm = fromLibrary ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Autorisation requise", "Autorisez l'accès dans les réglages du téléphone.");
    const res = fromLibrary ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 }) : await ImagePicker.launchCameraAsync({ quality: 1 });
    if (res.canceled) return;
    setBusy(type);
    try {
      const img = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 2000 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      const form = new FormData();
      form.append("childId", r.child.id); form.append("registrationId", r.id); form.append("type", type);
      form.append("file", { uri: img.uri, name: `${type.toLowerCase()}.jpg`, type: "image/jpeg" } as unknown as Blob);
      await api("/documents", { form });
      await load();
    } catch (e) { Alert.alert("Envoi impossible", (e as Error).message); } finally { setBusy(null); }
  };

  const health = async (answer: "ALL_NO" | "SOME_YES") => { await api(`/registrations/${r.id}/health`, { body: { answer } }); await load(); };
  const onSignature = async (png: string) => {
    const type = signing!; setSigning(null); setBusy(type);
    try { await api(`/registrations/${r.id}/sign`, { body: { type, signerName, accepted: true, signaturePng: png } }); await load(); }
    catch (e) { Alert.alert("Signature", (e as Error).message); } finally { setBusy(null); }
  };
  const submit = async () => {
    setBusy("submit");
    try { const res = await api<{ status: string; summary: string[] }>(`/registrations/${r.id}/submit`, { method: "POST", body: {} }); Alert.alert(res.status === "SUBMITTED" ? "Dossier envoyé 🎉" : "Dossier incomplet", res.status === "SUBMITTED" ? "Le club va vérifier votre dossier." : res.summary.join("\n")); await load(); await refresh(); }
    catch (e) { Alert.alert("Erreur", (e as Error).message); } finally { setBusy(null); }
  };
  const pay = async () => {
    setBusy("pay");
    try {
      if (n > 1 && !clause) { Alert.alert("Paiement en plusieurs fois", "Acceptez la clause de prélèvement du solde en cas d'impayé."); return; }
      const { url } = await api<{ url: string }>(`/registrations/${r.id}/pay`, { body: { installments: n, acceptBalanceClause: n > 1 ? clause : undefined } });
      await WebBrowser.openAuthSessionAsync(url, "licengo://");
      await load();
    } catch (e) { Alert.alert("Paiement", (e as Error).message); } finally { setBusy(null); }
  };
  const plan = buildLicenseCheckout(r.licenseFeeCents, n, r.platformFeeCents);
  const payment = r.payments.find((p) => p.status !== "PENDING");
  const needsHealth = r.completeness.requiredSignatures.includes("HEALTH_QUESTIONNAIRE") || r.healthAnswer === "SOME_YES";

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Muted>{r.club.name} · {r.season}</Muted>
      <H1>Dossier de {r.child.firstName}</H1>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}><Badge label={statusLabel[r.status][0]} color={statusLabel[r.status][1]} /><Badge label={r.category.name} color={colors.pitch700} /></View>
      {r.decisionReason && ["TO_FIX", "REJECTED"].includes(r.status) ? <Card style={{ marginTop: 12, borderColor: colors.warning }}><Text style={{ fontWeight: "700" }}>Message du club</Text><Text>{r.decisionReason}</Text></Card> : null}
      <Card style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: "800" }}>Dossier complété à {r.completeness.progress}%</Text>
        <ProgressBar value={r.completeness.progress} />
        {r.completeness.summary.map((m) => <Text key={m} style={{ color: colors.muted, marginTop: 4 }}>• {m}</Text>)}
      </Card>

      <Text style={{ fontWeight: "800", fontSize: 18, marginVertical: 8 }}>Documents</Text>
      {r.completeness.requiredUploads.map((t) => {
        const d = r.documents.find((x) => x.type === t);
        const ok = d && d.status !== "REJECTED";
        return (
          <Card key={t}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "700", flex: 1 }}>{ok ? "✅ " : "⬜️ "}{DOCUMENT_LABELS[t]}</Text>
              {d ? <Badge label={d.status === "ACCEPTED" ? "Validé" : d.status === "REJECTED" ? "Refusé" : "Envoyé"} color={d.status === "REJECTED" ? colors.danger : colors.pitch600} /> : null}
            </View>
            {d?.rejectReason ? <Text style={{ color: colors.danger, marginTop: 4 }}>Motif : {d.rejectReason}</Text> : null}
            {editable && !ok ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <Button title="📷 Photographier" style={{ flex: 1 }} loading={busy === t} onPress={() => capture(t)} />
                <Button title="Galerie" variant="outline" onPress={() => capture(t, true)} />
              </View>
            ) : null}
          </Card>
        );
      })}

      {needsHealth ? (
        <Card>
          <Text style={{ fontWeight: "700" }}>Questionnaire de santé</Text>
          <Muted>Avez-vous répondu NON à toutes les questions du questionnaire QS-SPORT ?</Muted>
          {editable ? <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Button title="Oui, NON partout" variant={r.healthAnswer === "ALL_NO" ? "primary" : "outline"} style={{ flex: 1 }} onPress={() => health("ALL_NO")} />
            <Button title="Au moins un OUI" variant={r.healthAnswer === "SOME_YES" ? "primary" : "outline"} style={{ flex: 1 }} onPress={() => health("SOME_YES")} />
          </View> : null}
        </Card>
      ) : null}

      <Text style={{ fontWeight: "800", fontSize: 18, marginVertical: 8 }}>Signatures</Text>
      {r.completeness.requiredSignatures.filter((t) => t !== "HEALTH_QUESTIONNAIRE" || r.healthAnswer === "ALL_NO").map((t) => {
        const done = r.signatures.find((x) => x.type === t);
        return (
          <Card key={t}>
            <Text style={{ fontWeight: "700" }}>{done ? "✅ " : "✍️ "}{SIGNATURE_LABELS[t]}</Text>
            {!done && editable ? <Button title="Signer" variant="outline" style={{ marginTop: 10 }} loading={busy === t} onPress={() => setSigning(t)} /> : null}
          </Card>
        );
      })}

      {editable ? <Button title={r.completeness.state === "COMPLETE" ? "Envoyer le dossier complet" : "Envoyer au club"} variant="volt" loading={busy === "submit"} onPress={submit} style={{ marginVertical: 12 }} /> : null}

      <Text style={{ fontWeight: "800", fontSize: 18, marginVertical: 8 }}>Paiement</Text>
      {payment ? (
        <Card>{payment.installments.map((i) => <View key={i.index} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}><Text>Échéance {i.index} · {new Date(i.dueDate).toLocaleDateString("fr-FR")}</Text><Text style={{ fontWeight: "700" }}>{formatEUR(i.amountCents)} {i.status === "PAID" ? "✓" : ""}</Text></View>)}</Card>
      ) : ["REJECTED", "CANCELLED"].includes(r.status) ? null : r.completeness.state !== "COMPLETE" ? (
        <Card><Text style={{ fontWeight: "700" }}>🔒 Le paiement s'ouvrira dès que le dossier sera complet.</Text>{r.completeness.summary.map((m) => <Muted key={m}>• {m}</Muted>)}</Card>
      ) : (
        <Card>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {Array.from({ length: r.category.maxInstallments }, (_, i) => i + 1).map((k) => (
              <Pressable key={k} onPress={() => setN(k)} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: k === n ? colors.pitch700 : colors.line, alignItems: "center", backgroundColor: k === n ? colors.pitch50 : colors.white }}>
                <Text style={{ fontWeight: "900", fontSize: 18 }}>{k}×</Text>
              </Pressable>
            ))}
          </View>
          {plan.installments.map((i) => <View key={i.index} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}><Muted>{i.index === 1 ? "Aujourd'hui" : i.dueDate.toLocaleDateString("fr-FR")}</Muted><Text style={{ fontWeight: "700" }}>{formatEUR(i.amountCents)}</Text></View>)}
          <Muted>Total {formatEUR(plan.totalCents)} dont {formatEUR(r.platformFeeCents)} de frais LICENGO</Muted>
          {n > 1 ? (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 10 }}>
              <Switch value={clause} onValueChange={setClause} trackColor={{ true: colors.pitch600 }} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.ink }}>J'accepte qu'en cas d'échec d'une échéance après 3 tentatives, le solde restant soit prélevé en une fois sur ma carte.</Text>
            </View>
          ) : null}
          <Button title={`Payer ${formatEUR(plan.installments[0].amountCents)}`} variant="volt" style={{ marginTop: 12 }} loading={busy === "pay"} onPress={pay} />
        </Card>
      )}

      <Modal visible={!!signing} animationType="slide" onRequestClose={() => setSigning(null)}>
        <View style={{ flex: 1, paddingTop: 60, backgroundColor: colors.chalk }}>
          <Text style={{ fontWeight: "800", fontSize: 18, paddingHorizontal: 16 }}>{signing ? SIGNATURE_LABELS[signing] : ""}</Text>
          <Text style={{ color: colors.muted, paddingHorizontal: 16, marginVertical: 8 }}>Signataire : {signerName}</Text>
          <TextInput editable={false} value={signerName} style={{ display: "none" }} />
          <SignatureScreen ref={sigRef} onOK={onSignature} descriptionText="Signez dans le cadre" clearText="Effacer" confirmText="Valider" imageType="image/png" webStyle=".m-signature-pad--footer .button{background:#0B3D2E;color:#fff}" />
          <Pressable onPress={() => setSigning(null)} style={{ padding: 20, alignItems: "center" }}><Text style={{ color: colors.danger, fontWeight: "700" }}>Annuler</Text></Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}
