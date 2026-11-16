"use client";
import { useState } from "react";

type Fee = { id: string; label: string; amountCents: number; kind: string; mandatory: boolean };
const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";

/** Checkboxes to add the transfer fee (or other fees) when validating, with the live final amount. */
export function FeePicker({ base, fees, chosen, pendingIds }: { base: number; fees: Fee[]; chosen: string[]; pendingIds: string[] }) {
  const [sel, setSel] = useState(() => new Set(fees.filter((f) => f.mandatory || chosen.includes(f.id)).map((f) => f.id)));
  const total = Math.max(0, base + fees.filter((f) => sel.has(f.id) && !pendingIds.includes(f.id)).reduce((s, f) => s + (f.kind === "REDUCTION" ? -f.amountCents : f.amountCents), 0));
  return (
    <div className="rounded-xl bg-chalk p-3 text-sm" data-testid="fee-picker">
      <input type="hidden" name="withFees" value="1" />
      <p className="font-semibold">Montant demandé à la famille</p>
      <div className="mt-2 flex justify-between"><span className="text-muted">Licence</span><span>{eur(base)}</span></div>
      {fees.map((f) => (
        <label key={f.id} className="mt-1 flex items-center gap-2">
          <input type="checkbox" name="extras" value={f.id} checked={sel.has(f.id)} disabled={f.mandatory} className="h-4 w-4 accent-pitch-700"
            onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(f.id); else n.delete(f.id); return n; })} />
          <span className="flex-1">{f.label}{pendingIds.includes(f.id) && <span className="text-xs text-muted"> · après justificatif</span>}</span>
          <span>{f.kind === "REDUCTION" ? "-" : "+"}{eur(f.amountCents)}</span>
        </label>
      ))}
      <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-bold"><span>Total</span><span data-testid="fee-total">{eur(total)}</span></div>
    </div>
  );
}
