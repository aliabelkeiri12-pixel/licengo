"use client";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input } from "@/components/ui";
import { updateProfileAction, deleteAccountAction } from "@/app/actions/family";

export function AccountForms({ user, family }: { user: { firstName: string; lastName: string; phone: string; marketing: boolean }; family: { address: string; postalCode: string; city: string } }) {
  return (
    <>
      <Card className="p-5 sm:p-6">
        <ActionForm action={updateProfileAction} className="space-y-4">
          {(s) => (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prénom" name="firstName"><Input name="firstName" defaultValue={user.firstName} required /></Field>
                <Field label="Nom" name="lastName"><Input name="lastName" defaultValue={user.lastName} required /></Field>
              </div>
              <Field label="Téléphone" name="phone" error={s?.fieldErrors?.phone}><Input name="phone" defaultValue={user.phone} required /></Field>
              <Field label="Adresse" name="address"><Input name="address" defaultValue={family.address} /></Field>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <Field label="Code postal" name="postalCode"><Input name="postalCode" defaultValue={family.postalCode} /></Field>
                <Field label="Ville" name="city"><Input name="city" defaultValue={family.city} /></Field>
              </div>
              <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="marketing" defaultChecked={user.marketing} className="h-4 w-4 accent-pitch-700" /> Recevoir les actualités de mes clubs</label>
              <SubmitButton>Enregistrer</SubmitButton>
            </>
          )}
        </ActionForm>
      </Card>
      <Card className="border-red-200 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-danger">Supprimer mon compte</h2>
        <p className="mt-1 text-sm text-muted">Vos documents et données personnelles seront effacés. Les justificatifs de paiement sont conservés 10 ans (obligation légale), sous forme anonymisée.</p>
        <ActionForm action={deleteAccountAction} className="mt-4 flex flex-wrap items-end gap-3">
          <Field label='Tapez "SUPPRIMER"' name="confirm"><Input name="confirm" autoComplete="off" /></Field>
          <SubmitButton variant="danger">Supprimer définitivement</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
