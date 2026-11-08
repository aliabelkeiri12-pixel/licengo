import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/server/auth";

export async function familyUser(): Promise<SessionUser & { familyId: string }> {
  const u = await getCurrentUser();
  if (!u) redirect("/connexion");
  if (u.role !== "FAMILY" || !u.familyId) redirect(u.role === "ADMIN" ? "/admin" : "/club");
  return u as SessionUser & { familyId: string };
}

export async function staffUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/connexion");
  if (u.role === "FAMILY") redirect("/famille");
  if (u.role === "ADMIN") return { user: u, clubId: null as string | null };
  const clubId = u.staff[0]?.clubId;
  if (!clubId) redirect("/");
  return { user: u, clubId };
}

export async function adminUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/connexion");
  if (u.role !== "ADMIN") redirect("/");
  return u;
}

export async function clubContext() {
  const { user, clubId } = await staffUser();
  if (!clubId) redirect("/admin/clubs");
  return { user, clubId };
}
