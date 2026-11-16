"use client";
import { ActionForm, SubmitButton } from "@/components/forms";
import { deleteFamilyAction } from "@/app/actions/admin";

/** Deletes a family entirely: it no longer appears anywhere. */
export function DeleteFamily({ userId, name }: { userId: string; name: string }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-semibold text-danger">Supprimer…</summary>
      <ActionForm action={deleteFamilyAction} className="mt-2 w-56 space-y-2">
        <input type="hidden" name="userId" value={userId} />
        <label className="flex items-start gap-2"><input type="checkbox" name="confirmDelete" className="mt-0.5 accent-red-600" /> Supprimer définitivement la famille {name} (compte, joueurs, dossiers, paiements, factures)</label>
        <SubmitButton size="sm" variant="danger">Supprimer la famille</SubmitButton>
      </ActionForm>
    </details>
  );
}
