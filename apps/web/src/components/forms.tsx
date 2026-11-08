"use client";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, type ButtonVariant } from "./ui";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton({ children, variant = "primary", className, size }: { children: ReactNode; variant?: ButtonVariant; className?: string; size?: "sm" | "md" | "lg" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={className} aria-busy={pending}>
      {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </Button>
  );
}

/** Form bound to a server action returning ActionState, renders errors/success. */
export function ActionForm({ action, children, className, resetOnSuccess }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; children: ReactNode | ((s: ActionState) => ReactNode); className?: string; resetOnSuccess?: boolean }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className} key={resetOnSuccess && state?.ok ? state.ok + Date.now() : undefined}>
      {state?.error && <div className="mb-4"><Alert tone="error">{state.error}</Alert></div>}
      {state?.ok && <div className="mb-4"><Alert tone="success">{state.ok}</Alert></div>}
      {typeof children === "function" ? children(state) : children}
    </form>
  );
}
