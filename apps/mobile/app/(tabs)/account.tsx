import * as WebBrowser from "expo-web-browser";
import { ScrollView, Text } from "react-native";
import { API_URL } from "@/api";
import { useAuth } from "@/auth";
import { Button, Card, H1, Muted, s } from "@/ui";

export default function Account() {
  const { me, signOut } = useAuth();
  if (!me) return null;
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <H1>{me.user.firstName} {me.user.lastName}</H1>
      <Muted>{me.user.email}</Muted>
      <Card>
        <Text style={{ fontWeight: "700" }}>Paiements, boutique et données personnelles</Text>
        <Muted>Historique des paiements, commandes, export RGPD et suppression du compte.</Muted>
        <Button title="Ouvrir mon espace web" variant="outline" style={{ marginTop: 12 }} onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/famille/compte`)} />
      </Card>
      <Button title="Se déconnecter" variant="outline" onPress={signOut} />
    </ScrollView>
  );
}
