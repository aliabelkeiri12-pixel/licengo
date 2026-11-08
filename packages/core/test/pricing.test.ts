import { describe, expect, it } from "vitest";
import { addMonths, buildLicenseCheckout, computeShopSplit, splitRefund, formatEUR } from "../src";

describe("buildLicenseCheckout", () => {
  it("cahier des charges : 150 € + 4,99 € = 154,99 €, club 150 €, LICENGO 4,99 €", () => {
    const c = buildLicenseCheckout(15000, 1, 499, new Date("2026-09-01"));
    expect(c.totalCents).toBe(15499);
    expect(c.installments).toHaveLength(1);
    expect(c.installments[0]).toMatchObject({ amountCents: 15499, clubAmountCents: 15000, platformFeeCents: 499 });
    expect(formatEUR(c.totalCents).replace(/\s/g, " ")).toBe("154,99 €");
  });

  it.each([2, 3, 4])("paiement en %ix : somme exacte, frais sur la 1re échéance", (n) => {
    const c = buildLicenseCheckout(15001, n, 499, new Date("2026-09-15"));
    expect(c.installments).toHaveLength(n);
    expect(c.installments.reduce((s, i) => s + i.amountCents, 0)).toBe(15500);
    expect(c.installments.reduce((s, i) => s + i.clubAmountCents, 0)).toBe(15001);
    expect(c.installments.reduce((s, i) => s + i.platformFeeCents, 0)).toBe(499);
    expect(c.installments.slice(1).every((i) => i.platformFeeCents === 0)).toBe(true);
  });

  it("3x 150 € → 54,99 / 50 / 50 mensuel", () => {
    const c = buildLicenseCheckout(15000, 3, 499, new Date("2026-09-15T00:00:00Z"));
    expect(c.installments.map((i) => i.amountCents)).toEqual([5499, 5000, 5000]);
    expect(c.installments.map((i) => i.dueDate.toISOString().slice(0, 10))).toEqual(["2026-09-15", "2026-10-15", "2026-11-15"]);
  });

  it("refuse 0 ou 5 échéances et les montants invalides", () => {
    expect(() => buildLicenseCheckout(15000, 0)).toThrow();
    expect(() => buildLicenseCheckout(15000, 5)).toThrow();
    expect(() => buildLicenseCheckout(-1, 1)).toThrow();
    expect(() => buildLicenseCheckout(10.5, 1)).toThrow();
  });

  it("addMonths gère les fins de mois", () => {
    expect(addMonths(new Date("2027-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(addMonths(new Date("2026-11-30T00:00:00Z"), 3).toISOString().slice(0, 10)).toBe("2027-02-28");
  });
});

describe("boutique et remboursements", () => {
  it("répartit la commission LICENGO", () => {
    const s = computeShopSplit([{ unitPriceCents: 3500, quantity: 2 }, { unitPriceCents: 1200, quantity: 1 }], 500);
    expect(s).toEqual({ subtotalCents: 8200, platformFeeCents: 410, clubAmountCents: 7790 });
  });
  it("rejette les quantités invalides", () => {
    expect(() => computeShopSplit([{ unitPriceCents: 100, quantity: 0 }], 500)).toThrow();
  });
  it("remboursement : part club d'abord, frais seulement si demandé", () => {
    expect(splitRefund(15000, 15000, 499, false)).toEqual({ clubCents: 15000, feeCents: 0 });
    expect(splitRefund(15499, 15000, 499, true)).toEqual({ clubCents: 15000, feeCents: 499 });
    expect(() => splitRefund(15499, 15000, 499, false)).toThrow();
  });
});
