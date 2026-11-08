import { FileText, Trash2 } from "lucide-react";
import type { Document } from "@prisma/client";
import { DOCUMENT_LABELS } from "@licengo/core";
import { Badge, formatDate } from "./ui";
import { deleteDocumentAction } from "@/app/actions/family";

const st = { PENDING: ["En attente de vérification", "blue"], ACCEPTED: ["Validé", "green"], REJECTED: ["Refusé", "red"] } as const;

export function DocumentRow({ doc, canDelete }: { doc: Document; canDelete?: boolean }) {
  const [label, tone] = st[doc.status];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
      <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-pitch-50 text-pitch-700" aria-label="Voir le document"><FileText className="h-5 w-5" /></a>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{DOCUMENT_LABELS[doc.type]}</p>
        <p className="truncate text-xs text-muted">{doc.originalName} · {formatDate(doc.createdAt)}{doc.expiresAt ? ` · expire le ${formatDate(doc.expiresAt)}` : ""}</p>
        {doc.status === "REJECTED" && doc.rejectReason && <p className="text-xs font-medium text-danger">Motif : {doc.rejectReason}</p>}
      </div>
      <Badge tone={tone}>{label}</Badge>
      {canDelete && doc.status !== "ACCEPTED" && (
        <form action={deleteDocumentAction}><input type="hidden" name="id" value={doc.id} /><button className="rounded-lg p-2 text-muted hover:text-danger" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button></form>
      )}
    </div>
  );
}
