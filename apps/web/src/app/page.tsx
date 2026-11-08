import Link from "next/link";
import { ArrowRight, Camera, CreditCard, FileCheck2, ShieldCheck, ShoppingBag, Users, BellRing, LayoutDashboard } from "lucide-react";
import { SPORTS, formatEUR } from "@licengo/core";
import { PublicHeader } from "@/components/public-header";
import { buttonClass } from "@/components/ui";
import { Logo } from "@/components/logo";

const features = [
  { icon: Users, title: "Un compte pour toute la famille", text: "Ajoutez vos enfants une seule fois. Leurs informations et documents sont réutilisés chaque saison." },
  { icon: Camera, title: "Documents depuis le téléphone", text: "Photographiez pièce d'identité, photo et justificatifs. Vérification automatique du format et des pièces manquantes." },
  { icon: FileCheck2, title: "Signature électronique", text: "Autorisation parentale, règlement intérieur, droit à l'image et questionnaire de santé signés en un geste." },
  { icon: CreditCard, title: "Paiement en 1 à 4 fois", text: "Carte bancaire sécurisée. Le club reçoit directement sa part, les échéances sont prélevées automatiquement." },
  { icon: ShoppingBag, title: "La boutique du club", text: "Maillots, survêtements, parkas… avec tailles, flocage et retrait au club." },
  { icon: BellRing, title: "Notifications & renouvellement", text: "Statut du dossier, relances, échéances et réinscription annuelle en un clic." },
];

export default function Home() {
  const checkout = { license: 15000, fee: 499 };
  return (
    <main>
      <section className="relative overflow-hidden bg-pitch-900 pitch-lines">
        <PublicHeader dark />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 pt-10 sm:px-6 md:grid-cols-2 md:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-volt-400 ring-1 ring-white/15">⚽ Saison 2026-2027 · Football — d'autres sports arrivent</p>
            <h1 className="font-display mt-5 text-4xl font-black leading-[1.05] text-white sm:text-6xl">
              La licence sportive,<br /><span className="text-volt-500">sans paperasse.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/75">Inscriptions, dossiers, paiements échelonnés et boutique : LICENGO réunit familles et clubs sur une seule plateforme, sur iPhone, Android et ordinateur.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/clubs" className={buttonClass("volt", "lg")}>Trouver mon club <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/clubs/inscription" className={buttonClass("outline", "lg") + " !bg-transparent !text-white !border-white/25 hover:!bg-white/10"}>Je suis un club</Link>
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm text-white/60"><ShieldCheck className="h-4 w-4 text-volt-500" /> Données hébergées en France · Conforme RGPD · Paiements certifiés PCI-DSS</div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-[2rem] border border-white/10 bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between"><Logo /><span className="rounded-full bg-pitch-50 px-2 py-0.5 text-xs font-bold text-pitch-700">U11</span></div>
              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">Dossier de Léo</p>
              <p className="font-display text-xl font-extrabold">FC Lyon Est</p>
              <div className="mt-3 h-2 rounded-full bg-pitch-50"><div className="h-2 w-4/5 rounded-full bg-volt-500" /></div>
              <ul className="mt-4 space-y-2 text-sm">
                {["Photo d'identité", "Pièce d'identité", "Autorisation parentale signée", "Questionnaire de santé"].map((t, i) => (
                  <li key={t} className="flex items-center gap-2"><span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${i < 3 ? "bg-pitch-700 text-white" : "border border-line"}`}>{i < 3 ? "✓" : ""}</span>{t}</li>
                ))}
              </ul>
              <div className="mt-5 rounded-2xl bg-chalk p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted">Licence</span><span>{formatEUR(checkout.license)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Frais de service</span><span>{formatEUR(checkout.fee)}</span></div>
                <div className="mt-2 flex justify-between border-t border-line pt-2 font-bold"><span>Total</span><span>{formatEUR(checkout.license + checkout.fee)}</span></div>
                <p className="mt-2 text-xs text-muted">ou 3 × à partir de {formatEUR(5000)} — 1re échéance {formatEUR(5499)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl font-extrabold">Pensé pour les familles</h2>
        <p className="mt-2 max-w-2xl text-muted">Inscrire ses enfants prend 5 minutes, depuis le canapé.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-line bg-white p-6">
              <f.icon className="h-6 w-6 text-pitch-700" />
              <h3 className="mt-4 font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div>
            <LayoutDashboard className="h-7 w-7 text-pitch-700" />
            <h2 className="font-display mt-3 text-3xl font-extrabold">Et libère les secrétaires de club</h2>
            <ul className="mt-5 space-y-3 text-sm">
              {[
                "Détection automatique des pièces manquantes, documents expirés et catégories incohérentes",
                "Validation, refus ou demande de correction avec motif en un clic",
                "Relances automatiques des familles et des impayés",
                "Encaissements versés directement sur le compte du club",
                "Boutique, stocks et commandes intégrés",
              ].map((t) => <li key={t} className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-volt-500" />{t}</li>)}
            </ul>
            <Link href="/clubs/inscription" className={buttonClass("primary", "lg") + " mt-8"}>Inscrire mon club gratuitement</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[["Dossiers complets", "86 %"], ["Saisie évitée", "-12 h/sem."], ["Paiements reçus", "J+2"], ["Relances", "Auto"]].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-pitch-900 p-5 text-white"><p className="text-xs font-bold uppercase tracking-wider text-volt-400">{l}</p><p className="font-display mt-2 text-3xl font-black">{v}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl font-extrabold">Multisport</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          {SPORTS.map((s) => (
            <span key={s.slug} className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ${s.active ? "bg-pitch-800 text-white ring-pitch-800" : "bg-white text-muted ring-line"}`}>
              {s.emoji} {s.name} {!s.active && <span className="ml-1 text-xs">· bientôt</span>}
            </span>
          ))}
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <div className="flex flex-wrap gap-4">
            <Link href="/legal/confidentialite">Confidentialité</Link>
            <Link href="/legal/cgu">CGU</Link>
            <Link href="/legal/mentions">Mentions légales</Link>
          </div>
          <p>© {new Date().getFullYear()} LICENGO</p>
        </div>
      </footer>
    </main>
  );
}
