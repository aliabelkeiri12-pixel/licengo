"use client";
export function PrintButton() {
  return <button onClick={() => window.print()} className="rounded-xl bg-pitch-800 px-4 py-2 text-sm font-semibold text-white">🖨️ Imprimer</button>;
}
