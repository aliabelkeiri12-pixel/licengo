import { prisma } from "@/server/db";
import { Card, PageHeader, Input, Field } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { savePlanAction } from "@/app/actions/admin";

export const metadata = { title: "Abonnements & commissions" };

export default async function Plans() {
  const plans = await prisma.plan.findMany({ include: { _count: { select: { clubs: true } } }, orderBy: { monthlyPriceCents: "asc" } });
  return (
    <>
      <PageHeader title="Abonnements & commissions" subtitle="Modèle économique : abonnement club + frais de service par licence + commission boutique" />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-pitch-600">{p.code} · {p._count.clubs} club(s)</p>
            <ActionForm action={savePlanAction} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={p.id} />
              <Field label="Nom" name="name"><Input name="name" defaultValue={p.name} /></Field>
              <Field label="Abonnement mensuel (€)" name="monthly"><Input name="monthly" inputMode="decimal" defaultValue={p.monthlyPriceCents / 100} /></Field>
              <Field label="Frais LICENGO par licence (€)" name="fee"><Input name="fee" inputMode="decimal" defaultValue={p.licenseFeeCents / 100} /></Field>
              <Field label="Commission boutique (%)" name="commission"><Input name="commission" inputMode="decimal" defaultValue={p.shopCommissionBps / 100} /></Field>
              <Field label="Licenciés max (vide = illimité)" name="maxLicensees"><Input name="maxLicensees" type="number" defaultValue={p.maxLicensees ?? ""} /></Field>
              <SubmitButton size="sm">Enregistrer</SubmitButton>
            </ActionForm>
          </Card>
        ))}
      </div>
    </>
  );
}
