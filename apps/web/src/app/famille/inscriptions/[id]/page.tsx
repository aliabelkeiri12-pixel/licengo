import { notFound } from "next/navigation";
import { CheckCircle2, Circle, AlertCircle, History, MessageSquareWarning } from "lucide-react";
import { DOCUMENT_LABELS, SIGNATURE_LABELS, formatEUR, type SignableDocument } from "@licengo/core";
import { prisma } from "@/server/db";
import { familyUser } from "@/lib/guards";
import { getRegistration, computeCompleteness, nextSeason } from "@/server/services/registrations";
import { Alert, Card, PageHeader, PaymentBadge, Progress, RegistrationBadge, formatDateTime, Button } from "@/components/ui";
import { DocumentUploader } from "@/components/document-uploader";
import { DocumentRow } from "@/components/document-list";
import { SignaturePad } from "@/components/signature-pad";
import { InstallmentPicker } from "@/components/installment-picker";
import { InstallmentsTable } from "@/components/installments-table";
import { ActionForm, SubmitButton } from "@/components/forms";
import { submitRegistrationAction, healthAnswerAction, renewAction, cancelRegistrationAction } from "@/app/actions/family";

export const metadata = { title: "Dossier d'inscription" };

const SIGN_TEXT: Record<SignableDocument, string> = {
  PARENTAL_AUTHORIZATION: "Je soussigné(e), responsable légal, autorise mon enfant à pratiquer l'activité au sein du club, à être transporté lors des déplacements organisés par le club, et autorise les responsables à prendre toute mesure médicale d'urgence nécessaire.",
  CLUB_RULES: "Je reconnais avoir pris connaissance du règlement intérieur du club et m'engage à le respecter, ainsi que la charte de bonne conduite du sport amateur.",
  IMAGE_RIGHTS: "J'autorise le club à utiliser les photos et vidéos où apparaît le licencié, dans le cadre de sa communication (site, réseaux sociaux, presse locale). Ce consentement est facultatif et révocable à tout moment.",
  HEALTH_QUESTIONNAIRE: "J'atteste avoir rempli le questionnaire de santé (QS-SPORT, arrêté du 7 mai 2021) et avoir répondu NON à toutes les questions. Aucune réponse détaillée n'est transmise au club.",
};

