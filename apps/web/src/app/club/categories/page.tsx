import { prisma } from "@/server/db";
import { clubContext } from "@/lib/guards";
import { currentSeason, nextSeason } from "@/server/services/registrations";
import { Card, PageHeader, Input, Select, Button, Field } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { saveCategoryAction, generateCategoriesAction, saveClubFeeAction, toggleClubFeeAction } from "@/app/actions/club";
import { formatEUR } from "@licengo/core";
import { Badge, Textarea } from "@/components/ui";

export const metadata = { title: "Catégories" };

function CategoryFields({ c, season }: { c?: { id: string; name: string; birthYearMin: number; birthYearMax: number; priceCents: number; capacity: number | null; maxInstallments: number; gender: string; open: boolean }; season: string }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <input type="hidden" name="season" value={season} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-8 sm:items-end">
        <div className="col-span-2"><Field label="Nom" name="name"><Input name="name" defaultValue={c?.name} required className="h-10" /></Field></div>
        <Field label="Né(e)s de" name="birthYearMin"><Input name="birthYearMin" type="number" defaultValue={c?.birthYearMin} required className="h-10" /></Field>
        <Field label="à" name="birthYearMax"><Input name="birthYearMax" type="number" defaultValue={c?.birthYearMax} required className="h-10" /></Field>
        <Field label="Prix €" name="price"><Input name="price" inputMode="decimal" defaultValue={c ? c.priceCents / 100 : ""} required className="h-10" /></Field>
        <Field label="Places" name="capacity"><Input name="capacity" type="number" defaultValue={c?.capacity ?? ""} className="h-10" /></Field>
        <Field label="Max ×" name="maxInstallments"><Select name="maxInstallments" defaultValue={c?.maxInstallments ?? 4} className="h-10">{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</Select></Field>
        <Field label="Genre" name="gender"><Select name="gender" defaultValue={c?.gender ?? "MIXED"} className="h-10"><option value="MIXED">Mixte</option><option value="F">Féminin</option><option value="M">Masculin</option></Select></Field>
      </div>
      <div className="mt-2 flex items-center justify-between"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="open" defaultChecked={c?.open ?? true} className="accent-pitch-700" /> Inscriptions ouvertes</label><SubmitButton size="sm" variant={c ? "outline" : "primary"}>{c ? "Enregistrer" : "Créer"}</SubmitButton></div>
    </>
  );
}

export default async function Categories({ searchParams }: { searchParams: Promise<{ saison?: string }> }) {
  const { clubId } = await clubContext();
  const season = (await searchParams).saison ?? currentSeason();
  const cats = await prisma.category.findMany({ where: { clubId, season }, orderBy: { birthYearMax: "desc" } });
  const fees = await prisma.clubFee.findMany({ where: { clubId }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <PageHeader title="Catégories & tarifs" subtitle={`Saison ${season}`} action={<div className="flex gap-2">{[currentSeason(), nextSeason(currentSeason())].map((s) => <a key={s} href={`?saison=${s}`} className={`rounded-lg px-3 py-2 text-sm font-semibold ${s === season ? "bg-pitch-800 text-white" : "bg-white ring-1 ring-line"}`}>{s}</a>)}</div>} />
      {cats.length === 0 && (
        <Card className="mb-6 p-5"><p className="text-sm">Aucune catégorie pour {season}. Générez les catégories fédérales standard (U7 à Seniors) puis ajustez les tarifs.</p>
          <form action={generateCategoriesAction} className="mt-3"><input type="hidden" name="season" value={season} /><Button>Générer les catégories FFF {season}</Button></form>
        </Card>
      )}
      <div className="space-y-3">
        {cats.map((c) => <Card key={c.id} className="p-4"><ActionForm action={saveCategoryAction}><CategoryFields c={c} season={season} /></ActionForm></Card>)}
        <Card className="border-dashed p-4"><p className="mb-2 text-sm font-bold">Nouvelle catégorie</p><ActionForm action={saveCategoryAction}><CategoryFields season={season} /></ActionForm></Card>
      </div>

      <h2 className="font-display mb-1 mt-10 text-xl font-bold" id="supplements">Suppléments au tarif</h2>
      <p className="mb-4 text-sm text-muted">Frais de mutation, assurance complémentaire, équipement… <b>Obligatoire</b> : ajouté à toutes les licences. <b>Au choix</b> : la famille le coche à l'inscription, ou vous l'ajoutez sur un dossier.</p>
      <Card className="divide-y divide-line">
        {fees.length === 0 && <p className="p-4 text-sm text-muted">Aucun supplément pour l'instant.</p>}
        {fees.map((f) => (
          <div key={f.id} className={`flex flex-wrap items-center justify-between gap-3 p-4 ${f.active ? "" : "opacity-50"}`}>
            <div><p className="font-semibold">{f.label} <span className="ml-1 font-bold">{formatEUR(f.amountCents)}</span></p>{f.description && <p className="text-xs text-muted">{f.description}</p>}</div>
            <div className="flex items-center gap-3">
              <Badge tone={f.mandatory ? "blue" : "gray"}>{f.mandatory ? "Obligatoire" : "Au choix"}</Badge>
              <form action={toggleClubFeeAction}><input type="hidden" name="feeId" value={f.id} /><button className="text-sm font-semibold text-pitch-700">{f.active ? "Désactiver" : "Réactiver"}</button></form>
            </div>
          </div>
        ))}
      </Card>
      <Card className="mt-3 border-dashed p-4">
        <p className="mb-3 text-sm font-bold">Ajouter un supplément</p>
        <ActionForm action={saveClubFeeAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_170px]" resetOnSuccess>
          <Input name="label" placeholder="Ex : Frais de mutation" required />
          <Input name="amount" placeholder="Montant €" inputMode="decimal" required />
          <Select name="mandatory" defaultValue="no"><option value="no">Au choix de la famille</option><option value="yes">Obligatoire pour tous</option></Select>
          <div className="sm:col-span-3"><Textarea name="description" placeholder="Explication pour les familles (facultatif) : ex. si le joueur était licencié dans un autre club la saison dernière" className="min-h-16" /></div>
          <div><SubmitButton>Ajouter</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}
