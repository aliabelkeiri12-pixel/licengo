import { familyUser } from "@/lib/guards";
import { PageHeader, Button } from "@/components/ui";
import { NotificationsList } from "@/components/notifications-list";
import { markAllReadAction } from "@/app/actions/family";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  const u = await familyUser();
  return (
    <>
      <PageHeader title="Notifications" action={<form action={markAllReadAction}><Button variant="outline" size="sm">Tout marquer comme lu</Button></form>} />
      <NotificationsList userId={u.id} />
    </>
  );
}
