import { CreditCard, CheckCircle2 } from "lucide-react";
import { prisma } from "@/server/db";
import { clubContext } from "@/lib/guards";
import { env } from "@/server/env";
import { Alert, Card, PageHeader, Input, Field, Textarea, Select, Button, Badge } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { updateClubAction, connectStripeAction, addStaffAction } from "@/app/actions/club";
import { formatEUR } from "@licengo/core";

export const metadata = { title: "Paramètres du club" };

export default async function Settings({ searchParams }: { searchParams: Promise<{ mock_onboarding?: string }> }) {
  const { clubId } = await clubContext();
  const sp = await searchParams;
  const club = await prisma.club.findUniqueOrThrow({ where: { id: clubId }, include: { plan: true, staff: { include: { user: true } } } });
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Paramètres" subtitle={`${club.name} · page publique : /clubs/${club.slug}`} />
      {sp.mock_onboarding && <Alert tone="success">Compte de paiement activé (mode démonstration).</Alert>}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><CreditCard className="h-5 w-5" /> Paiements en ligne</h2>
        {club.stripeChargesEnabled ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-pitch-700"><CheckCircle2 className="h-4 w-4" /> Actif — les cotisations sont versées automatiquement sur le compte bancaire du club (J+2 à J+7).</p>
        ) : <p className="mt-2 text-sm text-muted">Créez votre compte de paiement sécurisé Stripe (IBAN du club, justificatifs d'association). 5 minutes.</p>}
        <form action={connectStripeAction} className="mt-3"><Button variant={club.stripeChargesEnabled ? "outline" : "volt"}>{club.stripeChargesEnabled ? "Gérer mon compte de paiement" : "Activer les paiements"}</Button></form>
        {!env.stripeSecretKey && <p className="mt-2 text-xs text-amber-700">Environnement de démonstration : paiements simulés.</p>}
        <p className="mt-4 text-xs text-muted">Offre <b>{club.plan?.name ?? "Starter"}</b> · {formatEUR(club.plan?.monthlyPriceCents ?? 0)}/mois · frais famille {formatEUR(club.plan?.licenseFeeCents ?? 499)}/licence · commission boutique {(club.plan?.shopCommissionBps ?? 500) / 100} %</p>
      </Card>
      <Card className="p-5">
        <h2 className="font-display text-lg font-bold">Informations du club</h2>
        <ActionForm action={updateClubAction} className="mt-4 space-y-3">
          <Field label="Nom" name="name"><Input name="name" defaultValue={club.name} required /></Field>
          <Field label="Présentation" name="description"><Textarea name="description" defaultValue={club.description ?? ""} /></Field>
          <Field label="Adresse du stade" name="address"><Input name="address" defaultValue={club.address ?? ""} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" name="email"><Input name="email" type="email" defaultValue={club.email ?? ""} /></Field>
            <Field label="Téléphone" name="phone"><Input name="phone" defaultValue={club.phone ?? ""} /></Field>
            <Field label="Couleur principale" name="primaryColor"><Input name="primaryColor" type="color" defaultValue={club.primaryColor} className="p-1" /></Field>
            <Field label="Relance automatique tous les" name="reminderEveryDays" hint="jours, pour les dossiers incomplets"><Input name="reminderEveryDays" type="number" min={1} max={30} defaultValue={club.reminderEveryDays} /></Field>
          </div>
          <SubmitButton>Enregistrer</SubmitButton>
        </ActionForm>
      </Card>
      <Card className="p-5">
        <h2 className="font-display text-lg font-bold">Équipe & droits d'accès</h2>
        <ul className="mt-3 divide-y divide-line text-sm">{club.staff.map((s) => <li key={s.id} className="flex justify-between py-2"><span>{s.user.firstName} {s.user.lastName} <span className="text-muted">· {s.user.email}</span></span><Badge tone="green">{{ OWNER: "Responsable", SECRETARY: "Secrétaire", TREASURER: "Trésorier", COACH: "Éducateur" }[s.role]}</Badge></li>)}</ul>
        <ActionForm action={addStaffAction} className="mt-4 grid gap-2 sm:grid-cols-2" resetOnSuccess>
          <Input name="firstName" placeholder="Prénom" required /><Input name="lastName" placeholder="Nom" required />
          <Input name="email" type="email" placeholder="Email" required /><Input name="password" type="password" placeholder="Mot de passe provisoire (10 car.)" minLength={10} required />
          <Select name="role"><option value="SECRETARY">Secrétaire – dossiers</option><option value="TREASURER">Trésorier – paiements & remboursements</option><option value="COACH">Éducateur – lecture seule</option><option value="OWNER">Responsable – tous droits</option></Select>
          <SubmitButton variant="outline">Ajouter</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
