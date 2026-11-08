import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { FamilyFrame, familyNav } from "./family-frame";
import { PublicHeader } from "./public-header";

export async function ShopperFrame({ children, requireAuth }: { children: React.ReactNode; requireAuth?: boolean }) {
  const user = await getCurrentUser();
  if (requireAuth && !user) redirect("/connexion");
  if (user?.role === "FAMILY") {
    const { items, cartCount } = await familyNav(user);
    return <FamilyFrame items={items} cartCount={cartCount} firstName={user.firstName}>{children}</FamilyFrame>;
  }
  return <><PublicHeader /><main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main></>;
}
