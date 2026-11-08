import { z } from "zod";
import { api, json } from "@/lib/api";
import { requireUser } from "@/server/auth";
import { setHealthAnswer } from "@/server/services/registrations";

export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { answer } = z.object({ answer: z.enum(["ALL_NO", "SOME_YES"]) }).parse(await json(req));
  return setHealthAnswer(await requireUser("FAMILY"), (await params).id, answer);
});
