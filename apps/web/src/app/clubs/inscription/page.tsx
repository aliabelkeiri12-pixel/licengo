import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { prisma } from "@/server/db";
import { ClubSignupForm } from "./form";

export const metadata = { title: "Inscrire mon club" };

export default async function Page() {
  const sports = await prisma.sport.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <AuthShell title="Inscrire mon club" subtitle="Créez l'espace de votre club en 3 minutes. Offre Starter gratuite, sans engagement." footer={<>Déjà un compte ? <Link className="font-semibold text-pitch-700" href="/connexion">Se connecter</Link></>}>
      <ClubSignupForm sports={sports.map((s) => ({ slug: s.slug, label: `${s.emoji} ${s.name}${s.active ? "" : " (bientôt)"}`, active: s.active }))} />
    </AuthShell>
  );
}
