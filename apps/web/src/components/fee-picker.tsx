"use client";
import { useState } from "react";

type Fee = { id: string; label: string; amountCents: number; kind: string; mandatory: boolean; proofDocId?: string | null; proofAsked?: boolean };
const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";

/** Checkboxes to add the transfer fee (or other fees) when validating, with the live final amount. */
export function FeePicker({ base, fees, chosen, pendingIds }: { base: number; fees: Fee[]; chosen: string[]; pendingIds: string[] }) {
  // a reduction whose proof was uploaded by the family is pre-ticked: the club checks the document and confirms
  const [amt, setAmt] = useState<Record<string, string>>(() => Object.fromEntries(fees.filter((f) => f.kind !== "REDUCTION").map((f) => [f.id, (f.amountCents / 100).toString().replace(".", ",")])));
  const cents = (f: Fee) => (f.kind === "REDUCTION" ? f.amountCents : Math.round((Number((amt[f.id] ?? "").replace(",", ".")) || 0) * 100));
  const [sel, setSel] = useState(() => new Set(fees.filter((f) => f.mandatory || chosen.includes(f.id) || !!f.proofDocId).map((f) => f.id)));
  const total = Math.max(0, base + fees.filter((f) => sel.has(f.id) && !pendingIds.includes(f.id)).reduce((s, f) => s + (f.kind === "REDUCTION" ? -f.amountCents : cents(f)), 0));
  return (
    <div className="rounded-xl bg-chalk p-3 text-sm" data-testid="fee-picker">
      <input type="hidden" name="withFees" value="1" />
      <p className="font-semibold">Montant demandé à la famille</p>
      <p className="text-xs text-muted">Cochez selon votre vérification : joueur muté, habitant de la commune, ARS, Pass'Sport…</p>
      <div className="mt-2 flex justify-between"><span className="text-muted">Licence</span><span>{eur(base)}</span></div>
      {fees.map((f) => (
        <label key={f.id} className="mt-1 flex items-center gap-2">
          <input type="checkbox" name="extras" value={f.id} checked={sel.has(f.id)} disabled={f.mandatory} className="h-4 w-4 accent-pitch-700"
            onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(f.id); else n.delete(f.id); return n; })} />
          <span className="flex-1">{f.label}{pendingIds.includes(f.id) && <span className="text-xs text-muted"> · après justificatif</span>}
            {f.proofDocId ? <a href={`/api/documents/${f.proofDocId}`} target="_blank" rel="noreferrer" className="block text-xs font-semibold text-pitch-700 underline">📎 Justificatif fourni : voir</a>
              : f.proofAsked && <span className="block text-xs text-muted">Aucun justificatif déposé</span>}</span>
          {f.kind === "REDUCTION" ? <span>-{eur(f.amountCents)}</span> : (
            <span className="flex items-center gap-1">+<input name={`amount_${f.id}`} value={amt[f.id]} inputMode="decimal" aria-label={`Montant ${f.label}`} data-testid={`amount-${f.label}`}
              onChange={(e) => { const v = e.target.value; setAmt((a) => ({ ...a, [f.id]: v })); if (v && !sel.has(f.id)) setSel((s) => new Set(s).add(f.id)); }}
              className="h-8 w-20 rounded-lg border border-line bg-white px-2 text-right text-sm" /> €</span>
          )}
        </label>
      ))}
      <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-bold"><span>Total</span><span data-testid="fee-total">{eur(total)}</span></div>
    </div>
  );
}
