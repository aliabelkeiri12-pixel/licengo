import type { ProductCategory } from "@prisma/client";

/** Generated product visual in club colours (real photos uploaded by clubs replace it). */
export function ProductArt({ category, color, className = "" }: { category: ProductCategory; color: string; className?: string }) {
  const shapes: Record<string, React.ReactNode> = {
    MAILLOT: <path d="M30 20l14-8h12l14 8 12 16-14 8-6-6v46H38V38l-6 6-14-8z" />,
    SHORT: <path d="M28 26h44l6 50H56l-6-24-6 24H22z" />,
    CHAUSSETTES: <path d="M40 12h18v44l12 14a10 10 0 01-14 14L40 66z" />,
    SURVETEMENT: <path d="M30 18l14-6h12l14 6 10 30-10 4-4-14v52H34V38l-4 14-10-4z" />,
    VESTE: <path d="M30 18l14-6 6 8 6-8 14 6 10 30-10 4-4-14v52H34V38l-4 14-10-4z" />,
    PARKA: <path d="M28 20l12-8h20l12 8 10 34-10 3-4-13v50H32V44l-4 13-10-3z" />,
    SAC: <path d="M20 40h60v36a6 6 0 01-6 6H26a6 6 0 01-6-6zM38 40v-8a12 12 0 0124 0v8" />,
    BONNET: <path d="M22 66a28 28 0 0156 0zM20 66h60v10H20zM50 22a5 5 0 110 .1" />,
    GANTS: <path d="M30 30h8v-8h6v8h4v-10h6v10h4v-6h6v30l-6 22H36l-10-16v-14h6z" />,
    AUTRE: <circle cx="50" cy="50" r="24" />,
  };
  return (
    <div className={`grid aspect-square place-items-center rounded-2xl ${className}`} style={{ background: `linear-gradient(145deg, ${color}22, ${color}08)` }}>
      <svg viewBox="0 0 100 100" className="h-2/3 w-2/3" fill={color} stroke="#ffffff55" strokeWidth="1">{shapes[category]}</svg>
    </div>
  );
}
