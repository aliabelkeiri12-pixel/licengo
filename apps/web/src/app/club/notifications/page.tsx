import { clubContext } from "@/lib/guards";
import { PageHeader, Button } from "@/components/ui";
import { NotificationsList } from "@/components/notifications-list";
import { markAllReadAction } from "@/app/actions/family";

export default async function ClubNotifications() {
  const { user } = await clubContext();
  return <><PageHeader title="Notifications" action={<form action={markAllReadAction}><Button variant="outline" size="sm">Tout marquer comme lu</Button></form>} /><NotificationsList userId={user.id} /></>;
}
