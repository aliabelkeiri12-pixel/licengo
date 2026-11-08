import { FamilyFrame, familyNav } from "@/components/family-frame";
import { familyUser } from "@/lib/guards";

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const user = await familyUser();
  const { items, cartCount } = await familyNav(user);
  return <FamilyFrame items={items} cartCount={cartCount} firstName={user.firstName}>{children}</FamilyFrame>;
}
