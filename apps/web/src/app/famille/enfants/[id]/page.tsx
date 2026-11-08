import Link from "next/link";
import { notFound } from "next/navigation";
import { DOCUMENT_LABELS, ageAt } from "@licengo/core";
import { prisma } from "@/server/db";
import { familyUser } from "@/lib/guards";
import { Alert, Card, PageHeader, RegistrationBadge, LinkButton } from "@/components/ui";
import { ChildForm } from "@/components/child-form";
import { DocumentUploader } from "@/components/document-uploader";
import { DocumentRow } from "@/components/document-list";

const LIBRARY = ["PHOTO", "ID_DOCUMENT", "MEDICAL_CERTIFICATE", "PROOF_OF_ADDRESS", "OTHER"] as const;

export default async function ChildPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const u = await familyUser();
  const { id } = await params;
  const { ok } = await searchParams;
  const child = await prisma.child.findFirst({ where: { id, familyId: u.familyId, deletedAt: null }, include: { documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } }, registrations: { include: { club: true, category: true }, orderBy: { createdAt: "desc" } } } });
  if (!child) notFound();
  return (
    <>
      <PageHeader eyebrow="Membre" title={`${child.firstName} ${child.lastName}`} subtitle={`${ageAt(child.birthDate)} ans`} action={<LinkButton href={`/clubs?enfant=${child.id}`} variant="volt">Inscrire dans un club</LinkButton>} />
      {ok && <div className="mb-4"><Alert tone="success">Informations enregistrées. Ajoutez maintenant ses documents ou trouvez un club.</Alert></div>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-bold">Informations</h2>
          <ChildForm child={{ ...child, birthDate: child.birthDate.toISOString().slice(0, 10) }} />
        </Card>
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold">Documents</h2>
            <p className="mb-4 text-sm text-muted">Envoyés une fois, réutilisés pour chaque inscription. Chiffrés et visibles uniquement par vous et le club.</p>
            <div className="space-y-2">{child.documents.map((d) => <DocumentRow key={d.id} doc={d} canDelete />)}</div>
            <div className="mt-5 space-y-4">
              {LIBRARY.map((t) => (
                <div key={t} className="rounded-xl bg-chalk p-3">
                  <p className="mb-2 text-sm font-semibold">{DOCUMENT_LABELS[t]}</p>
                  <DocumentUploader childId={child.id} type={t} compact withExpiry={t === "MEDICAL_CERTIFICATE"} />
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 font-display text-lg font-bold">Inscriptions</h2>
            {child.registrations.length === 0 ? <p className="text-sm text-muted">Aucune inscription.</p> : (
              <ul className="space-y-2">{child.registrations.map((r) => (
                <li key={r.id}><Link href={`/famille/inscriptions/${r.id}`} className="flex items-center justify-between rounded-xl border border-line p-3 hover:bg-chalk"><span className="text-sm"><b>{r.club.name}</b><br /><span className="text-xs text-muted">{r.category.name} · {r.season}</span></span><RegistrationBadge status={r.status} /></Link></li>
              ))}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
