"use client";
import { useMemo, useState } from "react";
import { formatEUR } from "@licengo/core";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Select } from "@/components/ui";
import { createRegistrationAction } from "@/app/actions/family";

type C = { id: string; name: string; year: number; gender: string };
type Cat = { id: string; name: string; min: number; max: number; gender: string; price: number };
type Extra = { id: string; label: string; amountCents: number; kind: string };

/**
 * One single form: the player (existing or new: name, first name, birth date) and the wished category.
 * Transfer fee and reductions (town, ARS, Pass'Sport…) are decided by the club when it checks the file.
 */
export function RegisterForm({ members: children, categories, feeCents, defaultChild, mandatory = [] }: { members: C[]; categories: Cat[]; feeCents: number; defaultChild?: string; mandatory?: Extra[] }) {
  const [childId, setChildId] = useState(children.find((c) => c.id === defaultChild)?.id ?? children[0]?.id ?? "new");
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState("");
  const isNew = childId === "new";
  const known = children.find((c) => c.id === childId);
  const year = isNew ? (birth ? Number(birth.slice(0, 4)) : null) : known!.year;
  const g = isNew ? gender : known!.gender;
  const eligible = useMemo(() => (year ? categories.filter((c) => year >= c.min && year <= c.max && (c.gender === "MIXED" || !g || c.gender === g)) : categories), [categories, year, g]);
  const [catId, setCatId] = useState<string>("");
  const selected = eligible.find((c) => c.id === catId) ?? eligible[0];
  const extra = mandatory.reduce((t, e) => t + (e.kind === "REDUCTION" ? -e.amountCents : e.amountCents), 0);
  return (
    <ActionForm action={createRegistrationAction} className="mt-4 space-y-4">
      {children.length > 0 && (
        <Field label="Qui inscrire ?" name="childId">
          <Select name="childId" value={childId} onChange={(e) => { setChildId(e.target.value); setCatId(""); }}>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}
            <option value="new">➕ Un nouveau joueur</option>
          </Select>
        </Field>
      )}
      {isNew && (
        <div className="space-y-3 rounded-xl border border-line p-3" data-testid="new-player">
          {children.length === 0 && <input type="hidden" name="childId" value="new" />}
          <p className="text-sm font-bold">Le joueur</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nom" name="lastName"><Input name="lastName" required autoComplete="family-name" /></Field>
            <Field label="Prénom" name="firstName"><Input name="firstName" required /></Field>
          </div>
          <Field label="Date de naissance" name="birthDate"><Input name="birthDate" type="date" required value={birth} onChange={(e) => { setBirth(e.target.value); setCatId(""); }} /></Field>
          <div className="flex gap-4 text-sm">
            {[["M", "Garçon"], ["F", "Fille"]].map(([v, l]) => <label key={v} className="flex items-center gap-2"><input type="radio" name="gender" value={v} required checked={gender === v} onChange={() => { setGender(v); setCatId(""); }} className="h-4 w-4 accent-pitch-700" /> {l}</label>)}
          </div>
        </div>
      )}
      {eligible.length === 0 ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Aucune catégorie ouverte pour une naissance en {year}.</p> : (
        <>
          <Field label="Catégorie souhaitée" name="categoryId" hint={year ? "Proposée automatiquement selon l'année de naissance" : "Indiquez la date de naissance : la bonne catégorie sera proposée"}>
            <Select name="categoryId" value={selected?.id} onChange={(e) => setCatId(e.target.value)}>{eligible.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </Field>
          {selected && (
            <div className="rounded-xl bg-chalk p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted">Licence {selected.name}</span><span>{formatEUR(selected.price)}</span></div>
              {mandatory.map((e) => <div key={e.id} className="flex justify-between"><span className="text-muted">{e.label}</span><span>{e.kind === "REDUCTION" ? "-" : "+"}{formatEUR(e.amountCents)}</span></div>)}
              <div className="flex justify-between"><span className="text-muted">Frais LICENGO</span><span>{formatEUR(feeCents)}</span></div>
              <div className="mt-1 flex justify-between border-t border-line pt-1 font-bold"><span>Total indicatif</span><span>{formatEUR(Math.max(0, selected.price + extra) + feeCents)}</span></div>
              <p className="mt-1 text-xs text-muted">Le club vérifie votre dossier puis vous envoie le lien de paiement avec le montant final (frais de mutation, réductions commune / ARS / Pass'Sport déjà appliqués).</p>
            </div>
          )}
          <p className="text-xs text-muted">Ensuite : photo d'identité, signature de la charte et du droit à l'image, certificat médical.</p>
          <SubmitButton className="w-full" size="lg">Commencer l'inscription</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
