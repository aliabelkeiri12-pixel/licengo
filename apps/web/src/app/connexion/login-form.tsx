"use client";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { loginAction } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={loginAction} className="space-y-4">
      {(s) => (
        <>
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="Email" name="email" error={s?.fieldErrors?.email}><Input name="email" type="email" autoComplete="email" required /></Field>
          <Field label="Mot de passe" name="password" error={s?.fieldErrors?.password}><Input name="password" type="password" autoComplete="current-password" required /></Field>
          <div className="text-right"><a href="/mot-de-passe" className="text-sm font-semibold text-pitch-700">Mot de passe oublié ?</a></div>
          <SubmitButton className="w-full" size="lg">Se connecter</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
