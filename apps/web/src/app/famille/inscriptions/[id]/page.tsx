import { notFound } from "next/navigation";
import { CheckCircle2, Circle, AlertCircle, History, MessageSquareWarning, Lock } from "lucide-react";
import { DOCUMENT_LABELS, SIGNATURE_LABELS, formatEUR, type SignableDocument } from "@licengo/core";
import { prisma } from "@/server/db";
import { familyUser } from "@/lib/guards";
import { getRegistration, computeCompleteness, nextSeason, extrasOf } from "@/server/services/registrations";
import { Alert, Card, PageHeader, Progress, formatDateTime, cx } from "@/components/ui";
import { DocumentUploader } from "@/components/document-uploader";
import { DocumentRow } from "@/components/document-list";
import { SignAll } from "@/components/sign-all";
import { InstallmentPicker } from "@/components/installment-picker";
import { InstallmentsTable } from "@/components/installments-table";
import { ActionForm, SubmitButton } from "@/components/forms";
import { renewAction, cancelRegistrationAction } from "@/app/actions/family";

export const metadata = { title: "Dossier d'inscription" };

const SIGN_TEXT: Record<SignableDocument, string> = {
  PARENTAL_AUTHORIZATION: "Je soussigné(e), responsable légal, autorise mon enfant à pratiquer l'activité au sein du club, à être transporté lors des déplacements organisés par le club, et autorise les responsables à prendre toute mesure médicale d'urgence nécessaire.",
  CLUB_RULES: "Je reconnais avoir pris connaissance du règlement intérieur du club et m'engage à le respecter, ainsi que la charte de bonne conduite du sport amateur.",
  IMAGE_RIGHTS: "J'autorise le club à utiliser les photos et vidéos où apparaît le licencié, dans le cadre de sa communication (site, réseaux sociaux, presse locale). Ce consentement est facultatif et révocable à tout moment.",
  HEALTH_QUESTIONNAIRE: "J'atteste avoir rempli le questionnaire de santé (QS-SPORT, arrêté du 7 mai 2021) et avoir répondu NON à toutes les questions. Aucune réponse détaillée n'est transmise au club.",
};

