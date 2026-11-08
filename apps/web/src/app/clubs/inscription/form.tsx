"use client";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Select } from "@/components/ui";
import { clubSignupAction } from "@/app/actions/auth";

export function ClubSignupForm({ sports }: { sports: { slug: string; label: string; active: boolean }[] }) {
  return (
    <ActionForm action={clubSignupAction} className="space-y-4">
      {(s) => (
        <>
          <p className="text-xs font-bold uppercase tracking-wider text-pitch-600">Le club</p>
          <Field label="Nom du club" name="clubName" error={s?.fieldErrors?.clubName}><Input name="clubName" required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sport" name="sport"><Select name="sport" defaultValue="football">{sports.map((sp) => <option key={sp.slug} value={sp.slug} disabled={!sp.active}>{sp.label}</option>)}</Select></Field>
            <Field label="N° d'affiliation" name="federationNumber" hint="Ex. FFF : 6 chiffres"><Input name="federationNumber" /></Field>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <Field label="Code postal" name="postalCode" error={s?.fieldErrors?.postalCode}><Input name="postalCode" inputMode="numeric" maxLength={5} required /></Field>
            <Field label="Ville" name="city" error={s?.fieldErrors?.city}><Input name="city" required /></Field>
          </div>
          <p className="pt-2 text-xs font-bold uppercase tracking-wider text-pitch-600">Le responsable</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom" name="firstName" error={s?.fieldErrors?.firstName}><Input name="firstName" required /></Field>
            <Field label="Nom" name="lastName" error={s?.fieldErrors?.lastName}><Input name="lastName" required /></Field>
          </div>
          <Field label="Email" name="email" error={s?.fieldErrors?.email}><Input name="email" type="email" required /></Field>
          <Field label="Téléphone" name="phone" error={s?.fieldErrors?.phone}><Input name="phone" type="tel" required /></Field>
          <Field label="Mot de passe" name="password" error={s?.fieldErrors?.password} hint="10 caractères, majuscule, minuscule, chiffre"><Input name="password" type="password" minLength={10} required /></Field>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="acceptTerms" className="mt-1 h-4 w-4 accent-pitch-700" required /><span>J'accepte les conditions générales et le contrat de sous-traitance des données (art. 28 RGPD).</span></label>
          <SubmitButton className="w-full" size="lg">Créer l'espace du club</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
