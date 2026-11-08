import { familyUser } from "@/lib/guards";
import { Card, PageHeader } from "@/components/ui";
import { ChildForm } from "@/components/child-form";

export const metadata = { title: "Ajouter un enfant" };

export default async function NewChild({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const u = await familyUser();
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ajouter un membre" subtitle="Ces informations seront réutilisées pour toutes ses inscriptions." />
      <Card className="p-5 sm:p-6"><ChildForm defaultLastName={u.lastName} next={next} /></Card>
    </div>
  );
}
