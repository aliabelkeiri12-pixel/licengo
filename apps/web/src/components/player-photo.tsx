"use client";
import { useState } from "react";

/** Player's ID photo (from the file) so the secretary recognises the player; initials when there is none. */
export function PlayerPhoto({ photo, firstName, lastName, size = "md" }: { photo?: { id: string; mimeType: string } | null; firstName: string; lastName: string; size?: "md" | "lg" }) {
  const [broken, setBroken] = useState(false);
  const cls = size === "lg" ? "h-16 w-16 text-xl" : "h-10 w-10 text-sm";
  if (photo && photo.mimeType.startsWith("image/") && !broken)
    return <img src={`/api/documents/${photo.id}`} alt={`Photo de ${firstName} ${lastName}`} onError={() => setBroken(true)} className={`${cls} shrink-0 rounded-full object-cover ring-2 ring-white`} data-testid="player-photo" />;
  return <span className={`${cls} grid shrink-0 place-items-center rounded-full bg-pitch-900 font-display font-bold text-volt-400`}>{firstName[0]}{lastName[0]}</span>;
}