function Step({ n, title, done, active, locked, children }: { n: number; title: string; done: boolean; active: boolean; locked?: boolean; children: React.ReactNode }) {
  return (
    <Card className={cx("p-5 sm:p-6", active && "ring-2 ring-volt-500")} data-testid={`step-${n}`}>
      <div className="flex items-center gap-3">
        <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-base font-black", done ? "bg-pitch-700 text-white" : active ? "bg-volt-500 text-pitch-950" : "bg-chalk text-muted")}>
          {done ? "✓" : locked ? <Lock className="h-4 w-4" /> : n}
        </span>
        <div><p className="text-[11px] font-bold uppercase tracking-wider text-muted">Étape {n} sur 3</p><h2 className="font-display text-lg font-bold leading-tight">{title}</h2></div>
        {done && <span className="ml-auto text-sm font-semibold text-pitch-700">Terminé</span>}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export default async function RegistrationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paiement?: string }> }) {
  const u = await familyUser();
  const { id } = await params;
  const { paiement } = await searchParams;
  const r = await getRegistration(id).catch(() => null);
  if (!r || r.child.familyId !== u.familyId) notFound();
  const c = await computeCompleteness(r);
  const docs = await prisma.document.findMany({ where: { childId: r.childId, deletedAt: null }, orderBy: { createdAt: "desc" } });
  const editable = ["DRAFT", "INCOMPLETE", "TO_FIX"].includes(r.status);
  const closed = ["REJECTED", "CANCELLED"].includes(r.status);
  const payment = r.payments.find((p) => !["CANCELLED", "PENDING"].includes(p.status));
  const hasNext = r.status === "VALIDATED" && (await prisma.category.count({ where: { clubId: r.clubId, season: nextSeason(r.season), open: true } })) > 0;

  // step states
  const docsDone = c.missingUploads.length === 0 && !c.issues.some((i) => i.code.startsWith("DOC_"));
  const signDone = c.missingSignatures.length === 0 && r.signatures.some((s) => s.type === "IMAGE_RIGHTS");
  const payDone = !!payment;
  const current = !docsDone ? 1 : !signDone ? 2 : !payDone ? 3 : 0;
  const needsHealth = c.requiredSignatures.includes("HEALTH_QUESTIONNAIRE") || r.healthAnswer === "SOME_YES" || !r.healthAnswer;
  const signItems = c.requiredSignatures.filter((s) => s !== "IMAGE_RIGHTS").map((s) => ({ type: s, label: SIGNATURE_LABELS[s], text: SIGN_TEXT[s] }));
  if (needsHealth && !signItems.some((i) => i.type === "HEALTH_QUESTIONNAIRE") && r.healthAnswer !== "SOME_YES")
    signItems.push({ type: "HEALTH_QUESTIONNAIRE", label: SIGNATURE_LABELS.HEALTH_QUESTIONNAIRE, text: SIGN_TEXT.HEALTH_QUESTIONNAIRE });
  const otherIssues = c.issues.filter((i) => !i.code.startsWith("DOC_"));
  const rejected = docs.filter((d) => d.status === "REJECTED" && c.requiredUploads.includes(d.type as never));

  return (
    <>
      <PageHeader eyebrow={`${r.club.name} · Saison ${r.season}`} title={`Inscription de ${r.child.firstName}`} subtitle={`${r.category.name} · ${formatEUR(r.licenseFeeCents + r.platformFeeCents)} frais de service inclus`} />
      {paiement === "ok" && <div className="mb-4"><Alert tone="success">Paiement confirmé, merci ! Votre reçu et votre facture vous ont été envoyés par email.</Alert></div>}
      {paiement === "annule" && <div className="mb-4"><Alert tone="warning">Paiement annulé. Vous pouvez réessayer à tout moment.</Alert></div>}
      {r.decisionReason && r.status === "TO_FIX" && (
        <div className="mb-4"><Alert tone="warning"><MessageSquareWarning className="mr-1 inline h-4 w-4" /><b>Message du club :</b> {r.decisionReason}</Alert></div>
      )}
      {r.status === "SUBMITTED" && <div className="mb-4"><Alert tone="success">✅ Dossier complet transmis au club. Il est en cours de vérification : vous serez prévenu dès sa validation.</Alert></div>}
      {r.status === "VALIDATED" && <div className="mb-4"><Alert tone="success">🎉 Inscription validée par le club. {r.federationLicenseNumber ? `N° de licence : ${r.federationLicenseNumber}` : "Le numéro de licence fédérale apparaîtra ici dès son enregistrement."}</Alert></div>}

      <div className="mb-6"><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">Dossier complété</span><span className="font-bold text-pitch-700">{c.progress}%</span></div><Progress value={c.progress} /></div>
      {r.status === "REJECTED" && (
        <div className="mb-4 rounded-2xl border-2 border-danger bg-red-50 p-4">
          <p className="font-bold text-danger">L'inscription a été refusée par le club</p>
          <p className="mt-1 text-sm">Motif : {r.decisionReason}</p>
          <p className="mt-2 text-sm text-muted">S'il s'agit d'un document à refaire, contactez {r.club.name}{r.club.phone ? ` (${r.club.phone})` : ""} : le club peut rouvrir votre dossier en un clic.</p>
        </div>
      )}
      {rejected.length > 0 && !closed && (
        <div className="mb-4 rounded-2xl border-2 border-danger bg-red-50 p-4" data-testid="rejected-banner">
          <p className="font-bold text-danger">⚠️ Le club vous demande de renvoyer {rejected.length > 1 ? "des documents" : "un document"}</p>
          <ul className="mt-2 space-y-1 text-sm">{rejected.map((d) => <li key={d.id}><b>{DOCUMENT_LABELS[d.type]}</b> : {d.rejectReason}</li>)}</ul>
          <a href="#etape-1" className="mt-3 inline-flex rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white">Renvoyer maintenant ↓</a>
        </div>
      )}
      {otherIssues.length > 0 && <div className="mb-4 space-y-1">{otherIssues.map((i) => <Alert key={i.code} tone="error"><AlertCircle className="mr-1 inline h-4 w-4" />{i.message}</Alert>)}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div id="etape-1" className="scroll-mt-24" />
          <Step n={1} title="Les documents" done={docsDone} active={current === 1}>
            <p className="mb-4 text-sm text-muted">Prenez simplement une photo avec votre téléphone.</p>
            <ul className="space-y-3">
              {c.requiredUploads.map((t) => {
                const current = docs.find((d) => d.type === t);
                const ok = current && current.status !== "REJECTED" && !c.issues.some((i) => i.code.endsWith(t));
                return (
                  <li key={t} className="rounded-xl border border-line p-4">
                    <p className="flex items-center gap-2 font-semibold">{ok ? <CheckCircle2 className="h-5 w-5 text-pitch-600" /> : <Circle className="h-5 w-5 text-muted" />}{DOCUMENT_LABELS[t]}</p>
                    {current?.status === "REJECTED" ? (
                      <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-danger"><b>Refusé par le club :</b> {current.rejectReason}<br /><span className="text-ink">Envoyez un nouveau document ci-dessous, il remplacera l'ancien.</span></p>
                    ) : current && <div className="mt-3"><DocumentRow doc={current} canDelete={editable} /></div>}
                    {!closed && !ok && <div className="mt-3"><DocumentUploader childId={r.childId} registrationId={r.id} type={t} withExpiry={t === "MEDICAL_CERTIFICATE"} /></div>}
                  </li>
                );
              })}
            </ul>
          </Step>

          <Step n={2} title="Santé et signature" done={signDone} active={current === 2}>
            {signDone ? (
              <p className="text-sm text-muted">Signé par {r.signatures[0]?.signerName} le {r.signatures[0] && formatDateTime(r.signatures[0].signedAt)}. Droit à l'image : {r.imageRightsOk ? "accepté" : "refusé"}.</p>
            ) : closed ? <p className="text-sm text-muted">Dossier clôturé.</p> : (
              <SignAll registrationId={r.id} needsHealth={needsHealth} healthAnswer={r.healthAnswer} items={signItems} imageRightsText={SIGN_TEXT.IMAGE_RIGHTS} signerName={`${u.firstName} ${u.lastName}`} />
            )}
          </Step>

          <Step n={3} title="Le paiement" done={payDone} active={current === 3} locked={!docsDone || !signDone}>
            {payment ? (
              <><p className="mb-2 text-sm text-muted">Total {formatEUR(payment.totalCents)} en {payment.installmentsCount}×</p><InstallmentsTable installments={payment.installments} total={payment.installmentsCount} canRetry /></>
            ) : closed ? <p className="text-sm text-muted">Aucun paiement requis.</p> : c.state === "COMPLETE" ? (
              <>
                {extrasOf(r.extras).length > 0 && (
                  <dl className="mb-4 space-y-1 rounded-xl bg-chalk p-3 text-sm">
                    <div className="flex justify-between"><dt className="text-muted">Licence {r.category.name}</dt><dd>{formatEUR(r.category.priceCents)}</dd></div>
                    {extrasOf(r.extras).map((e) => <div key={e.id} className="flex justify-between"><dt className="text-muted">{e.label}</dt><dd>{formatEUR(e.amountCents)}</dd></div>)}
                  </dl>
                )}
                <InstallmentPicker registrationId={r.id} licenseCents={r.licenseFeeCents} feeCents={r.platformFeeCents} max={r.category.maxInstallments} />
              </>
            ) : (
              <div className="rounded-xl bg-chalk p-4 text-sm" data-testid="payment-locked">
                <p className="font-semibold">🔒 Le paiement s'ouvrira dès que les étapes 1 et 2 seront terminées.</p>
                <ul className="mt-2 list-inside list-disc text-muted">{c.summary.map((m) => <li key={m}>{m}</li>)}</ul>
              </div>
            )}
          </Step>
        </div>

        <aside className="space-y-4">
          {hasNext && (
            <Card className="p-5"><h2 className="font-bold">Saison {nextSeason(r.season)}</h2><p className="mt-1 text-sm text-muted">Renouvelez en un clic : informations et documents valides sont repris.</p>
              <ActionForm action={renewAction} className="mt-3"><input type="hidden" name="registrationId" value={r.id} /><SubmitButton variant="volt">Renouveler la licence</SubmitButton></ActionForm>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-bold"><History className="h-4 w-4" /> Suivi du dossier</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-line pl-4 text-sm">
              {r.events.map((e) => <li key={e.id}><p>{e.message}</p><p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p></li>)}
            </ol>
          </Card>
          {editable && r.paymentStatus === "UNPAID" && (
            <form action={cancelRegistrationAction}><input type="hidden" name="registrationId" value={r.id} /><button className="text-sm font-semibold text-danger">Annuler cette inscription</button></form>
          )}
        </aside>
      </div>
    </>
  );
}
