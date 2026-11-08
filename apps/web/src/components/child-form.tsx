"use client";
import { ActionForm, SubmitButton } from "./forms";
import { Field, Input, Select } from "./ui";
import { saveChildAction } from "@/app/actions/family";

type Child = { id: string; firstName: string; lastName: string; birthDate: string; gender: string; birthPlace: string | null; nationality: string | null; isSelf: boolean };

export function ChildForm({ child, defaultLastName, next }: { child?: Child; defaultLastName?: string; next?: string }) {
  return (
    <ActionForm action={saveChildAction} className="space-y-4">
      {(s) => (
        <>
          {child && <input type="hidden" name="id" value={child.id} />}
          {next && <input type="hidden" name="next" value={next} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" name="firstName" error={s?.fieldErrors?.firstName}><Input name="firstName" defaultValue={child?.firstName} required /></Field>
            <Field label="Nom" name="lastName" error={s?.fieldErrors?.lastName}><Input name="lastName" defaultValue={child?.lastName ?? defaultLastName} required /></Field>
            <Field label="Date de naissance" name="birthDate" error={s?.fieldErrors?.birthDate}><Input name="birthDate" type="date" defaultValue={child?.birthDate} max={new Date().toISOString().slice(0, 10)} required /></Field>
            <Field label="Genre" name="gender" error={s?.fieldErrors?.gender} hint="Utilisé pour l'affectation aux catégories fédérales"><Select name="gender" defaultValue={child?.gender ?? ""} required><option value="" disabled>Choisir…</option><option value="F">Fille</option><option value="M">Garçon</option></Select></Field>
            <Field label="Lieu de naissance" name="birthPlace" hint="Demandé par la fédération pour la licence"><Input name="birthPlace" defaultValue={child?.birthPlace ?? ""} /></Field>
            <Field label="Nationalité" name="nationality"><Input name="nationality" defaultValue={child?.nationality ?? "Française"} /></Field>
          </div>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="isSelf" defaultChecked={child?.isSelf} className="h-4 w-4 accent-pitch-700" /> C'est moi (licencié adulte)</label>
          <p className="rounded-xl bg-pitch-50 p-3 text-xs text-pitch-800">🔒 Nous ne demandons que les informations exigées pour la licence. Elles ne sont partagées qu'avec le club choisi.</p>
          <SubmitButton size="lg" className="w-full sm:w-auto">{child ? "Enregistrer" : "Ajouter"}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
