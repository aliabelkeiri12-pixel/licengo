import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public-header";

const pages: Record<string, { title: string; body: string[] }> = {
  confidentialite: {
    title: "Politique de confidentialité",
    body: [
      "Responsables de traitement : chaque club pour la gestion de ses licenciés ; LICENGO agit comme sous-traitant (art. 28 RGPD) pour les clubs et comme responsable de traitement pour la gestion des comptes et des paiements.",
      "Données collectées : identité et coordonnées du responsable légal ; identité, date de naissance et genre du licencié ; documents nécessaires à la licence (photo, pièce d'identité, certificat médical ou attestation de questionnaire de santé, autorisations). Aucune donnée n'est utilisée à des fins publicitaires.",
      "Données de santé (art. 9 RGPD) : seuls le certificat médical ou l'attestation de réponse au questionnaire sont conservés — jamais les réponses détaillées. Ils sont chiffrés (AES-256) et accessibles uniquement aux responsables habilités du club. Chaque consultation est journalisée.",
      "Mineurs : les comptes sont tenus par un responsable légal ; aucun mineur de moins de 15 ans ne peut créer de compte seul.",
      "Durées de conservation : dossiers de licence – durée de la saison + 1 an ; pièces justificatives sensibles – supprimées 12 mois après la fin de la licence ; données de paiement – 10 ans (obligation comptable), cartes bancaires conservées exclusivement par Stripe.",
      "Hébergement : Union européenne (France). Sauvegardes chiffrées quotidiennes, rétention 30 jours.",
      "Vos droits : accès, rectification, effacement, portabilité, limitation et opposition depuis votre espace (Paramètres) ou à dpo@licengo.fr. Réclamation possible auprès de la CNIL.",
    ],
  },
  cgu: {
    title: "Conditions générales d'utilisation",
    body: [
      "LICENGO met à disposition des familles et des clubs une plateforme d'inscription, de gestion documentaire, de paiement et de boutique en ligne.",
      "Frais de service : des frais de service LICENGO (4,99 € par licence sauf mention contraire) s'ajoutent au prix de la licence fixé par le club. Ils sont affichés avant tout paiement.",
      "Paiement échelonné : en 2, 3 ou 4 fois sans frais supplémentaires, la première échéance est débitée immédiatement, les suivantes chaque mois à la même date. En cas d'échec, trois nouvelles tentatives sont réalisées et le club est informé.",
      "Remboursement : les demandes sont traitées par le club selon son règlement. Les frais de service LICENGO ne sont pas remboursables sauf erreur ou annulation par le club.",
    ],
  },
  mentions: { title: "Mentions légales", body: ["LICENGO SAS – siège social : France. Hébergeur : Scaleway SAS, 8 rue de la Ville l'Évêque, 75008 Paris. Paiements : Stripe Payments Europe Ltd., établissement de monnaie électronique agréé."] },
};

export default async function Legal({ params }: { params: Promise<{ slug: string }> }) {
  const p = pages[(await params).slug];
  if (!p) notFound();
  return (
    <main>
      <PublicHeader />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold">{p.title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink/90">{p.body.map((b) => <p key={b}>{b}</p>)}</div>
      </article>
    </main>
  );
}
