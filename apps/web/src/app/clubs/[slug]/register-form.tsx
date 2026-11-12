"use client";
import { useMemo, useState } from "react";
import { formatEUR } from "@licengo/core";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Select } from "@/components/ui";
import { createRegistrationAction } from "@/app/actions/family";

type C = { id: string; name: string; year: number; gender: string };
type Cat = { id: string; name: string; min: number; max: number; gender: string; price: number };

type Extra = { id: string; label: string; description: string | null; amountCents: number; mandatory: boolean };

export function RegisterForm({ members: children, categories, feeCents, defaultChild, extras = [] }: { members: C[]; categories: Cat[]; feeCents: number; defaultChild?: string; extras?: Extra[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const extrasTotal = extras.filter((e) => e.mandatory || picked.includes(e.id)).reduce((t, e) => t + e.amountCents, 0);
  const [childId, setChildId] = useState(children.find((c) => c.id === defaultChild)?.id ?? children[0].id);
  const child = children.find((c) => c.id === childId)!;
  const eligible = useMemo(() => categories.filter((c) => child.year >= c.min && child.year <= c.max && (c.gender === "MIXED" || c.gender === child.gender)), [categories, child]);
  const [catId, setCatId] = useState<string>("");
  const selected = eligible.find((c) => c.id === catId) ?? eligible[0];
  return (
    <ActionForm action={createRegistrationAction} className="mt-4 space-y-4">
      <Field label="Qui inscrire ?" name="childId"><Select name="childId" value={childId} onChange={(e) => { setChildId(e.target.value); setCatId(""); }}>{children.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}</Select></Field>
      {eligible.length === 0 ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Aucune catégorie ouverte pour une naissance en {child.year}.</p> : (
        <>
          <Field label="Catégorie" name="categoryId" hint="Proposée automatiquement selon l'année de naissance"><Select name="categoryId" value={selected?.id} onChange={(e) => setCatId(e.target.value)}>{eligible.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          {extras.filter((e) => !e.mandatory).map((e) => (
            <label key={e.id} className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
              <input type="checkbox" name="extras" value={e.id} checked={picked.includes(e.id)} onChange={(ev) => setPicked(ev.target.checked ? [...picked, e.id] : picked.filter((x) => x !== e.id))} className="mt-0.5 h-4 w-4 accent-pitch-700" data-testid={`extra-${e.label}`} />
              <span><b>{e.label}</b> +{formatEUR(e.amountCents)}{e.description && <span className="block text-xs text-muted">{e.description}</span>}</span>
            </label>
          ))}
          {selected && (
            <div className="rounded-xl bg-chalk p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted">Licence</span><span>{formatEUR(selected.price)}</span></div>
              {extras.filter((e) => e.mandatory || picked.includes(e.id)).map((e) => <div key={e.id} className="flex justify-between"><span className="text-muted">{e.label}</span><span>{formatEUR(e.amountCents)}</span></div>)}
              <div className="flex justify-between"><span className="text-muted">Frais LICENGO</span><span>{formatEUR(feeCents)}</span></div>
              <div className="mt-1 flex justify-between border-t border-line pt-1 font-bold"><span>Total</span><span>{formatEUR(selected.price + extrasTotal + feeCents)}</span></div>
            </div>
          )}
          <SubmitButton className="w-full" size="lg">Commencer l'inscription</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
