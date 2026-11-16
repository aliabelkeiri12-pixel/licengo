import QRCode from "qrcode";
import { prisma } from "@/server/db";
import { clubContext } from "@/lib/guards";
import { env } from "@/server/env";
import { formatEUR } from "@licengo/core";
import { currentSeason } from "@/server/services/registrations";
import { PrintButton } from "./print-button";
import { Logo } from "@/components/logo";

export const metadata = { title: "Affiche QR code" };

/** Printable A4 poster with the club's QR code, for licence desk sessions. */
export default async function Poster() {
  const { clubId } = await clubContext();
  const club = await prisma.club.findUniqueOrThrow({ where: { id: clubId }, include: { categories: { where: { season: currentSeason(), open: true }, orderBy: { priceCents: "asc" }, take: 1 } } });
  const url = `${env.appUrl}/clubs/${club.slug}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#060B17", light: "#FFFFFF" } });
  const from = club.categories[0]?.priceCents;
  return (
    <div className="mx-auto max-w-[800px] print:max-w-none">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <div className="overflow-hidden rounded-3xl border-4 border-pitch-900 bg-white text-center print:rounded-none print:border-0">
        <div className="bg-pitch-950 px-8 py-8 text-white print:[-webkit-print-color-adjust:exact]">
          <div className="flex justify-center"><Logo light tagline /></div>
          <p className="mt-5 text-lg font-bold uppercase tracking-[0.2em] text-volt-400">Licences saison {currentSeason()}</p>
          <h1 className="font-display mt-2 text-5xl font-black leading-tight">Inscrivez votre joueur<br />depuis votre téléphone</h1>
          <p className="mt-3 text-2xl font-bold">{club.name}</p>
        </div>
        <div className="px-8 py-8">
          <p className="text-2xl font-bold">📱 Scannez avec votre téléphone</p>
          <div className="mx-auto mt-4 w-72 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-3 break-all font-mono text-sm text-muted">{url}</p>
          <ol className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-3 text-left">
            {[["📸", "Photo d'identité"], ["✍️", "Charte du club"], ["🖼️", "Droit à l'image"], ["🩺", "Certificat médical"]].map(([i, t], n) => (
              <li key={t} className="flex items-center gap-3 rounded-2xl bg-chalk p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-volt-500 font-black text-pitch-950">{n + 1}</span><span className="font-bold">{i} {t}</span></li>
            ))}
          </ol>
          <p className="mx-auto mt-4 max-w-xl rounded-2xl bg-pitch-50 px-4 py-3 text-base font-semibold">Le club vérifie votre dossier puis vous envoie le lien de paiement : carte bancaire, <b>en 1 à 4 fois sans frais</b>. Facture disponible dans l'application.</p>
          {club.footclubsMode && <p className="mt-4 rounded-2xl bg-volt-400/40 px-4 py-3 text-lg font-bold">⚠️ N'oubliez pas de remplir aussi votre formulaire de licence FFF reçu par email</p>}
          {from && <p className="mt-4 text-sm text-muted">Licences à partir de {formatEUR(from)} · paiement sécurisé</p>}
        </div>
      </div>
    </div>
  );
}
