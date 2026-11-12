import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2, Phone, Mail, History } from "lucide-react";
import { DOCUMENT_LABELS, SIGNATURE_LABELS, formatEUR, ageAt, footballCategoryFor, type SignableDocument } from "@licengo/core";
import { prisma } from "@/server/db";
import { clubContext } from "@/lib/guards";
import { getRegistration, computeCompleteness, extrasOf } from "@/server/services/registrations";
import { Card, PageHeader, RegistrationBadge, PaymentBadge, Progress, Badge, formatDate, formatDateTime, Textarea, Input, Field } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { InstallmentsTable } from "@/components/installments-table";
import { decisionAction, reviewDocumentAction, setLicenseNumberAction, refundAction, setExtrasAction } from "@/app/actions/club";

export const metadata = { title: "Dossier" };

export default async function ClubFile({ params }: { params: Promise<{ id: string }> }) {
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
  return (
    <>
      <PageHeader eyebrow={`Dossier · ${r.season}`} title={`${r.child.lastName.toUpperCase()} ${r.child.firstName}`} subtitle={`${r.category.name} · ${ageAt(r.child.birthDate)} ans · catégorie fédérale attendue : ${expectedCat}`} action={<div className="flex gap-2"><RegistrationBadge status={r.status} /><PaymentBadge status={r.paymentStatus} /></div>} />
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
              {c.requiredUploads.map((t) => {
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
                          {d.mimeType.startsWith("image/") ? <img src={`/api/documents/${d.id}`} alt={DOCUMENT_LABELS[t]} className="h-28 w-28 object-cover" /> : <span className="grid h-28 w-28 place-items-center text-xs font-bold text-muted">PDF</span>}
                        </a>
                        <div className="min-w-0 flex-1 text-xs text-muted">
                          <p>{d.originalName} · {(d.size / 1024).toFixed(0)} Ko · reçu le {formatDate(d.createdAt)}</p>
                          {d.expiresAt && <p>Expire le {formatDate(d.expiresAt)}</p>}
                          {d.rejectReason && <p className="text-danger">Motif : {d.rejectReason}</p>}
                          {!closed && d.status === "PENDING" && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <ActionForm action={reviewDocumentAction}><input type="hidden" name="documentId" value={d.id} /><input type="hidden" name="accept" value="1" /><SubmitButton size="sm">Valider</SubmitButton></ActionForm>
                              <ActionForm action={reviewDocumentAction} className="flex gap-2"><input type="hidden" name="documentId" value={d.id} /><input type="hidden" name="accept" value="0" /><Input name="reason" placeholder="Motif du refus (ex : photo floue)" className="h-9 w-56 text-sm" required minLength={3} /><SubmitButton size="sm" variant="outline">Refuser</SubmitButton></ActionForm>
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
          {!closed && (
            <Card className="p-5">
              <h2 className="font-display text-lg font-bold">Décision</h2>
              <ActionForm action={decisionAction} className="mt-3 space-y-3">
                <input type="hidden" name="registrationId" value={r.id} />
                <Field label="Motif / message à la famille" name="reason" hint="Obligatoire pour un refus ou une demande de modification"><Textarea name="reason" placeholder="Ex : la photo doit être de face, sur fond clair." /></Field>
                <div className="grid gap-2">
                  {r.status !== "VALIDATED" && <button name="decision" value="VALIDATE" disabled={c.state !== "COMPLETE"} className="h-11 rounded-xl bg-pitch-800 text-sm font-semibold text-white disabled:opacity-40">✓ Valider le dossier</button>}
                  <button name="decision" value="REQUEST_CHANGES" className="h-11 rounded-xl border border-line bg-white text-sm font-semibold">Demander une modification</button>
                  {r.status !== "VALIDATED" && <button name="decision" value="REJECT" className="h-11 rounded-xl text-sm font-semibold text-danger hover:bg-red-50">Refuser l'inscription</button>}
                </div>
                {c.state !== "COMPLETE" && <p className="text-xs text-muted">La validation est possible dès que le dossier est complet.</p>}
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
          <Card className="p-5">
            <h2 className="font-display text-lg font-bold">Tarif</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Licence {r.category.name}</dt><dd>{formatEUR(r.category.priceCents)}</dd></div>
              {extrasOf(r.extras).map((e) => <div key={e.id} className="flex justify-between"><dt className="text-muted">{e.label}</dt><dd>{formatEUR(e.amountCents)}</dd></div>)}
              <div className="flex justify-between border-t border-line pt-1 font-bold"><dt>Total pour le club</dt><dd>{formatEUR(r.licenseFeeCents)}</dd></div>
            </dl>
            {canEditExtras && (
              <ActionForm action={setExtrasAction} className="mt-3 space-y-2">
                <input type="hidden" name="registrationId" value={r.id} />
                {fees.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="extras" value={f.id} defaultChecked={f.mandatory || chosen.has(f.id)} disabled={f.mandatory} className="accent-pitch-700" />
                    {f.label} ({formatEUR(f.amountCents)}){f.mandatory && <span className="text-xs text-muted">· obligatoire</span>}
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
