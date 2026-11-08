"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { signAction } from "@/app/actions/family";
import { Alert, Button, Input } from "./ui";
import { SubmitButton } from "./forms";

export function SignaturePad({ registrationId, type, text, defaultName, allowRefuse }: { registrationId: string; type: string; text: string; defaultName: string; allowRefuse?: boolean }) {
  const [state, action] = useActionState(signAction, undefined);
  const canvas = useRef<HTMLCanvasElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [accepted, setAccepted] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#0A2A1F";
    let drawing = false;
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    const down = (e: PointerEvent) => { drawing = true; c.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
    const move = (e: PointerEvent) => { if (!drawing) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); setDrawn(true); };
    const up = () => { drawing = false; if (hidden.current) hidden.current.value = c.toDataURL("image/png"); };
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); c.addEventListener("pointerup", up); c.addEventListener("pointerleave", up);
    return () => { c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move); c.removeEventListener("pointerup", up); c.removeEventListener("pointerleave", up); };
  }, []);

  const clear = () => { const c = canvas.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setDrawn(false); if (hidden.current) hidden.current.value = ""; };

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="accepted" value={String(accepted)} />
      <input type="hidden" name="signature" ref={hidden} />
      <p className="rounded-xl bg-chalk p-3 text-sm leading-relaxed">{text}</p>
      {allowRefuse && (
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={accepted} onChange={() => setAccepted(true)} className="accent-pitch-700" /> J'accepte</label>
          <label className="flex items-center gap-2"><input type="radio" checked={!accepted} onChange={() => setAccepted(false)} className="accent-pitch-700" /> Je refuse</label>
        </div>
      )}
      <Input name="signerName" defaultValue={defaultName} placeholder="Nom et prénom du signataire" required aria-label="Nom du signataire" />
      <div className={accepted ? "" : "pointer-events-none opacity-40"}>
        <canvas ref={canvas} className="h-36 w-full touch-none rounded-xl border-2 border-dashed border-line bg-white" aria-label="Zone de signature" data-testid={`sigpad-${type}`} />
        <div className="mt-1 flex justify-between text-xs text-muted"><span>Signez avec le doigt ou la souris</span><button type="button" onClick={clear} className="font-semibold text-pitch-700">Effacer</button></div>
      </div>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      <SubmitButton size="sm">{accepted ? (drawn ? "Signer" : "Signer le document") : "Enregistrer mon refus"}</SubmitButton>
    </form>
  );
}

export function SignedBadge() { return <Button type="button" variant="ghost" size="sm" disabled>Signé ✔</Button>; }
