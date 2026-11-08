import "server-only";
import { ZodError } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AppError } from "@/server/errors";
import type { ActionState } from "./action-state";

/** Wraps a server action: business errors become user messages, unexpected errors are logged and masked. */
export async function safe(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? undefined;
  } catch (e) {
    if (isRedirectError(e)) throw e;
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of e.issues) fieldErrors[i.path.join(".")] ??= i.message;
      return { error: "Merci de corriger les champs indiqués.", fieldErrors };
    }
    if (e instanceof AppError) return { error: e.message };
    console.error(e);
    return { error: "Une erreur inattendue est survenue. Réessayez." };
  }
}
