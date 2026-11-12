import type { ProductCategory } from "@prisma/client";
import { ProductArt } from "./product-art";

/** Real product photo when the club uploaded one, otherwise the generated visual in club colours. */
export function ProductVisual({ product, color, className = "" }: { product: { id: string; category: ProductCategory; imageMime: string | null; name: string }; color: string; className?: string }) {
  if (product.imageMime) return <img src={`/api/products/${product.id}/image`} alt={product.name} className={`aspect-square w-full rounded-2xl object-cover ${className}`} />;
  return <ProductArt category={product.category} color={color} className={className} />;
}
