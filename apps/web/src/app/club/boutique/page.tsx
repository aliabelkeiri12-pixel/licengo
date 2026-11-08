import { formatEUR, ORDER_STATUS_LABELS } from "@licengo/core";
import { prisma } from "@/server/db";
import { clubContext } from "@/lib/guards";
import { Card, PageHeader, StatCard, OrderBadge, Input, Select, Textarea, Field, Badge, formatDate, Button, LinkButton } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { createProductAction, updateStockAction, toggleProductAction, orderStatusAction, createSupplierAction } from "@/app/actions/club";

export const metadata = { title: "Boutique du club" };
const CATS = ["MAILLOT", "SHORT", "CHAUSSETTES", "SURVETEMENT", "VESTE", "PARKA", "SAC", "BONNET", "GANTS", "AUTRE"];

export default async function ClubShop() {
  const { clubId } = await clubContext();
  const [club, products, orders, suppliers, sales] = await Promise.all([
    prisma.club.findUniqueOrThrow({ where: { id: clubId }, include: { plan: true } }),
    prisma.product.findMany({ where: { clubId }, include: { variants: { orderBy: { id: "asc" } }, supplier: true }, orderBy: { name: "asc" } }),
    prisma.shopOrder.findMany({ where: { clubId, status: { not: "PENDING_PAYMENT" } }, include: { items: true, user: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.supplier.findMany({ where: { OR: [{ clubId }, { clubId: null }] } }),
    prisma.shopOrder.aggregate({ where: { clubId, status: { notIn: ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"] } }, _sum: { subtotalCents: true, clubAmountCents: true, platformFeeCents: true }, _count: true }),
  ]);
  const lowStock = products.flatMap((p) => p.variants.filter((v) => v.stock <= v.lowStockThreshold).map((v) => ({ p, v })));
  return (
    <>
      <PageHeader title="Boutique" subtitle={`Commission LICENGO : ${(club.plan?.shopCommissionBps ?? 500) / 100} % des ventes · le reste est versé au club`} action={<LinkButton href={`/boutique/${club.slug}`} variant="outline">Voir la boutique</LinkButton>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard tone="dark" label="Ventes" value={formatEUR(sales._sum.subtotalCents ?? 0)} hint={`${sales._count} commandes`} />
        <StatCard label="Revenu club" value={formatEUR(sales._sum.clubAmountCents ?? 0)} />
        <StatCard label="Commission LICENGO" value={formatEUR(sales._sum.platformFeeCents ?? 0)} />
        <StatCard label="Stocks bas" value={lowStock.length} hint="variantes ≤ seuil" />
      </div>

      <h2 className="font-display mb-3 mt-8 text-lg font-bold">Commandes</h2>
      <Card className="divide-y divide-line">
        {orders.length === 0 && <p className="p-4 text-sm text-muted">Aucune commande payée.</p>}
        {orders.map((o) => (
          <div key={o.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0"><p className="font-semibold">{o.number} · {o.user.firstName} {o.user.lastName} <OrderBadge status={o.status} /></p><p className="text-xs text-muted">{formatDate(o.createdAt)} · {o.items.map((i) => `${i.productName} ${i.size} ×${i.quantity}${i.personalization ? ` « ${i.personalization} »` : ""}`).join(", ")}</p></div>
            <form action={orderStatusAction} className="flex shrink-0 gap-2">
              <input type="hidden" name="orderId" value={o.id} />
              <Select name="status" defaultValue={o.status} className="h-9 w-48 text-sm">{(["PAID", "PREPARING", "SHIPPED", "READY_FOR_PICKUP", "DELIVERED"] as const).map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}</Select>
              <Input name="tracking" placeholder="N° suivi" defaultValue={o.trackingNumber ?? ""} className="h-9 w-28 text-sm" />
              <Button size="sm" variant="outline">MAJ</Button>
            </form>
          </div>
        ))}
      </Card>

      <h2 className="font-display mb-3 mt-8 text-lg font-bold">Articles & stocks</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {products.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div><p className="font-bold">{p.name} {!p.active && <Badge>Masqué</Badge>}</p><p className="text-xs text-muted">{formatEUR(p.priceCents)}{p.costCents ? ` · coût ${formatEUR(p.costCents)} · marge ${formatEUR(p.priceCents - p.costCents)}` : ""}{p.supplier ? ` · ${p.supplier.name}` : ""}</p></div>
              <form action={toggleProductAction}><input type="hidden" name="productId" value={p.id} /><button className="text-xs font-semibold text-pitch-700">{p.active ? "Masquer" : "Publier"}</button></form>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.variants.map((v) => (
                <form key={v.id} action={updateStockAction} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${v.stock <= v.lowStockThreshold ? "border-amber-300 bg-amber-50" : "border-line"}`}>
                  <input type="hidden" name="variantId" value={v.id} />
                  <span className="font-semibold">{v.size}</span>
                  <input name="stock" type="number" min={0} defaultValue={v.stock} className="h-7 w-12 rounded border border-line px-1 text-xs" aria-label={`Stock ${v.size}`} />
                  <button className="font-bold text-pitch-700" aria-label="Enregistrer">✓</button>
                </form>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg font-bold">Ajouter un article</h2>
          <ActionForm action={createProductAction} className="mt-4 space-y-3" resetOnSuccess>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom" name="name"><Input name="name" required /></Field>
              <Field label="Type" name="category"><Select name="category">{CATS.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}</Select></Field>
              <Field label="Prix de vente (€)" name="price"><Input name="price" inputMode="decimal" required /></Field>
              <Field label="Coût fournisseur (€)" name="cost"><Input name="cost" inputMode="decimal" /></Field>
            </div>
            <Field label="Tailles (séparées par des virgules)" name="sizes"><Input name="sizes" defaultValue="XS, S, M, L, XL" required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stock initial par taille" name="stock"><Input name="stock" type="number" min={0} defaultValue={10} /></Field>
              <Field label="Fournisseur" name="supplierId"><Select name="supplierId"><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            </div>
            <Field label="Description" name="description"><Textarea name="description" /></Field>
            <SubmitButton>Ajouter</SubmitButton>
          </ActionForm>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-lg font-bold">Fournisseurs</h2>
          <ul className="mt-3 space-y-1 text-sm">{suppliers.map((s) => <li key={s.id}><b>{s.name}</b> <span className="text-muted">{s.email ?? ""} {s.phone ?? ""}</span></li>)}</ul>
          <ActionForm action={createSupplierAction} className="mt-4 space-y-3" resetOnSuccess>
            <Input name="name" placeholder="Nom du fournisseur" required />
            <div className="grid grid-cols-2 gap-3"><Input name="email" type="email" placeholder="Email" /><Input name="phone" placeholder="Téléphone" /></div>
            <SubmitButton variant="outline">Ajouter le fournisseur</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
