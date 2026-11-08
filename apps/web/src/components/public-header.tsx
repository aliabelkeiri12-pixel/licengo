import Link from "next/link";
import { Logo } from "./logo";
import { buttonClass } from "./ui";
import { getCurrentUser } from "@/server/auth";

export async function PublicHeader({ dark = false }: { dark?: boolean }) {
  const user = await getCurrentUser();
  const home = user ? (user.role === "ADMIN" ? "/admin" : user.role === "CLUB_STAFF" ? "/club" : "/famille") : null;
  return (
    <header className={dark ? "text-white" : ""}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" aria-label="Accueil LICENGO"><Logo light={dark} /></Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/clubs" className={`hidden rounded-lg px-3 py-2 text-sm font-semibold sm:block ${dark ? "text-white/80 hover:text-white" : "text-muted hover:text-ink"}`}>Trouver un club</Link>
          <Link href="/clubs/inscription" className={`hidden rounded-lg px-3 py-2 text-sm font-semibold md:block ${dark ? "text-white/80 hover:text-white" : "text-muted hover:text-ink"}`}>Espace clubs</Link>
          {home ? (
            <Link href={home} className={buttonClass("volt", "sm")}>Mon espace</Link>
          ) : (
            <>
              <Link href="/connexion" className={`rounded-lg px-3 py-2 text-sm font-semibold ${dark ? "text-white" : "text-ink"}`}>Connexion</Link>
              <Link href="/inscription" className={buttonClass("volt", "sm")}>Créer un compte</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
