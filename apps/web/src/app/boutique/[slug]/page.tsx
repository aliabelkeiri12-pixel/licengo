import { notFound } from "next/navigation";
import Link from "next/link";
import { formatEUR } from "@licengo/core";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";
import { AddToCart } from "./add-to-cart";

export default async function Shop({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ cat?: string }> }) {
  const { slug } = await params;
  const { cat } = await searchParams;
  const club = await prisma.club.findUnique({ where: { slug }, include: { products: { where: { active: true, ...(cat ? { category: cat as never } : {}) }, include: { variants: { orderBy: { id: "asc" } } }, orderBy: { name: "asc" } } } });
  if (!club || club.status !== "ACTIVE") notFound();
  const user = await getCurrentUser();
  const cats = await prisma.product.groupBy({ by: ["category"], where: { clubId: club.id, active: true } });
  return (
    <>
      <PageHeader eyebrow="Boutique officielle" title={club.name} subtitle="Retrait au club · Paiement sécurisé · Flocage disponible" action={<LinkButton href="/panier" variant="outline">Voir le panier</LinkButton>} />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <Link href={`/boutique/${slug}`} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${!cat ? "bg-pitch-800 text-white" : "bg-white ring-1 ring-line"}`}>Tout</Link>
        {cats.map((c) => <Link key={c.category} href={`/boutique/${slug}?cat=${c.category}`} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${cat === c.category ? "bg-pitch-800 text-white" : "bg-white ring-1 ring-line"}`}>{c.category.toLowerCase()}</Link>)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {club.products.map((p) => (
          <Card key={p.id} className="flex flex-col p-4">
            <ProductVisual product={p} color={club.primaryColor} />
            <div className="mt-4 flex items-start justify-between gap-2"><p className="font-bold">{p.name}</p><p className="font-display text-lg font-extrabold">{formatEUR(p.priceCents)}</p></div>
            <p className="mt-1 flex-1 text-sm text-muted">{p.description}</p>
            <div className="mt-4">{user ? <AddToCart variants={p.variants.map((v) => ({ id: v.id, size: v.size, stock: v.stock }))} personalizable={p.category === "MAILLOT"} /> : <LinkButton href={`/connexion?next=/boutique/${slug}`} variant="outline" className="w-full">Se connecter pour commander</LinkButton>}</div>
          </Card>
        ))}
      </div>
    </>
  );
}
