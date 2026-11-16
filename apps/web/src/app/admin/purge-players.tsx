"use client";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input } from "@/components/ui";
import { purgePlayersAction } from "@/app/actions/admin";

export function PurgePlayers() {
  return (
    <Card className="mt-6 border-red-200 p-5">
      <h2 className="font-display text-lg font-bold">Remettre les joueurs à zéro</h2>
      <p className="mt-1 text-sm text-muted">Efface <b>tous les joueurs de tous les clubs et de toutes les équipes</b> (dossiers, documents, signatures, paiements, factures), sauf celui que vous indiquez. Les comptes, les clubs, les catégories et la boutique sont conservés.</p>
      <ActionForm action={purgePlayersAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
        <Field label="Joueur à garder" name="keep"><Input name="keep" defaultValue="Idriss Dramé" required /></Field>
        <Field label="Confirmation" name="confirm"><Input name="confirm" placeholder="Tapez EFFACER" autoComplete="off" /></Field>
        <SubmitButton variant="danger">Effacer les autres</SubmitButton>
      </ActionForm>
    </Card>
  );
}
