import { api } from "@/lib/api";
import { logout } from "@/server/auth";
export const POST = api(async () => { await logout(); return { ok: true }; });
