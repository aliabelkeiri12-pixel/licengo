"use client";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { signupAction } from "@/app/actions/auth";

export function SignupForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signupAction} className="space-y-4">
      {(s) => (
        <>
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom" name="firstName" error={s?.fieldErrors?.firstName}><Input name="firstName" autoComplete="given-name" required /></Field>
            <Field label="Nom" name="lastName" error={s?.fieldErrors?.lastName}><Input name="lastName" autoComplete="family-name" required /></Field>
          </div>
          <Field label="Email" name="email" error={s?.fieldErrors?.email}><Input name="email" type="email" autoComplete="email" required /></Field>
          <Field label="Téléphone mobile" name="phone" error={s?.fieldErrors?.phone}><Input name="phone" type="tel" autoComplete="tel" placeholder="06 12 34 56 78" required /></Field>
          <Field label="Mot de passe" name="password" hint="10 caractères minimum, avec majuscule, minuscule et chiffre" error={s?.fieldErrors?.password}><Input name="password" type="password" autoComplete="new-password" minLength={10} required /></Field>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="acceptTerms" className="mt-1 h-4 w-4 accent-pitch-700" required /><span>J'accepte les <Link href="/legal/cgu" className="underline">CGU</Link> et la <Link href="/legal/confidentialite" className="underline">politique de confidentialité</Link>. Je suis responsable légal des mineurs que j'inscris.</span></label>
          {s?.fieldErrors?.acceptTerms && <p className="text-xs text-danger">{s.fieldErrors.acceptTerms}</p>}
          <label className="flex items-start gap-3 text-sm text-muted"><input type="checkbox" name="marketing" className="mt-1 h-4 w-4 accent-pitch-700" /><span>Recevoir les actualités et offres de mon club (facultatif)</span></label>
          <SubmitButton className="w-full" size="lg">Créer mon compte</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
