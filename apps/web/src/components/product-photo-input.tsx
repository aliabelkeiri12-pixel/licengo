"use client";
import { useState } from "react";

/** Photo picker for shop items: resizes to 1200 px JPEG in the browser (fast upload, small storage). */
export function ProductPhotoInput({ name = "photo" }: { name?: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return setPreview(null);
    try {
      const bmp = await createImageBitmap(f);
      const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
      if (blob) {
        const dt = new DataTransfer();
        dt.items.add(new File([blob], "photo.jpg", { type: "image/jpeg" }));
        input.files = dt.files;
        setPreview(URL.createObjectURL(blob));
        return;
      }
    } catch { /* keep the original file */ }
    setPreview(URL.createObjectURL(f));
  }
  return (
    <div className="flex items-center gap-3">
      {preview && <img src={preview} alt="Aperçu" className="h-16 w-16 rounded-lg object-cover ring-1 ring-line" />}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-pitch-50">
        📷 {preview ? "Changer la photo" : "Ajouter une photo"}
        <input type="file" name={name} accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onChange} />
      </label>
    </div>
  );
}
