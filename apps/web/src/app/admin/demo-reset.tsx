"use client";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Input } from "@/components/ui";
import { resetDemoAction } from "@/app/actions/admin";

export function DemoReset() {
  return (
    <Card className="mt-6 border-amber-200 p-5">
      <h2 className="font-display text-lg font-bold">Réinitialiser la démo</h2>
      <p className="mt-1 text-sm text-muted">Efface tout ce qui a été créé pendant vos présentations (comptes, enfants, dossiers, photos, documents, paiements, commandes) et remet les 12 clubs de démonstration d'origine. Votre compte administrateur est conservé ; vous serez déconnecté.</p>
      <ActionForm action={resetDemoAction} className="mt-4 flex flex-wrap items-center gap-3">
        <Input name="confirm" placeholder="Tapez REINITIALISER" autoComplete="off" className="max-w-xs" />
        <SubmitButton variant="danger">Réinitialiser la démo</SubmitButton>
      </ActionForm>
    </Card>
  );
}
