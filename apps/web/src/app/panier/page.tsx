import { formatEUR } from "@licengo/core";
import { requireUser } from "@/server/auth";
import { getCart } from "@/server/services/shop";
import { Card, PageHeader, EmptyState, LinkButton } from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";
import { ActionForm, SubmitButton } from "@/components/forms";
import { updateCartAction, checkoutAction } from "@/app/actions/family";

export const metadata = { title: "Panier" };

export default async function Cart() {
  const u = await requireUser();
  const items = await getCart(u.id);
  const total = items.reduce((s, i) => s + i.variant.product.priceCents * i.quantity, 0);
  if (!items.length) return <><PageHeader title="Panier" /><EmptyState title="Votre panier est vide" action={<LinkButton href="/famille">Retour</LinkButton>} /></>;
  return (
    <>
      <PageHeader title="Panier" subtitle={`${items.reduce((s, i) => s + i.quantity, 0)} article(s)`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="divide-y divide-line">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-4 p-4">
              <ProductVisual product={i.variant.product} color={i.variant.product.club.primaryColor} className="h-16 w-16 shrink-0" />
              <div className="min-w-0 flex-1"><p className="font-semibold">{i.variant.product.name}</p><p className="text-xs text-muted">Taille {i.variant.size} · {i.variant.product.club.name}{i.personalization ? ` · Flocage « ${i.personalization} »` : ""}</p></div>
              <form action={updateCartAction} className="flex items-center gap-1">
                <input type="hidden" name="itemId" value={i.id} />
                <button name="quantity" value={i.quantity - 1} className="h-8 w-8 rounded-lg border border-line" aria-label="Diminuer">−</button>
                <span className="w-6 text-center text-sm font-semibold">{i.quantity}</span>
                <button name="quantity" value={i.quantity + 1} className="h-8 w-8 rounded-lg border border-line" aria-label="Augmenter">+</button>
              </form>
              <p className="w-20 text-right font-semibold">{formatEUR(i.variant.product.priceCents * i.quantity)}</p>
            </div>
          ))}
        </Card>
        <Card className="h-fit p-5">
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatEUR(total)}</span></div>
          <p className="mt-1 text-xs text-muted">Retrait au club. Aucun frais de livraison.</p>
          <ActionForm action={checkoutAction} className="mt-4"><SubmitButton variant="volt" size="lg" className="w-full">Commander et payer</SubmitButton></ActionForm>
        </Card>
      </div>
    </>
  );
}
