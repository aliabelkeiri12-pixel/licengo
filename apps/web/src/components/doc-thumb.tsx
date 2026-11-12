"use client";
import { useState } from "react";

/** Document thumbnail; shows a clear placeholder if the file is no longer available. */
export function DocThumb({ id, alt, isImage }: { id: string; alt: string; isImage: boolean }) {
  const [broken, setBroken] = useState(false);
  if (!isImage || broken)
    return <span className="grid h-28 w-28 place-items-center p-2 text-center text-[11px] font-semibold text-muted">{broken ? "Aperçu indisponible" : "PDF"}</span>;
  return <img src={`/api/documents/${id}`} alt={alt} className="h-28 w-28 object-cover" onError={() => setBroken(true)} />;
}
