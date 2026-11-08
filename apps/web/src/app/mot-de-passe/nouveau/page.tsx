import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { NewPasswordForm } from "../forms";

export const metadata = { title: "Nouveau mot de passe" };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Nouveau mot de passe" footer={<Link href="/connexion" className="font-semibold text-pitch-700">Se connecter</Link>}>
      <NewPasswordForm token={token ?? ""} />
    </AuthShell>
  );
}
