import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export function LogoutButton({ light = true }: { light?: boolean }) {
  return (
    <form action={logoutAction}>
      <button className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${light ? "text-white/70 hover:text-white" : "text-muted hover:text-ink"}`} aria-label="Se déconnecter">
        <LogOut className="h-4 w-4" /><span className="hidden lg:inline">Déconnexion</span>
      </button>
    </form>
  );
}
