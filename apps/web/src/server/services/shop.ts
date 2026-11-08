import { computeShopSplit, ORDER_STATUS_LABELS, type OrderStatus } from "@licengo/core";
import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import { notify, notifyClubStaff } from "../notify";
import { audit } from "../audit";
import type { SessionUser } from "../auth";

export async function addToCart(user: SessionUser, variantId: string, quantity: number, personalization?: string) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new AppError("Quantité invalide");
  const v = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!v || !v.product.active) throw notFound("Article");
  const existing = await prisma.cartItem.findUnique({ where: { userId_variantId: { userId: user.id, variantId } } });
  const q = (existing?.quantity ?? 0) + quantity;
  if (q > v.stock) throw new AppError(`Stock insuffisant (${v.stock} disponible${v.stock > 1 ? "s" : ""})`);
  await prisma.cartItem.upsert({ where: { userId_variantId: { userId: user.id, variantId } }, create: { userId: user.id, variantId, quantity: q, personalization }, update: { quantity: q, personalization } });
}

export async function updateCartItem(user: SessionUser, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findUnique({ where: { id: itemId }, include: { variant: true } });
  if (!item || item.userId !== user.id) throw forbidden();
  if (quantity <= 0) return prisma.cartItem.delete({ where: { id: itemId } });
  if (quantity > item.variant.stock) throw new AppError("Stock insuffisant");
  return prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
}

export const getCart = (userId: string) =>
  prisma.cartItem.findMany({ where: { userId }, include: { variant: { include: { product: { include: { club: true } } } } }, orderBy: { createdAt: "asc" } });

const orderNumber = () => `LG-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;

/** Creates one order per club from the cart and reserves stock atomically (no overselling). */
export async function checkoutCart(user: SessionUser) {
  const items = await getCart(user.id);
  if (!items.length) throw new AppError("Panier vide");
  const byClub = new Map<string, typeof items>();
  for (const i of items) byClub.set(i.variant.product.clubId, [...(byClub.get(i.variant.product.clubId) ?? []), i]);
  const orders = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const [clubId, lines] of byClub) {
      for (const l of lines) {
        const res = await tx.productVariant.updateMany({ where: { id: l.variantId, stock: { gte: l.quantity } }, data: { stock: { decrement: l.quantity } } });
        if (res.count === 0) throw new AppError(`Stock insuffisant pour ${l.variant.product.name} (${l.variant.size})`);
      }
      const club = await tx.club.findUniqueOrThrow({ where: { id: clubId }, include: { plan: true } });
      const split = computeShopSplit(lines.map((l) => ({ unitPriceCents: l.variant.product.priceCents, quantity: l.quantity })), club.plan?.shopCommissionBps ?? 500);
      created.push(await tx.shopOrder.create({
        data: {
          number: orderNumber(), userId: user.id, clubId, subtotalCents: split.subtotalCents, platformFeeCents: split.platformFeeCents, clubAmountCents: split.clubAmountCents,
          items: { create: lines.map((l) => ({ variantId: l.variantId, productName: l.variant.product.name, size: l.variant.size, quantity: l.quantity, unitPriceCents: l.variant.product.priceCents, personalization: l.personalization })) },
        },
      }));
    }
    await tx.cartItem.deleteMany({ where: { userId: user.id } });
    return created;
  });
  for (const o of orders) await audit(user.id, "order.create", "ShopOrder", o.id);
  return orders;
}

export async function cancelUnpaidOrder(user: SessionUser, orderId: string) {
  const o = await prisma.shopOrder.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!o || (o.userId !== user.id && user.role !== "ADMIN")) throw forbidden();
  if (o.status !== "PENDING_PAYMENT") throw new AppError("Seules les commandes non payées peuvent être annulées");
  await prisma.$transaction([
    ...o.items.map((i) => prisma.productVariant.update({ where: { id: i.variantId }, data: { stock: { increment: i.quantity } } })),
    prisma.shopOrder.update({ where: { id: o.id }, data: { status: "CANCELLED" } }),
  ]);
}

export async function updateOrderStatus(user: SessionUser, orderId: string, status: OrderStatus, trackingNumber?: string) {
  const o = await prisma.shopOrder.findUnique({ where: { id: orderId } });
  if (!o) throw notFound("Commande");
  if (user.role !== "ADMIN" && !user.staff.some((s) => s.clubId === o.clubId)) throw forbidden();
  if (["PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(o.status)) throw new AppError("Commande non payée ou clôturée");
  await prisma.shopOrder.update({ where: { id: o.id }, data: { status, trackingNumber: trackingNumber || o.trackingNumber } });
  await notify(o.userId, { type: "ORDER_STATUS", title: `Commande ${o.number}`, body: ORDER_STATUS_LABELS[status], link: `/commandes/${o.id}` });
  await audit(user.id, "order.status", "ShopOrder", o.id, { status });
}

export async function lowStockAlert(clubId: string) {
  const low = await prisma.productVariant.findMany({ where: { product: { clubId, active: true } }, include: { product: true } });
  const items = low.filter((v) => v.stock <= v.lowStockThreshold);
  if (items.length) await notifyClubStaff(clubId, { type: "LOW_STOCK", title: "Stock bas", body: items.slice(0, 5).map((v) => `${v.product.name} ${v.size} (${v.stock})`).join(", "), link: "/club/boutique" });
  return items;
}
