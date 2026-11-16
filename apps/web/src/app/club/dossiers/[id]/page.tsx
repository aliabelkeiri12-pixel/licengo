import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2, Phone, Mail, History } from "lucide-react";
import { DOCUMENT_LABELS, SIGNATURE_LABELS, formatEUR, ageAt, footballCategoryFor, type SignableDocument } from "@licengo/core";
import { prisma } from "@/server/db";
import { clubContext } from "@/lib/guards";
import { getRegistration, computeCompleteness, extrasOf } from "@/server/services/registrations";
import { FeePicker } from "@/components/fee-picker";
import { PlayerPhoto } from "@/components/player-photo";
import { Alert, Card, PageHeader, RegistrationBadge, PaymentBadge, Progress, Badge, formatDate, formatDateTime, Textarea, Input, Field, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { InstallmentsTable } from "@/components/installments-table";
import { DocThumb } from "@/components/doc-thumb";
import { decisionAction, reviewDocumentAction, setLicenseNumberAction, refundAction, setExtrasAction, checkFffAction, footclubsDoneAction, offlinePaymentAction, confirmReductionAction, addReductionAfterPaymentAction } from "@/app/actions/club";
import { FFF_ITEMS } from "@/server/services/footclubs";

export const metadata = { title: "Dossier" };

export default async function ClubFile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ doc?: string }> }) {
  const { doc: docMsg } = await searchParams;
  const { user, clubId } = await clubContext();
  const r = await getRegistration((await params).id).catch(() => null);
  if (!r || r.clubId !== clubId) notFound();
  const c = await computeCompleteness(r);
  const docs = await prisma.document.findMany({ where: { childId: r.childId, deletedAt: null }, orderBy: { createdAt: "desc" } });
  const g = r.child.family.guardians;
  const payment = r.payments.find((p) => !["CANCELLED", "PENDING"].includes(p.status));
  const canRefund = user.staff.some((s) => s.clubId === clubId && ["OWNER", "TREASURER"].includes(s.role));
  const expectedCat = footballCategoryFor(r.child.birthDate, Number(r.season.slice(0, 4)));
  const closed = ["REJECTED", "CANCELLED"].includes(r.status);
  const fees = await prisma.clubFee.findMany({ where: { clubId, active: true }, orderBy: { createdAt: "asc" } });
  const chosen = new Set(extrasOf(r.extras).map((e) => e.id));
  const canEditExtras = !closed && !payment && fees.length > 0;
  const sendsPayment = r.status !== "VALIDATED" && r.club.payAfterCheck && r.paymentStatus === "UNPAID" && !payment;
  return (
    <>
      <div className="mb-3"><PlayerPhoto size="lg" photo={docs.find((d) => d.type === "PHOTO" && d.status !== "REJECTED")} firstName={r.child.firstName} lastName={r.child.lastName} /></div>
      <PageHeader eyebrow={`Dossier · ${r.season}`} title={`${r.child.lastName.toUpperCase()} ${r.child.firstName}`} subtitle={`${r.category.name} · ${ageAt(r.child.birthDate)} ans · catégorie fédérale attendue : ${expectedCat}`} action={<div className="flex gap-2"><RegistrationBadge status={r.status} /><PaymentBadge status={r.paymentStatus} /></div>} />
      {docMsg === "refuse" && <div className="mb-4"><Alert tone="warning">Document refusé. La famille a été prévenue (notification et email) et peut le renvoyer depuis son dossier.</Alert></div>}
      {docMsg === "valide" && <div className="mb-4"><Alert tone="success">Document validé.</Alert></div>}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Contrôle automatique</h2><span className="text-sm font-bold">{c.progress}%</span></div>
            <div className="mt-2"><Progress value={c.progress} /></div>
            {c.summary.length === 0 ? <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-pitch-700"><CheckCircle2 className="h-4 w-4" /> Dossier complet et cohérent</p> : (
              <ul className="mt-3 space-y-1">{c.summary.map((s) => <li key={s} className="flex items-start gap-2 text-sm text-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{s}</li>)}</ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg font-bold">Identité</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[["Nom", r.child.lastName], ["Prénom", r.child.firstName], ["Né(e) le", formatDate(r.child.birthDate)], ["Lieu de naissance", r.child.birthPlace ?? "—"], ["Genre", r.child.gender === "F" ? "Féminin" : "Masculin"], ["Nationalité", r.child.nationality ?? "—"], ["Droit à l'image", r.imageRightsOk == null ? "Non renseigné" : r.imageRightsOk ? "Accepté" : "Refusé"], ["Adresse", [r.child.family.address, r.child.family.postalCode, r.child.family.city].filter(Boolean).join(" ") || "—"]].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}
            </dl>
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Responsable(s) légal(aux)</p>
              {g.map((x) => <p key={x.id} className="mt-1 flex flex-wrap items-center gap-x-4 text-sm"><b>{x.firstName} {x.lastName}</b><a href={`tel:${x.phone}`} className="flex items-center gap-1 text-pitch-700"><Phone className="h-3.5 w-3.5" />{x.phone}</a><a href={`mailto:${x.email}`} className="flex items-center gap-1 text-pitch-700"><Mail className="h-3.5 w-3.5" />{x.email}</a></p>)}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg font-bold">Documents</h2>
            <ul className="mt-3 space-y-3">
              {[...c.requiredUploads, ...(["PROOF_OF_ADDRESS", "ARS_CERTIFICATE", "PASS_SPORT"] as const).filter((t) => !c.requiredUploads.includes(t) && docs.some((x) => x.type === t))].map((t) => {
                const d = docs.find((x) => x.type === t);
                return (
                  <li key={t} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{DOCUMENT_LABELS[t]}</p>
                      {d ? <Badge tone={d.status === "ACCEPTED" ? "green" : d.status === "REJECTED" ? "red" : "blue"}>{{ PENDING: "À vérifier", ACCEPTED: "Validé", REJECTED: "Refusé" }[d.status]}</Badge> : <Badge tone="amber">Manquant</Badge>}
                    </div>
                    {d && (
                      <div className="mt-3 flex flex-wrap items-start gap-4">
                        <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-line bg-chalk">
                          <DocThumb id={d.id} alt={DOCUMENT_LABELS[t]} isImage={d.mimeType.startsWith("image/")} />
                        </a>
                        <div className="min-w-0 flex-1 text-xs text-muted">
                          <p>{d.originalName} · {(d.size / 1024).toFixed(0)} Ko · reçu le {formatDate(d.createdAt)}</p>
                          {d.expiresAt && <p>Expire le {formatDate(d.expiresAt)}</p>}
                          {d.rejectReason && <p className="text-danger">Motif : {d.rejectReason}</p>}
                          {!closed && d.status === "PENDING" && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <ActionForm action={reviewDocumentAction}><input type="hidden" name="documentId" value={d.id} /><input type="hidden" name="registrationId" value={r.id} /><input type="hidden" name="accept" value="1" /><SubmitButton size="sm">Valider</SubmitButton></ActionForm>
                              <ActionForm action={reviewDocumentAction} className="flex gap-2"><input type="hidden" name="documentId" value={d.id} /><input type="hidden" name="registrationId" value={r.id} /><input type="hidden" name="accept" value="0" /><Input name="reason" placeholder="Motif du refus (ex : photo floue)" className="h-9 w-56 text-sm" required minLength={3} /><SubmitButton size="sm" variant="outline">Refuser</SubmitButton></ActionForm>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <h3 className="mt-6 font-bold">Signatures électroniques</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {[...new Set([...c.requiredSignatures, "IMAGE_RIGHTS" as SignableDocument])].map((s) => {
                const sig = r.signatures.find((x) => x.type === s);
                return <li key={s} className="flex items-start gap-2">{sig ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-pitch-600" /> : <AlertCircle className="mt-0.5 h-4 w-4 text-muted" />}<span>{SIGNATURE_LABELS[s]}{sig && <span className="block text-xs text-muted">{sig.accepted ? "Signé" : "Refusé"} par {sig.signerName} · {formatDateTime(sig.signedAt)} · IP {sig.ip} · SHA-256 {sig.contentHash.slice(0, 16)}…</span>}</span></li>;
              })}
            </ul>
          </Card>
        </div>

        <aside className="space-y-6">
          {r.status === "REJECTED" && (
            <Card className="border-red-200 p-5">
              <h2 className="font-display text-lg font-bold">Inscription refusée</h2>
              <p className="mt-1 text-sm text-muted">Refusée par erreur ? Rouvrez le dossier : la famille pourra corriger et renvoyer ses documents.</p>
              <ActionForm action={decisionAction} className="mt-3 space-y-2">
                <input type="hidden" name="registrationId" value={r.id} />
                <Textarea name="reason" placeholder="Message à la famille (ex : merci de renvoyer une photo nette)" />
                <button name="decision" value="REOPEN" className="h-11 w-full rounded-xl bg-pitch-800 text-sm font-semibold text-white">Rouvrir le dossier</button>
              </ActionForm>
            </Card>
          )}
          {!closed && (
            <Card className="p-5">
              <h2 className="font-display text-lg font-bold">Décision</h2>
              <ActionForm action={decisionAction} className="mt-3 space-y-3">
                <input type="hidden" name="registrationId" value={r.id} />
                <Field label="Motif / message à la famille" name="reason" hint="Obligatoire pour un refus ou une demande de modification"><Textarea name="reason" placeholder="Ex : la photo doit être de face, sur fond clair." /></Field>
                {sendsPayment && fees.length > 0 && <FeePicker base={r.category.priceCents} fees={fees.map((f) => ({ id: f.id, label: f.label, amountCents: f.amountCents, kind: f.kind, mandatory: f.mandatory, proofAsked: !!f.proofDocType, proofDocId: f.proofDocType ? docs.find((d) => d.type === f.proofDocType && d.status !== "REJECTED")?.id ?? null : null }))} chosen={[...chosen]} pendingIds={[]} />}
                <div className="grid gap-2">
                  {r.status !== "VALIDATED" && <button name="decision" value="VALIDATE" disabled={c.state !== "COMPLETE" || (r.club.footclubsMode && r.fffStatus !== "OK")} className="h-11 rounded-xl bg-pitch-800 text-sm font-semibold text-white disabled:opacity-40">{r.club.payAfterCheck && r.paymentStatus === "UNPAID" ? "✓ Valider et envoyer la demande de paiement" : "✓ Valider le dossier"}</button>}
                  <button name="decision" value="REQUEST_CHANGES" className="h-11 rounded-xl border-2 border-pitch-700 bg-white text-sm font-semibold text-pitch-800">↩ Demander une correction à la famille</button>
                  <p className="text-xs text-muted">La famille reçoit votre message et peut renvoyer ses documents depuis son espace.</p>
                </div>
                {r.status !== "VALIDATED" && (
                  <details className="mt-3 rounded-xl border border-red-200 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-danger">Refuser définitivement l'inscription…</summary>
                    <p className="mt-2 text-xs text-muted">À utiliser seulement si l'enfant ne peut pas être accepté au club (catégorie pleine, exclusion…). Le dossier est clôturé et les échéances à venir sont annulées. Pour un document à refaire, utilisez « Demander une correction ».</p>
                    <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" name="confirmReject" className="accent-red-600" /> Je confirme le refus définitif</label>
                    <button name="decision" value="REJECT" className="mt-2 h-10 w-full rounded-xl bg-danger text-sm font-semibold text-white">Refuser l'inscription</button>
                  </details>
                )}
                {c.state !== "COMPLETE" ? <p className="text-xs text-muted">La validation est possible dès que le dossier est complet.</p> : r.club.footclubsMode && r.fffStatus !== "OK" ? <p className="text-xs text-muted">Vérifiez d'abord le formulaire FFF (cadre « Formulaire FFF » ci-dessous).</p> : null}
              </ActionForm>
            </Card>
          )}
          {r.status === "VALIDATED" && (
            <Card className="p-5">
              <h2 className="font-bold">Licence fédérale</h2>
              <p className="mt-1 text-xs text-muted">Numéro attribué par la fédération (Footclubs pour la FFF).</p>
              <ActionForm action={setLicenseNumberAction} className="mt-3 flex gap-2"><input type="hidden" name="registrationId" value={r.id} /><Input name="number" defaultValue={r.federationLicenseNumber ?? ""} placeholder="N° de licence" className="h-10" /><SubmitButton size="sm">OK</SubmitButton></ActionForm>
            </Card>
          )}
          {r.club.footclubsMode && !closed && (
            <Card className="border-2 border-pitch-700 p-5" data-testid="fff-card">
              <h2 className="font-display text-lg font-bold">Formulaire FFF (Footclubs)</h2>
              <p className="mt-1 text-sm">
                {r.fffStatus === "OK" ? <span className="font-semibold text-pitch-700">✓ Vérifié complet sur Footclubs</span>
                  : r.fffStatus === "MISSING" ? <span className="font-semibold text-danger">⚠ Incomplet, message envoyé : {r.fffMissing.join(", ")}</span>
                  : r.fffDeclaredAt ? <span className="font-semibold text-blue-700">Le joueur indique l'avoir rempli : à vérifier sur Footclubs</span>
                  : <span className="text-muted">Le joueur n'a pas encore indiqué avoir rempli son formulaire FFF.</span>}
              </p>
              {r.fffStatus !== "OK" && (
                <ActionForm action={checkFffAction} className="mt-3 space-y-2">
                  <input type="hidden" name="registrationId" value={r.id} />
                  <button name="result" value="ok" className="h-11 w-full rounded-xl bg-pitch-800 text-sm font-semibold text-white">✓ Complet sur Footclubs</button>
                  <details className="rounded-xl bg-chalk p-3">
                    <summary className="cursor-pointer text-sm font-semibold">Il manque des documents…</summary>
                    <div className="mt-2 space-y-1">
                      {FFF_ITEMS.map((it) => <label key={it} className="flex items-center gap-2 text-sm"><input type="checkbox" name="missing" value={it} className="accent-pitch-700" /> {it}</label>)}
                      <Textarea name="note" placeholder="Autre / précision (facultatif)" className="min-h-14" />
                      <button name="result" value="missing" className="h-10 w-full rounded-xl border-2 border-danger text-sm font-semibold text-danger">Envoyer la liste au joueur</button>
                    </div>
                  </details>
                </ActionForm>
              )}
            </Card>
          )}
          {r.status === "VALIDATED" && (
            <Card className="p-5">
              <h2 className="font-bold">Footclubs</h2>
              {r.footclubsDoneAt ? <p className="mt-1 text-sm text-pitch-700">✓ Licence saisie dans Footclubs le {formatDate(r.footclubsDoneAt)}</p> : <p className="mt-1 text-sm text-muted">Une fois la licence validée dans Footclubs, cochez-la ici pour ne rien oublier.</p>}
              <form action={footclubsDoneAction} className="mt-2"><input type="hidden" name="registrationId" value={r.id} /><input type="hidden" name="done" value={r.footclubsDoneAt ? "0" : "1"} /><button className={`h-10 w-full rounded-xl text-sm font-semibold ${r.footclubsDoneAt ? "border border-line" : "bg-pitch-800 text-white"}`}>{r.footclubsDoneAt ? "Annuler" : "✓ Saisie dans Footclubs faite"}</button></form>
            </Card>
          )}
          {!payment && !closed && (
            <Card className="p-5">
              <h2 className="font-bold">Paiement reçu au club ?</h2>
              <p className="mt-1 text-xs text-muted">Espèces ou chèque à une permanence : enregistrez-le ici, la famille reçoit sa facture.</p>
              <ActionForm action={offlinePaymentAction} className="mt-2 space-y-2">
                <input type="hidden" name="registrationId" value={r.id} />
                <div className="flex gap-3 text-sm">{[["ESPECES", "Espèces"], ["CHEQUE", "Chèque"], ["AUTRE", "Autre"]].map(([v, l]) => <label key={v} className="flex items-center gap-1"><input type="radio" name="method" value={v} required className="accent-pitch-700" /> {l}</label>)}</div>
                <Input name="note" placeholder="N° de chèque, remarque… (facultatif)" className="h-10" />
                <SubmitButton size="sm" variant="outline">Enregistrer le paiement de {formatEUR(r.licenseFeeCents)}</SubmitButton>
              </ActionForm>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="font-display text-lg font-bold">Tarif</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Licence {r.category.name}</dt><dd>{formatEUR(r.category.priceCents)}</dd></div>
              {extrasOf(r.extras).map((e) => (
                <div key={e.id} className={e.pending ? "rounded-lg bg-amber-50 p-2" : ""}>
                  <div className="flex justify-between"><dt className="text-muted">{e.label}{e.pending && <span className="ml-1 text-xs font-semibold text-amber-800">· en attente du justificatif</span>}</dt><dd className={e.pending ? "text-muted line-through" : ""}>{e.amountCents > 0 ? "+" : ""}{formatEUR(e.amountCents)}</dd></div>
                  {e.pending && (
                    <>
                      <p className="mt-1 text-xs">{e.proof ? <>Justificatif indiqué par la famille : <b>{e.proof}</b></> : <span className="text-muted">La famille n'a pas encore donné son justificatif.</span>}</p>
                      <ActionForm action={confirmReductionAction} className="mt-1"><input type="hidden" name="registrationId" value={r.id} /><input type="hidden" name="extraId" value={e.id} /><SubmitButton size="sm">✓ Justificatif reçu : appliquer la réduction</SubmitButton></ActionForm>
                    </>
                  )}
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-1 font-bold"><dt>Total pour le club</dt><dd>{formatEUR(r.licenseFeeCents)}</dd></div>
            </dl>
            {payment && !closed && fees.some((f) => f.kind === "REDUCTION" && !chosen.has(f.id)) && (
              <ActionForm action={addReductionAfterPaymentAction} className="mt-3 space-y-2 rounded-xl bg-chalk p-3" data-testid="late-reduction">
                <p className="text-sm font-semibold">Justificatif reçu plus tard (ARS, Pass'Sport…) ?</p>
                <input type="hidden" name="registrationId" value={r.id} />
                <Select name="feeId" className="h-10">{fees.filter((f) => f.kind === "REDUCTION" && !chosen.has(f.id)).map((f) => <option key={f.id} value={f.id}>{f.label} (-{formatEUR(f.amountCents)})</option>)}</Select>
                <SubmitButton size="sm" variant="outline">Appliquer la réduction</SubmitButton>
                <p className="text-xs text-muted">Déduite des dernières échéances ; si tout est déjà payé, remboursée sur la carte.</p>
              </ActionForm>
            )}
            {canEditExtras && !sendsPayment && (
              <ActionForm action={setExtrasAction} className="mt-3 space-y-2">
                <input type="hidden" name="registrationId" value={r.id} />
                {fees.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="extras" value={f.id} defaultChecked={f.mandatory || chosen.has(f.id)} disabled={f.mandatory} className="accent-pitch-700" />
                    {f.label} ({f.kind === "REDUCTION" ? "-" : "+"}{formatEUR(f.amountCents)}){f.mandatory && <span className="text-xs text-muted">· obligatoire</span>}
                  </label>
                ))}
                <SubmitButton size="sm" variant="outline">Mettre à jour le tarif</SubmitButton>
              </ActionForm>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="font-display text-lg font-bold">Paiement</h2>
            {payment ? (
              <>
                <p className="mt-1 text-sm text-muted">{formatEUR(payment.clubAmountCents)} pour le club · {payment.installmentsCount}×</p>
                <div className="mt-2"><InstallmentsTable installments={payment.installments} total={payment.installmentsCount} /></div>
                {payment.refunds.length > 0 && <p className="mt-2 text-xs text-amber-800">Remboursé : {formatEUR(payment.refunds.reduce((s, x) => s + x.amountCents, 0))}</p>}
                {canRefund && payment.status !== "REFUNDED" && (
                  <details className="mt-3 rounded-xl bg-chalk p-3"><summary className="cursor-pointer text-sm font-semibold">Rembourser</summary>
                    <ActionForm action={refundAction} className="mt-3 space-y-2">
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <Input name="amount" placeholder="Montant en €" inputMode="decimal" required />
                      <Input name="reason" placeholder="Motif (ex : déménagement)" required />
                      <SubmitButton size="sm" variant="danger">Confirmer le remboursement</SubmitButton>
                    </ActionForm>
                  </details>
                )}
              </>
            ) : <p className="mt-2 text-sm text-muted">Pas encore de paiement. Licence : {formatEUR(r.licenseFeeCents)}.</p>}
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-bold"><History className="h-4 w-4" /> Historique</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-line pl-4 text-sm">{r.events.map((e) => <li key={e.id}><p>{e.message}</p><p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p></li>)}</ol>
          </Card>
        </aside>
      </div>
    </>
  );
}
