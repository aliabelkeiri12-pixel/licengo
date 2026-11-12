import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; reinitialise?: string }> }) {
  const { next, reinitialise } = await searchParams;
  return (
    <AuthShell title="Bon retour 👋" subtitle="Connectez-vous à votre espace famille, club ou administrateur." footer={<>Pas encore de compte ? <Link className="font-semibold text-pitch-700" href={`/inscription${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Créer un compte famille</Link></>}>
      {reinitialise && <p className="mb-4 rounded-xl bg-pitch-50 p-3 text-sm font-semibold text-pitch-800">Démo réinitialisée. Reconnectez-vous.</p>}
      <LoginForm next={next} />
      <div className="mt-6 rounded-xl bg-pitch-50 p-4 text-xs text-pitch-800">
        <p className="font-bold">Comptes de démonstration (mot de passe : Licengo2026!)</p>
        <p className="mt-1">Famille : famille.martin@exemple.fr · Club : secretariat@fclyonest.fr · Admin : admin@licengo.fr</p>
      </div>
    </AuthShell>
  );
}
