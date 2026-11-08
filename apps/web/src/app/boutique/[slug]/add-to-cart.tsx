"use client";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Input, cx } from "@/components/ui";
import { addToCartAction } from "@/app/actions/family";

export function AddToCart({ variants, personalizable }: { variants: { id: string; size: string; stock: number }[]; personalizable?: boolean }) {
  const [v, setV] = useState(variants.find((x) => x.stock > 0)?.id ?? "");
  const sel = variants.find((x) => x.id === v);
  return (
    <ActionForm action={addToCartAction} className="space-y-3">
      <input type="hidden" name="variantId" value={v} />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Taille">
        {variants.map((x) => (
          <button key={x.id} type="button" disabled={x.stock === 0} onClick={() => setV(x.id)} aria-checked={v === x.id} role="radio"
            className={cx("h-9 min-w-11 rounded-lg border px-2 text-xs font-semibold", v === x.id ? "border-pitch-800 bg-pitch-800 text-white" : "border-line bg-white", x.stock === 0 && "line-through opacity-40")}>{x.size}</button>
        ))}
      </div>
      <p className="text-xs text-muted">{sel ? (sel.stock <= 3 ? `Plus que ${sel.stock} en stock` : "En stock") : "Rupture de stock"}</p>
      {personalizable && <Input name="personalization" placeholder="Flocage (nom, facultatif)" maxLength={30} className="h-9 text-sm" />}
      <div className="flex gap-2">
        <Input name="quantity" type="number" min={1} max={Math.min(20, sel?.stock ?? 1)} defaultValue={1} className="h-11 w-20" aria-label="Quantité" />
        <SubmitButton className="flex-1">Ajouter au panier</SubmitButton>
      </div>
    </ActionForm>
  );
}
