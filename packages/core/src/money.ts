/** All amounts are handled as integer cents to avoid floating point errors. */
export const toCents = (euros: number) => Math.round(euros * 100);
export const fromCents = (cents: number) => cents / 100;

const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const formatEUR = (cents: number) => fmt.format(cents / 100);

/** Basis points helper: 500 bps = 5 %. Rounded half-up to the cent. */
export const applyBps = (cents: number, bps: number) => Math.round((cents * bps) / 10_000);
