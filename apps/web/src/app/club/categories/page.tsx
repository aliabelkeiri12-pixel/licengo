import { prisma } from "@/server/db";
import { clubContext } from "@/lib/guards";
import { currentSeason, nextSeason } from "@/server/services/registrations";
import { Card, PageHeader, Input, Select, Button, Field } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { saveCategoryAction, generateCategoriesAction } from "@/app/actions/club";

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
    </>
  );
}
