import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone, Mail, ShoppingBag } from "lucide-react";
import { formatEUR } from "@licengo/core";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { currentSeason } from "@/server/services/registrations";
import { PublicHeader } from "@/components/public-header";
import { Card, LinkButton, Badge } from "@/components/ui";
import { RegisterForm } from "./register-form";

export default async function ClubPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ enfant?: string }> }) {
  const { slug } = await params;
  const { enfant } = await searchParams;
  const club = await prisma.club.findUnique({ where: { slug }, include: { sport: true, plan: true, categories: { where: { season: currentSeason(), open: true }, orderBy: { birthYearMax: "desc" }, include: { _count: { select: { registrations: { where: { status: { notIn: ["CANCELLED", "REJECTED"] } } } } } } } } });
  if (!club || club.status === "SUSPENDED") notFound();
  const user = await getCurrentUser();
  const children = user?.familyId ? await prisma.child.findMany({ where: { familyId: user.familyId, deletedAt: null }, orderBy: { birthDate: "asc" } }) : [];
  const fee = club.plan?.licenseFeeCents ?? 499;
  return (
    <main className="min-h-dvh pb-16">
      <div className="text-white" style={{ background: `linear-gradient(135deg, ${club.primaryColor}, #04130D)` }}>
        <PublicHeader dark />
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
          <Badge tone="volt">{club.sport.emoji} {club.sport.name} · {club.sport.federation}</Badge>
          <h1 className="font-display mt-3 text-3xl font-black sm:text-5xl">{club.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {club.address ? `${club.address}, ` : ""}{club.postalCode} {club.city}</span>
            {club.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {club.phone}</span>}
            {club.email && <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {club.email}</span>}
          </div>
          <div className="mt-6 flex gap-3"><LinkButton href={`/boutique/${club.slug}`} variant="volt"><ShoppingBag className="h-4 w-4" /> Boutique du club</LinkButton></div>
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section>
          {club.description && <p className="mb-6 text-ink/80">{club.description}</p>}
          <h2 className="font-display mb-3 text-xl font-bold">Catégories {currentSeason()}</h2>
          <Card className="divide-y divide-line">
            {club.categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-4">
                <div><p className="font-semibold">{c.name}</p><p className="text-xs text-muted">Né(e)s en {c.birthYearMin === c.birthYearMax ? c.birthYearMin : `${c.birthYearMin}–${c.birthYearMax}`}{c.capacity ? ` · ${Math.max(0, c.capacity - c._count.registrations)} places` : ""}</p></div>
                <div className="text-right"><p className="font-bold">{formatEUR(c.priceCents)}</p><p className="text-xs text-muted">jusqu'à {c.maxInstallments}× sans frais</p></div>
              </div>
            ))}
            {club.categories.length === 0 && <p className="p-4 text-sm text-muted">Les inscriptions ne sont pas encore ouvertes.</p>}
          </Card>
        </section>
        <aside>
          <Card className="sticky top-20 p-5">
            <h2 className="font-display text-lg font-bold">S'inscrire</h2>
            {!user ? (
              <div className="mt-3 space-y-3 text-sm"><p className="text-muted">Créez votre compte famille pour inscrire vos enfants en quelques minutes.</p><LinkButton href={`/inscription?next=/clubs/${club.slug}`} className="w-full">Créer un compte</LinkButton><LinkButton href={`/connexion?next=/clubs/${club.slug}`} variant="outline" className="w-full">J'ai déjà un compte</LinkButton></div>
            ) : user.role !== "FAMILY" ? <p className="mt-3 text-sm text-muted">Connectez-vous avec un compte famille pour inscrire un enfant.</p>
            : children.length === 0 ? (
              <div className="mt-3 space-y-3 text-sm"><p className="text-muted">Ajoutez d'abord l'enfant à inscrire.</p><LinkButton href={`/famille/enfants/nouveau?next=/clubs/${club.slug}`} className="w-full">Ajouter un enfant</LinkButton></div>
            ) : (
              <RegisterForm
                feeCents={fee}
                defaultChild={enfant}
                members={children.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, year: c.birthDate.getUTCFullYear(), gender: c.gender }))}
                categories={club.categories.map((c) => ({ id: c.id, name: c.name, min: c.birthYearMin, max: c.birthYearMax, gender: c.gender, price: c.priceCents }))}
              />
            )}
            <p className="mt-4 text-xs text-muted">Frais de service LICENGO : {formatEUR(fee)} par licence. <Link href="/legal/cgu" className="underline">En savoir plus</Link></p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
