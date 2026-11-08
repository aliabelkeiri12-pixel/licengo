import { applyBps } from "./money";

export const MAX_INSTALLMENTS = 4;
export const DEFAULT_PLATFORM_FEE_CENTS = 499; // 4,99 € frais LICENGO par licence

export interface ScheduledInstallment {
  index: number; // 1-based
  dueDate: Date;
  amountCents: number; // total debited from the family
  clubAmountCents: number; // transferred to the club's connected account
  platformFeeCents: number; // kept by LICENGO (application fee)
}

export interface LicenseCheckout {
  licenseCents: number;
  platformFeeCents: number;
  totalCents: number;
  installments: ScheduledInstallment[];
}

/** Adds `months` calendar months, clamping to the end of month (31 jan + 1 = 28/29 feb). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * Builds the payment schedule of a licence.
 * Example: 150 € + 4,99 € in 3x → 54,99 € today, then 50 € and 50 € monthly.
 * Rules:
 *  - the licence amount is split evenly, the remainder cents go on the first installment;
 *  - LICENGO fees are collected entirely on the first installment (no platform risk on later defaults);
 *  - the club receives exactly the licence amount, the sum of installments equals the total.
 */
export function buildLicenseCheckout(
  licenseCents: number,
  installmentsCount: number,
  platformFeeCents = DEFAULT_PLATFORM_FEE_CENTS,
  firstDueDate: Date = new Date(),
): LicenseCheckout {
  if (!Number.isInteger(licenseCents) || licenseCents <= 0) throw new Error("Montant de licence invalide");
  if (!Number.isInteger(installmentsCount) || installmentsCount < 1 || installmentsCount > MAX_INSTALLMENTS)
    throw new Error(`Le paiement se fait en 1 à ${MAX_INSTALLMENTS} fois`);
  if (!Number.isInteger(platformFeeCents) || platformFeeCents < 0) throw new Error("Frais invalides");

  const base = Math.floor(licenseCents / installmentsCount);
  const remainder = licenseCents - base * installmentsCount;
  const installments: ScheduledInstallment[] = [];
  for (let i = 0; i < installmentsCount; i++) {
    const club = base + (i === 0 ? remainder : 0);
    const fee = i === 0 ? platformFeeCents : 0;
    installments.push({
      index: i + 1,
      dueDate: addMonths(firstDueDate, i),
      clubAmountCents: club,
      platformFeeCents: fee,
      amountCents: club + fee,
    });
  }
  return { licenseCents, platformFeeCents, totalCents: licenseCents + platformFeeCents, installments };
}

export interface CartLine { unitPriceCents: number; quantity: number }

export interface ShopSplit {
  subtotalCents: number;
  platformFeeCents: number; // LICENGO commission
  clubAmountCents: number; // club revenue (includes its own margin, supplier is paid by the club)
}

/** Splits a shop order between the club and LICENGO using a commission rate in basis points. */
export function computeShopSplit(lines: CartLine[], platformCommissionBps: number): ShopSplit {
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) throw new Error("Quantité invalide");
    if (!Number.isInteger(l.unitPriceCents) || l.unitPriceCents < 0) throw new Error("Prix invalide");
  }
  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const platformFeeCents = applyBps(subtotalCents, platformCommissionBps);
  return { subtotalCents, platformFeeCents, clubAmountCents: subtotalCents - platformFeeCents };
}

/** Proportional refund split: refunds the club part first, LICENGO fee refunded only when asked. */
export function splitRefund(
  amountCents: number,
  paidClubCents: number,
  paidFeeCents: number,
  refundPlatformFee: boolean,
): { clubCents: number; feeCents: number } {
  const max = paidClubCents + (refundPlatformFee ? paidFeeCents : 0);
  if (amountCents <= 0 || amountCents > max) throw new Error("Montant de remboursement invalide");
  const clubCents = Math.min(amountCents, paidClubCents);
  return { clubCents, feeCents: amountCents - clubCents };
}
