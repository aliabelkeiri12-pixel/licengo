"use client";
import { useActionState, useRef, useTransition } from "react";
import { Camera, Upload } from "lucide-react";
import { uploadDocumentAction } from "@/app/actions/family";
import { Alert, buttonClass } from "./ui";

/** Downscale big phone photos (12 MP → ~2000 px JPEG) before upload: faster on 4G, lower storage cost. */
async function compress(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1_500_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function DocumentUploader({ childId, registrationId, type, withExpiry, compact }: { childId: string; registrationId?: string; type: string; withExpiry?: boolean; compact?: boolean }) {
  const [state, action] = useActionState(uploadDocumentAction, undefined);
  const [pending, start] = useTransition();
  const expiry = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const fd = new FormData();
    fd.set("childId", childId);
    if (registrationId) fd.set("registrationId", registrationId);
    fd.set("type", type);
    if (expiry.current?.value) fd.set("expiresAt", expiry.current.value);
    fd.set("file", await compress(f));
    start(() => action(fd));
  }

  return (
    <div className="space-y-2">
      {withExpiry && (
        <label className="block text-xs text-muted">Date de fin de validité (si indiquée)
          <input ref={expiry} type="date" className="mt-1 block h-9 rounded-lg border border-line px-2 text-sm text-ink" />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <label className={buttonClass("primary", compact ? "sm" : "md") + " cursor-pointer"} aria-disabled={pending}>
          <Camera className="h-4 w-4" /> {pending ? "Envoi…" : "Photographier"}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} disabled={pending} data-testid={`camera-${type}`} />
        </label>
        <label className={buttonClass("outline", compact ? "sm" : "md") + " cursor-pointer"}>
          <Upload className="h-4 w-4" /> Fichier
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="sr-only" onChange={onFile} disabled={pending} data-testid={`file-${type}`} />
        </label>
      </div>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <p className="text-xs font-semibold text-pitch-700">{state.ok}</p>}
    </div>
  );
}
