import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ResetRequestForm } from "./forms";

export const metadata = { title: "Mot de passe oublié" };

export default function Page() {
  return (
    <AuthShell title="Mot de passe oublié" subtitle="Recevez un lien sécurisé pour choisir un nouveau mot de passe." footer={<Link href="/connexion" className="font-semibold text-pitch-700">Retour à la connexion</Link>}>
      <ResetRequestForm />
    </AuthShell>
  );
}
