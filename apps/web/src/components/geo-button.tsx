"use client";
import { LocateFixed } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function GeoButton() {
  const router = useRouter();
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-pitch-800 hover:bg-pitch-50"
      onClick={() => {
        setBusy(true);
        navigator.geolocation.getCurrentPosition(
          (p) => { const q = new URLSearchParams(sp); q.set("lat", p.coords.latitude.toFixed(4)); q.set("lng", p.coords.longitude.toFixed(4)); q.delete("q"); router.push(`/clubs?${q}`); setBusy(false); },
          () => { setBusy(false); alert("Localisation indisponible"); },
          { timeout: 8000 },
        );
      }}>
      <LocateFixed className="h-4 w-4" /> {busy ? "…" : "Autour de moi"}
    </button>
  );
}
