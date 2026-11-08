"use client";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { simulatePaymentAction } from "@/app/actions/payments";

export function SimulationForm({ installmentId }: { installmentId: string }) {
  return (
    <ActionForm action={simulatePaymentAction} className="mt-6 space-y-3">
      <input type="hidden" name="installmentId" value={installmentId} />
      <Field label="Numéro de carte" name="card" hint="4242 4242 4242 4242 = succès · 4000 0000 0000 0002 = refusée · 4000 0000 0000 0341 = échéances suivantes en échec">
        <Input name="card" inputMode="numeric" defaultValue="4242 4242 4242 4242" autoComplete="cc-number" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiration" name="exp"><Input name="exp" defaultValue="12/30" /></Field>
        <Field label="CVC" name="cvc"><Input name="cvc" defaultValue="123" /></Field>
      </div>
      <SubmitButton variant="volt" size="lg" className="w-full">Payer</SubmitButton>
    </ActionForm>
  );
}
