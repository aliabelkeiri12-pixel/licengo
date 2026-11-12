import { z } from "zod";
import { api, json } from "@/lib/api";
import { requireUser } from "@/server/auth";
import { startLicensePayment } from "@/server/services/payments";

/** Returns the hosted checkout URL, opened by the mobile app in an in-app browser. */
export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { installments, acceptBalanceClause } = z.object({ installments: z.number().int().min(1).max(4), acceptBalanceClause: z.boolean().optional() }).parse(await json(req));
  return startLicensePayment(await requireUser("FAMILY"), (await params).id, installments, { acceptBalanceClause });
});
