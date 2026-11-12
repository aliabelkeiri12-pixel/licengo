"use client";
import { useState } from "react";
import { buildLicenseCheckout, formatEUR } from "@licengo/core";
import { ActionForm, SubmitButton } from "./forms";
import { cx } from "./ui";
import { startPaymentAction } from "@/app/actions/family";

export function InstallmentPicker({ registrationId, licenseCents, feeCents, max }: { registrationId: string; licenseCents: number; feeCents: number; max: number }) {
  const [n, setN] = useState(1);
  const plan = buildLicenseCheckout(licenseCents, n, feeCents);
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
  return (
    <ActionForm action={startPaymentAction} className="space-y-4">
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="installments" value={n} />
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Nombre d'échéances">
        {Array.from({ length: max }, (_, i) => i + 1).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={n === k} onClick={() => setN(k)} className={cx("rounded-xl border-2 py-3 text-center transition", n === k ? "border-pitch-700 bg-pitch-50" : "border-line bg-white hover:border-pitch-100")}>
            <span className="font-display block text-xl font-black">{k}×</span>
            <span className="text-[11px] text-muted">{k === 1 ? "comptant" : "sans frais"}</span>
          </button>
        ))}
      </div>
      <ol className="space-y-1.5 rounded-xl bg-chalk p-3 text-sm">
        {plan.installments.map((i) => (
          <li key={i.index} className="flex justify-between"><span className="text-muted">{i.index === 1 ? "Aujourd'hui" : `Le ${fmt.format(i.dueDate)}`}</span><span className="font-semibold tabular-nums">{formatEUR(i.amountCents)}</span></li>
        ))}
        <li className="flex justify-between border-t border-line pt-1.5 font-bold"><span>Total</span><span>{formatEUR(plan.totalCents)}</span></li>
      </ol>
      {n > 1 && (
        <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-xs leading-relaxed">
          <input type="checkbox" name="balanceClause" required className="mt-0.5 h-4 w-4 shrink-0 accent-pitch-700" data-testid="balance-clause" />
          <span>J'accepte qu'en cas d'échec du prélèvement d'une échéance après 3 tentatives, <b>le solde restant dû soit prélevé en une seule fois</b> sur ma carte, et que le club en soit informé.</span>
        </label>
      )}
      <p className="text-xs text-muted">Dont licence {formatEUR(licenseCents)} versée au club et frais de service LICENGO {formatEUR(feeCents)} (inclus dans la 1re échéance).</p>
      <SubmitButton variant="volt" size="lg" className="w-full">Payer {formatEUR(plan.installments[0].amountCents)} par carte</SubmitButton>
      <p className="text-center text-[11px] text-muted">🔒 Paiement sécurisé 3-D Secure — vos données bancaires ne transitent jamais par LICENGO.</p>
    </ActionForm>
  );
}
