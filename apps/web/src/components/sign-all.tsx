"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { signAllAction } from "@/app/actions/family";
import { SubmitButton } from "./forms";
import { Alert, Input, cx } from "./ui";

type Item = { type: string; label: string; text: string };

/** Health questionnaire + all authorisations + image rights, signed once. */
export function SignAll({ registrationId, needsHealth, healthAnswer, items, imageRightsText, signerName }: { registrationId: string; needsHealth: boolean; healthAnswer: string | null; items: Item[]; imageRightsText: string; signerName: string }) {
  const [state, action] = useActionState(signAllAction, undefined);
  const [health, setHealth] = useState(healthAnswer ?? "");
  const canvas = useRef<HTMLCanvasElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio; c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#0A2A1F";
    let drawing = false;
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    const down = (e: PointerEvent) => { drawing = true; c.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
    const move = (e: PointerEvent) => { if (!drawing) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
    const up = () => { drawing = false; if (hidden.current) hidden.current.value = c.toDataURL("image/png"); };
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); c.addEventListener("pointerup", up); c.addEventListener("pointerleave", up);
    return () => { c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move); c.removeEventListener("pointerup", up); c.removeEventListener("pointerleave", up); };
  }, []);
  const clear = () => { const c = canvas.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); if (hidden.current) hidden.current.value = ""; };
  const visible = items.filter((i) => i.type !== "HEALTH_QUESTIONNAIRE" || health === "ALL_NO");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="signature" ref={hidden} />

      {needsHealth && (
        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-bold">Questionnaire de santé</legend>
          <p className="text-sm text-muted">Remplissez avec votre enfant le questionnaire officiel QS-SPORT. Avez-vous répondu <b>NON à toutes les questions</b> ?</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[["ALL_NO", "Oui, NON partout"], ["SOME_YES", "Au moins un OUI"]].map(([v, l]) => (
              <label key={v} className={cx("flex cursor-pointer items-center gap-2 rounded-xl border-2 p-3 text-sm font-semibold", health === v ? "border-pitch-700 bg-pitch-50" : "border-line")}>
                <input type="radio" name="healthAnswer" value={v} checked={health === v} onChange={() => setHealth(v)} className="accent-pitch-700" data-testid={`health-${v}`} /> {l}
              </label>
            ))}
          </div>
          {health === "SOME_YES" && <p className="mt-2 text-sm text-amber-800">Un certificat médical sera demandé à l'étape 1 (Documents).</p>}
        </fieldset>
      )}

      <div className="rounded-xl border border-line p-4">
        <p className="text-sm font-bold">Documents à approuver</p>
        <ul className="mt-2 divide-y divide-line">
          {visible.map((i) => (
            <li key={i.type} className="py-2 text-sm">
              <button type="button" onClick={() => setOpen(open === i.type ? null : i.type)} className="flex w-full items-center justify-between gap-2 text-left">
                <span>✍️ {i.label}</span><span className="shrink-0 text-xs font-semibold text-pitch-700">{open === i.type ? "Masquer" : "Lire"}</span>
              </button>
              {open === i.type && <p className="mt-2 rounded-lg bg-chalk p-3 text-xs leading-relaxed text-ink/80">{i.text}</p>}
            </li>
          ))}
        </ul>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" name="readAll" required className="mt-0.5 h-4 w-4 accent-pitch-700" data-testid="read-all" /> J'ai lu et j'accepte ces documents.
        </label>
      </div>

      <fieldset className="rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-bold">Droit à l'image <span className="font-normal text-muted">(facultatif)</span></legend>
        <p className="text-xs text-muted">{imageRightsText}</p>
        <div className="mt-2 flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="imageRights" value="yes" required className="accent-pitch-700" data-testid="image-yes" /> J'accepte</label>
          <label className="flex items-center gap-2"><input type="radio" name="imageRights" value="no" required className="accent-pitch-700" /> Je refuse</label>
        </div>
      </fieldset>

      <div>
        <p className="mb-2 text-sm font-bold">Votre signature</p>
        <Input name="signerName" defaultValue={signerName} required aria-label="Nom du signataire" className="mb-2" />
        <canvas ref={canvas} className="h-36 w-full touch-none rounded-xl border-2 border-dashed border-line bg-white" aria-label="Zone de signature" data-testid="sigpad-all" />
        <div className="mt-1 flex justify-between text-xs text-muted"><span>Signez avec le doigt ou la souris</span><button type="button" onClick={clear} className="font-semibold text-pitch-700">Effacer</button></div>
      </div>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      <SubmitButton size="lg" variant="volt" className="w-full">Signer et continuer</SubmitButton>
    </form>
  );
}
