import { formatEUR } from "@licengo/core";
import type { Installment } from "@prisma/client";
import { Badge, formatDate } from "./ui";
import { retryInstallmentAction } from "@/app/actions/family";

const st = { SCHEDULED: ["Programmée", "gray"], PROCESSING: ["En cours", "blue"], PAID: ["Payée", "green"], FAILED: ["Échec", "red"], CANCELLED: ["Annulée", "gray"], REFUNDED: ["Remboursée", "amber"] } as const;

export function InstallmentsTable({ installments, total, canRetry }: { installments: Installment[]; total: number; canRetry?: boolean }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {installments.map((i) => (
        <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
          <span><span className="font-semibold">Échéance {i.index}/{total}</span><br /><span className="text-xs text-muted">{i.paidAt ? `Payée le ${formatDate(i.paidAt)}` : `Prévue le ${formatDate(i.dueDate)}`}{i.failureReason ? ` · ${i.failureReason}` : ""}</span></span>
          <span className="flex items-center gap-2">
            <span className="font-semibold tabular-nums">{formatEUR(i.amountCents)}</span>
            <Badge tone={st[i.status][1]}>{st[i.status][0]}</Badge>
            {canRetry && i.status === "FAILED" && <form action={retryInstallmentAction}><input type="hidden" name="installmentId" value={i.id} /><button className="rounded-lg bg-pitch-800 px-2.5 py-1 text-xs font-bold text-white">Payer</button></form>}
          </span>
        </li>
      ))}
    </ul>
  );
}