export default async function RegistrationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paiement?: string }> }) {
  const u = await familyUser();
  const { id } = await params;
  const { paiement } = await searchParams;
  const r = await getRegistration(id).catch(() => null);
  if (!r || r.child.familyId !== u.familyId) notFound();
  const c = await computeCompleteness(r);
  const docs = await prisma.document.findMany({ where: { childId: r.childId, deletedAt: null }, orderBy: { createdAt: "desc" } });
  const editable = ["DRAFT", "INCOMPLETE", "TO_FIX"].includes(r.status);
  const payment = r.payments.find((p) => !["CANCELLED", "PENDING"].includes(p.status));
  const signed = new Map(r.signatures.map((s) => [s.type, s]));
  const signatures: SignableDocument[] = [...c.requiredSignatures, ...(c.requiredSignatures.includes("IMAGE_RIGHTS") ? [] : (["IMAGE_RIGHTS"] as const))];
  const hasNext = r.status === "VALIDATED" && (await prisma.category.count({ where: { clubId: r.clubId, season: nextSeason(r.season), open: true } })) > 0;
  const signerName = `${u.firstName} ${u.lastName}`;

  return (
    <>
      <PageHeader eyebrow={`${r.club.name} · Saison ${r.season}`} title={`Dossier de ${r.child.firstName}`} subtitle={`${r.category.name} · ${r.child.firstName} ${r.child.lastName}`} action={<div className="flex gap-2"><RegistrationBadge status={r.status} /><PaymentBadge status={r.paymentStatus} /></div>} />
      {paiement === "ok" && <div className="mb-4"><Alert tone="success">Paiement confirmé, merci ! Un reçu vous a été envoyé.</Alert></div>}
      {paiement === "annule" && <div className="mb-4"><Alert tone="warning">Paiement annulé. Vous pouvez réessayer à tout moment.</Alert></div>}
      {r.decisionReason && ["TO_FIX", "REJECTED"].includes(r.status) && (
        <div className="mb-4"><Alert tone={r.status === "REJECTED" ? "error" : "warning"}><MessageSquareWarning className="mr-1 inline h-4 w-4" /><b>Message du club :</b> {r.decisionReason}</Alert></div>
      )}
      {r.status === "SUBMITTED" && <div className="mb-4"><Alert tone="success">✅ Dossier complet transmis au club. Il est en cours de vérification : vous serez notifié dès sa validation.</Alert></div>}
      {r.status === "VALIDATED" && <div className="mb-4"><Alert tone="success">🎉 Inscription validée par le club. {r.federationLicenseNumber ? `N° de licence : ${r.federationLicenseNumber}` : "Le numéro de licence fédérale apparaîtra ici dès son enregistrement."}</Alert></div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Pièces du dossier</h2><span className="text-sm font-bold text-pitch-700">{c.progress}%</span></div>
            <div className="mt-2"><Progress value={c.progress} /></div>
            {c.issues.length > 0 && (
              <div className="mt-4 space-y-1">{c.issues.map((i) => <p key={i.code} className="flex items-start gap-2 text-sm text-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{i.message}</p>)}</div>
            )}
            <ul className="mt-5 space-y-4">
              {c.requiredUploads.map((t) => {
                const current = docs.find((d) => d.type === t);
                const ok = current && current.status !== "REJECTED" && !c.issues.some((i) => i.code.endsWith(t));
                return (
                  <li key={t} className="rounded-xl border border-line p-4">
                    <p className="flex items-center gap-2 font-semibold">{ok ? <CheckCircle2 className="h-5 w-5 text-pitch-600" /> : <Circle className="h-5 w-5 text-muted" />}{DOCUMENT_LABELS[t]}</p>
                    {current && <div className="mt-3"><DocumentRow doc={current} canDelete={editable} /></div>}
                    {editable && !ok && <div className="mt-3"><DocumentUploader childId={r.childId} registrationId={r.id} type={t} withExpiry={t === "MEDICAL_CERTIFICATE"} /></div>}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold">Santé et autorisations</h2>
            {(c.requiredSignatures.includes("HEALTH_QUESTIONNAIRE") || r.healthAnswer === "SOME_YES") && (
              <div className="mt-4 rounded-xl border border-line p-4">
                <p className="font-semibold">Questionnaire de santé (mineurs)</p>
                <p className="mt-1 text-sm text-muted">Remplissez le questionnaire officiel QS-SPORT avec votre enfant. Avez-vous répondu NON à toutes les questions ?</p>
                {editable ? (
                  <form action={healthAnswerAction} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="registrationId" value={r.id} />
                    <Button name="answer" value="ALL_NO" variant={r.healthAnswer === "ALL_NO" ? "primary" : "outline"} size="sm">Oui, NON partout</Button>
                    <Button name="answer" value="SOME_YES" variant={r.healthAnswer === "SOME_YES" ? "primary" : "outline"} size="sm">Au moins un OUI</Button>
                  </form>
                ) : <p className="mt-2 text-sm font-semibold">{r.healthAnswer === "ALL_NO" ? "NON à toutes les questions" : r.healthAnswer === "SOME_YES" ? "Certificat médical fourni" : "—"}</p>}
                {r.healthAnswer === "SOME_YES" && <p className="mt-2 text-sm text-amber-800">Un certificat médical de moins de 6 mois est alors nécessaire (ajouté à la liste des pièces).</p>}
              </div>
            )}
            <ul className="mt-4 space-y-4">
              {signatures.filter((s) => s !== "HEALTH_QUESTIONNAIRE" || r.healthAnswer === "ALL_NO").map((s) => {
                const sig = signed.get(s);
                return (
                  <li key={s} className="rounded-xl border border-line p-4">
                    <p className="flex items-center gap-2 font-semibold">{sig ? <CheckCircle2 className="h-5 w-5 text-pitch-600" /> : <Circle className="h-5 w-5 text-muted" />}{SIGNATURE_LABELS[s]}{s === "IMAGE_RIGHTS" && <span className="text-xs font-normal text-muted">(facultatif)</span>}</p>
                    {sig ? <p className="mt-1 text-xs text-muted">{sig.accepted ? "Signé" : "Refusé"} par {sig.signerName} le {formatDateTime(sig.signedAt)} · empreinte {sig.contentHash.slice(0, 12)}…</p> : editable && <div className="mt-3"><SignaturePad registrationId={r.id} type={s} text={SIGN_TEXT[s]} defaultName={signerName} allowRefuse={s === "IMAGE_RIGHTS"} /></div>}
                  </li>
                );
              })}
            </ul>
          </Card>

          {editable && (
            <Card className="p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold">Envoyer le dossier au club</h2>
              {c.summary.length > 0 ? <ul className="mt-2 list-inside list-disc text-sm text-muted">{c.summary.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="mt-2 text-sm text-pitch-700">Tout est prêt ✔</p>}
              <ActionForm action={submitRegistrationAction} className="mt-4">
                <input type="hidden" name="registrationId" value={r.id} />
                <SubmitButton size="lg" variant={c.state === "COMPLETE" ? "volt" : "primary"}>{c.state === "COMPLETE" ? "Envoyer le dossier complet" : "Envoyer en l'état"}</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="font-display text-lg font-bold">Paiement</h2>
            {payment ? (
              <div className="mt-3"><p className="mb-2 text-sm text-muted">Total {formatEUR(payment.totalCents)} en {payment.installmentsCount}×</p><InstallmentsTable installments={payment.installments} total={payment.installmentsCount} canRetry /></div>
            ) : ["REJECTED", "CANCELLED"].includes(r.status) ? <p className="mt-2 text-sm text-muted">Aucun paiement requis.</p> : (
              c.state === "COMPLETE" ? (
                <div className="mt-4"><InstallmentPicker registrationId={r.id} licenseCents={r.licenseFeeCents} feeCents={r.platformFeeCents} max={r.category.maxInstallments} /></div>
              ) : (
                <div className="mt-3 rounded-xl bg-chalk p-4 text-sm" data-testid="payment-locked">
                  <p className="font-semibold">🔒 Le paiement s'ouvrira dès que le dossier sera complet.</p>
                  <p className="mt-1 text-muted">Il reste à faire :</p>
                  <ul className="mt-1 list-inside list-disc text-muted">{c.summary.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
              )
            )}
          </Card>
          {hasNext && (
            <Card className="p-5"><h2 className="font-bold">Saison {nextSeason(r.season)}</h2><p className="mt-1 text-sm text-muted">Renouvelez en un clic : informations et documents valides sont repris.</p>
              <ActionForm action={renewAction} className="mt-3"><input type="hidden" name="registrationId" value={r.id} /><SubmitButton variant="volt">Renouveler la licence</SubmitButton></ActionForm>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-bold"><History className="h-4 w-4" /> Historique</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-line pl-4 text-sm">
              {r.events.map((e) => <li key={e.id}><p>{e.message}</p><p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p></li>)}
            </ol>
          </Card>
          {editable && r.paymentStatus === "UNPAID" && (
            <form action={cancelRegistrationAction}><input type="hidden" name="registrationId" value={r.id} /><button className="text-sm font-semibold text-danger">Annuler ce dossier</button></form>
          )}
        </aside>
      </div>
    </>
  );
}
