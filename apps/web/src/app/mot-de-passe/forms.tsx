"use client";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { requestResetAction, resetPasswordAction } from "@/app/actions/password";

export function ResetRequestForm() {
  return (
    <ActionForm action={requestResetAction} className="space-y-4">
      {(s) => (<><Field label="Email du compte" name="email" error={s?.fieldErrors?.[""]}><Input name="email" type="email" autoComplete="email" required /></Field><SubmitButton className="w-full" size="lg">Envoyer le lien</SubmitButton></>)}
    </ActionForm>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetPasswordAction} className="space-y-4">
      {(s) => (
        <>
          <input type="hidden" name="token" value={token} />
          <Field label="Nouveau mot de passe" name="password" hint="10 caractères, majuscule, minuscule, chiffre" error={s?.fieldErrors?.[""]}><Input name="password" type="password" autoComplete="new-password" minLength={10} required /></Field>
          <Field label="Confirmation" name="confirm"><Input name="confirm" type="password" autoComplete="new-password" required /></Field>
          <SubmitButton className="w-full" size="lg">Enregistrer</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
