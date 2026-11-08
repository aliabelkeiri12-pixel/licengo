import { api } from "@/lib/api";
import { requireUser } from "@/server/auth";
import { submitRegistration } from "@/server/services/registrations";

export const POST = api<{ params: Promise<{ id: string }> }>(async (_, { params }) => submitRegistration(await requireUser("FAMILY"), (await params).id));
