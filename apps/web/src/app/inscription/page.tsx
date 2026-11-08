import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Créer un compte famille" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell title="Créer mon compte famille" subtitle="Un seul compte pour inscrire tous vos enfants, saison après saison." footer={<>Déjà inscrit ? <Link className="font-semibold text-pitch-700" href="/connexion">Se connecter</Link> · Vous êtes un club ? <Link className="font-semibold text-pitch-700" href="/clubs/inscription">Espace club</Link></>}>
      <SignupForm next={next} />
    </AuthShell>
  );
}
