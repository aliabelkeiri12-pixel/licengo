import { notFound } from "next/navigation";
import { CheckCircle2, Circle, AlertCircle, History, MessageSquareWarning, Lock } from "lucide-react";
import { DOCUMENT_LABELS, SIGNATURE_LABELS, formatEUR, type SignableDocument } from "@licengo/core";
import { prisma } from "@/server/db";
import { familyUser } from "@/lib/guards";
import { getRegistration, computeCompleteness, nextSeason, extrasOf } from "@/server/services/registrations";
import { Alert, Card, Input, PageHeader, Progress, formatDateTime, cx } from "@/components/ui";
import { DocumentUploader } from "@/components/document-uploader";
import { DocumentRow } from "@/components/document-list";
import { SignAll } from "@/components/sign-all";
import { InstallmentPicker } from "@/components/installment-picker";
import { InstallmentsTable } from "@/components/installments-table";
import { ActionForm, SubmitButton } from "@/components/forms";
import { renewAction, cancelRegistrationAction, declareFffAction, addReductionProofAction } from "@/app/actions/family";

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
        <div><p className="text-[11px] font-bold uppercase tracking-wider text-muted">Étape {n} sur 2</p><h2 className="font-display text-lg font-bold leading-tight">{title}</h2></div>
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
  const fffMode = r.club.footclubsMode;
  const docsDone = fffMode ? !!r.fffDeclaredAt && r.fffStatus !== "MISSING" : c.missingUploads.length === 0 && !c.issues.some((i) => i.code.startsWith("DOC_"));
  // the club validated / sent the payment request: the family only has the payment left to do
  const clubApproved = fffMode ? r.fffStatus === "OK" : !!r.paymentRequestedAt || r.status === "VALIDATED";
  const payLocked = r.club.payAfterCheck && !clubApproved;
  const paymentOnly = !closed && (r.status === "VALIDATED" || !!r.paymentRequestedAt);
  const signDone = c.missingSignatures.length === 0 && r.signatures.some((s) => s.type === "IMAGE_RIGHTS");
  const payDone = !!payment;
  const dossierDone = paymentOnly || (docsDone && signDone);
  const current = !dossierDone ? 1 : !payDone ? 2 : 0;
  const extras = extrasOf(r.extras);
  const pendingReductions = extras.filter((e) => e.pending);
  // reductions the family can claim by uploading a proof (town resident, ARS, Pass'Sport…), checked by the club
  const proofFees = await prisma.clubFee.findMany({ where: { clubId: r.clubId, active: true, kind: "REDUCTION", proofDocType: { not: null } }, orderBy: { createdAt: "asc" } });
  // a club that chose its own documents (photo, certificate, charter) does not ask the health questionnaire
  const customDocs = r.club.requiredUploads.length + r.club.requiredSignatures.length > 0;
  const needsHealth = !fffMode && (c.requiredSignatures.includes("HEALTH_QUESTIONNAIRE") || (!customDocs && (r.healthAnswer === "SOME_YES" || !r.healthAnswer)));
  const signItems = c.requiredSignatures.filter((s) => s !== "IMAGE_RIGHTS").map((s) => ({ type: s, label: SIGNATURE_LABELS[s], text: SIGN_TEXT[s] }));
  if (needsHealth && !signItems.some((i) => i.type === "HEALTH_QUESTIONNAIRE") && r.healthAnswer !== "SOME_YES")
    signItems.push({ type: "HEALTH_QUESTIONNAIRE", label: SIGNATURE_LABELS.HEALTH_QUESTIONNAIRE, text: SIGN_TEXT.HEALTH_QUESTIONNAIRE });
  const otherIssues = c.issues.filter((i) => !i.code.startsWith("DOC_"));
  const rejected = docs.filter((d) => d.status === "REJECTED" && c.requiredUploads.includes(d.type as never));

  const uploadItem = (t: (typeof c.requiredUploads)[number]) => {
                  const doc = docs.find((d) => d.type === t);
                  const ok = doc && doc.status !== "REJECTED" && !c.issues.some((i) => i.code.endsWith(t));
                  return (
                    <li key={t} className="rounded-xl border border-line p-4">
                      <p className="flex items-center gap-2 font-semibold">{ok ? <CheckCircle2 className="h-5 w-5 text-pitch-600" /> : <Circle className="h-5 w-5 text-muted" />}{DOCUMENT_LABELS[t]}</p>
                      {doc?.status === "REJECTED" ? (
                        <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-danger"><b>Refusé par le club :</b> {doc.rejectReason}<br /><span className="text-ink">Envoyez un nouveau document ci-dessous, il remplacera l'ancien.</span></p>
                      ) : doc && <div className="mt-3"><DocumentRow doc={doc} canDelete={editable} /></div>}
                      {!closed && !ok && <div className="mt-3"><DocumentUploader childId={r.childId} registrationId={r.id} type={t} withExpiry={t === "MEDICAL_CERTIFICATE"} /></div>}
                    </li>
                  );
                };
  return (
    <>
      <PageHeader eyebrow={`${r.club.name} · Saison ${r.season}`} title={`Inscription de ${r.child.firstName}`} subtitle={r.club.payAfterCheck && !r.paymentRequestedAt ? `${r.category.name} · montant envoyé par le club après vérification` : `${r.category.name} · ${formatEUR(r.licenseFeeCents + r.platformFeeCents)} à payer`} />
      {paiement === "ok" && <div className="mb-4"><Alert tone="success">Paiement confirmé, merci ! Votre reçu et votre facture vous ont été envoyés par email.</Alert></div>}
      {paiement === "annule" && <div className="mb-4"><Alert tone="warning">Paiement annulé. Vous pouvez réessayer à tout moment.</Alert></div>}
      {r.decisionReason && r.status === "TO_FIX" && (
        <div className="mb-4"><Alert tone="warning"><MessageSquareWarning className="mr-1 inline h-4 w-4" /><b>Message du club :</b> {r.decisionReason}</Alert></div>
      )}
      {r.status === "SUBMITTED" && <div className="mb-4"><Alert tone="success">✅ Dossier complet transmis au club. Il est en cours de vérification : vous serez prévenu dès sa validation.</Alert></div>}
      {r.status === "VALIDATED" && !(paymentOnly && r.paymentStatus !== "PAID") && <div className="mb-4"><Alert tone="success">🎉 Inscription validée par le club. {r.federationLicenseNumber ? `N° de licence : ${r.federationLicenseNumber}` : "Le numéro de licence fédérale apparaîtra ici dès son enregistrement."}</Alert></div>}

      {!paymentOnly && <div className="mb-6"><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">Dossier complété</span><span className="font-bold text-pitch-700">{c.progress}%</span></div><Progress value={c.progress} /></div>}
      {r.status === "CANCELLED" && (
        <div className="mb-4 rounded-2xl border-2 border-line bg-white p-4">
          <p className="font-bold">Cette inscription a été annulée</p>
          <p className="mt-1 text-sm text-muted">Pour inscrire {r.child.firstName} à nouveau, choisissez un club depuis l'onglet « Clubs ».</p>
          <a href={`/clubs?enfant=${r.childId}`} className="mt-3 inline-flex rounded-xl bg-pitch-800 px-4 py-2 text-sm font-semibold text-white">Trouver un club</a>
        </div>
      )}
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
          {paymentOnly ? (
            <p className="flex items-center gap-2 rounded-xl bg-pitch-50 p-3 text-sm font-semibold text-pitch-700" data-testid="dossier-validated"><CheckCircle2 className="h-5 w-5" /> Dossier validé par le club{r.paymentStatus === "PAID" ? "" : " : il ne reste que le paiement"}</p>
          ) : (
          <Step n={1} title="Mon dossier" done={dossierDone} active={current === 1}>
            {fffMode ? (
              <div className="rounded-xl border border-line p-4">
                <p className="font-semibold">Formulaire de licence FFF</p>
                <ol className="mt-2 space-y-1 text-sm">
                  <li>1. Ouvrez l'email <b>« Demande de licence »</b> envoyé par la FFF (pensez aux spams).</li>
                  <li>2. Remplissez-le et ajoutez les documents demandés (certificat médical, photo…).</li>
                  <li>3. Revenez ici et cliquez sur le bouton.</li>
                </ol>
                {r.fffStatus === "MISSING" && (
                  <div className="mt-3 rounded-xl border-2 border-danger bg-red-50 p-3 text-sm" data-testid="fff-missing">
                    <p className="font-bold text-danger">Le club a vérifié votre formulaire FFF : il manque</p>
                    <ul className="mt-1 list-inside list-disc">{r.fffMissing.map((m) => <li key={m}>{m}</li>)}</ul>
                    <p className="mt-1 text-muted">Complétez-les sur le formulaire FFF, puis cliquez sur le bouton.</p>
                  </div>
                )}
                {r.fffStatus === "OK" ? <p className="mt-3 font-semibold text-pitch-700">✓ Vérifié par le club</p>
                  : r.fffDeclaredAt ? <p className="mt-3 text-sm text-muted">✓ Merci ! Le club va vérifier votre formulaire sur Footclubs.</p>
                  : !closed && (
                    <form action={declareFffAction} className="mt-3"><input type="hidden" name="registrationId" value={r.id} />
                      <button className="h-12 w-full rounded-xl bg-volt-500 text-sm font-bold text-pitch-950" data-testid="fff-declare">{r.fffStatus === "MISSING" ? "J'ai complété les documents manquants" : "J'ai rempli mon formulaire FFF"}</button>
                    </form>
                  )}
              </div>
            ) : (
              <ul className="space-y-3">{c.requiredUploads.filter((t) => t !== "MEDICAL_CERTIFICATE").map(uploadItem)}</ul>
            )}
            <div className="mt-4">
              {signDone ? (
                <p className="rounded-xl bg-chalk p-3 text-sm text-muted">✓ Charte signée par {r.signatures[0]?.signerName} le {r.signatures[0] && formatDateTime(r.signatures[0].signedAt)} · droit à l'image : {r.imageRightsOk ? "accepté" : "refusé"}.</p>
              ) : !closed && (
                <SignAll registrationId={r.id} needsHealth={needsHealth} healthAnswer={r.healthAnswer} items={signItems} imageRightsText={SIGN_TEXT.IMAGE_RIGHTS} signerName={`${u.firstName} ${u.lastName}`} />
              )}
            </div>
            {!fffMode && c.requiredUploads.includes("MEDICAL_CERTIFICATE") && <ul className="mt-4 space-y-3">{uploadItem("MEDICAL_CERTIFICATE")}</ul>}
            {proofFees.length > 0 && !closed && (
              <div className="mt-4 rounded-xl border border-dashed border-pitch-600 p-4" data-testid="reductions">
                <p className="font-semibold">Vos réductions <span className="text-sm font-normal text-muted">(facultatif)</span></p>
                <p className="text-xs text-muted">Ajoutez le justificatif de chaque réduction à laquelle vous avez droit. Le club le vérifie et applique la réduction dans le lien de paiement. Un justificatif reçu plus tard (ex. ARS en août) peut être ajouté ici à tout moment.</p>
                <ul className="mt-3 space-y-3">
                  {proofFees.map((f) => {
                    const t = f.proofDocType as (typeof c.requiredUploads)[number];
                    const applied = extras.some((e) => e.id === f.id && !e.pending);
                    const doc = docs.find((d) => d.type === t);
                    return (
                      <li key={f.id} className="rounded-lg bg-chalk p-3 text-sm">
                        <p className="flex justify-between font-semibold"><span>{f.label}</span>{f.amountCents > 0 && <span className="text-pitch-700">-{formatEUR(f.amountCents)}</span>}</p>
                        <p className="text-xs text-muted">{f.proofLabel ?? DOCUMENT_LABELS[t]}</p>
                        {applied ? <p className="mt-1 font-semibold text-pitch-700">✓ Réduction appliquée par le club</p> : (
                          <>
                            {doc?.status === "REJECTED" ? <p className="mt-2 rounded-lg bg-red-50 p-2 text-danger"><b>Refusé par le club :</b> {doc.rejectReason}</p>
                              : doc && <div className="mt-2"><DocumentRow doc={doc} canDelete={editable} /></div>}
                            {(!doc || doc.status === "REJECTED") && <div className="mt-2"><DocumentUploader childId={r.childId} registrationId={r.id} type={t} /></div>}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {dossierDone && ["SUBMITTED", "VALIDATED"].includes(r.status) && <p className="mt-3 font-semibold text-pitch-700">✓ Dossier envoyé au club</p>}
          </Step>
          )}

          <Step n={2} title="Le paiement" done={payDone} active={current === 2} locked={!dossierDone}>
            {(extras.length > 0 || pendingReductions.length > 0) && (
              <dl className="mb-4 space-y-1 rounded-xl bg-chalk p-3 text-sm" data-testid="tarif">
                <div className="flex justify-between"><dt className="text-muted">Licence {r.category.name}</dt><dd>{formatEUR(r.category.priceCents)}</dd></div>
                {extras.map((e) => (
                  <div key={e.id}>
                    <div className="flex justify-between"><dt className="text-muted">{e.label}{e.pending && <span className="ml-1 text-xs text-pitch-700">· à réception du justificatif</span>}</dt><dd className={e.pending ? "text-muted" : ""}>{e.amountCents > 0 ? "+" : ""}{formatEUR(e.amountCents)}</dd></div>
                    {e.pending && !closed && (
                      e.proof ? <p className="text-xs text-muted">Justificatif envoyé ({e.proof}) : le club va appliquer la réduction.</p> : (
                        <ActionForm action={addReductionProofAction} className="mt-1 flex gap-2">
                          <input type="hidden" name="registrationId" value={r.id} /><input type="hidden" name="extraId" value={e.id} />
                          <Input name="proof" placeholder="Code / n° du justificatif (dès réception)" className="h-9 text-sm" />
                          <SubmitButton size="sm" variant="outline">Envoyer</SubmitButton>
                        </ActionForm>
                      )
                    )}
                  </div>
                ))}
                {pendingReductions.length > 0 && <p className="pt-1 text-xs text-muted">Les réductions avec justificatif sont déduites de vos échéances suivantes dès que le club a reçu le justificatif (vous pouvez payer dès maintenant).</p>}
              </dl>
            )}
            {payment ? (
              <><p className="mb-2 text-sm text-muted">Total {formatEUR(payment.totalCents)} en {payment.installmentsCount}×</p><InstallmentsTable installments={payment.installments} total={payment.installmentsCount} canRetry /></>
            ) : closed ? <p className="text-sm text-muted">Aucun paiement requis.</p> : r.paymentStatus === "PAID" ? <p className="font-semibold text-pitch-700">✓ Licence réglée</p>
            : clubApproved && r.club.payAfterCheck ? (
              <InstallmentPicker registrationId={r.id} licenseCents={r.licenseFeeCents} feeCents={r.platformFeeCents} max={r.category.maxInstallments} />
            ) : payLocked && c.state === "COMPLETE" ? (
              <div className="rounded-xl bg-chalk p-4 text-sm" data-testid="payment-wait-club"><p className="font-semibold">⏳ Le club vérifie votre dossier.</p><p className="mt-1 text-muted">Dès qu'il l'aura validé, vous recevrez par email la demande de paiement avec le montant final (frais de mutation éventuels compris). Vous pourrez alors payer en 1 à 4 fois.</p></div>
            ) : c.state === "COMPLETE" ? (
              <InstallmentPicker registrationId={r.id} licenseCents={r.licenseFeeCents} feeCents={r.platformFeeCents} max={r.category.maxInstallments} />
            ) : (
              <div className="rounded-xl bg-chalk p-4 text-sm" data-testid="payment-locked">
                <p className="font-semibold">🔒 Complétez d'abord votre dossier ci-dessus.</p>
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
            <details>
              <summary className="flex cursor-pointer items-center gap-2 font-bold"><History className="h-4 w-4" /> Historique du dossier</summary>
              <ol className="mt-3 space-y-3 border-l-2 border-line pl-4 text-sm">
                {r.events.map((e) => <li key={e.id}><p>{e.message}</p><p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p></li>)}
              </ol>
            </details>
          </Card>
          {editable && r.paymentStatus === "UNPAID" && (
            <form action={cancelRegistrationAction}><input type="hidden" name="registrationId" value={r.id} /><button className="text-sm font-semibold text-danger">Annuler cette inscription</button></form>
          )}
        </aside>
      </div>
    </>
  );
}
