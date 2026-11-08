export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#0B3D2E" />
      <path d="M11 9v22h12" stroke="#F6F5F1" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M22 14l7 6-7 6" stroke="#C6F432" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className={`font-display text-xl font-extrabold tracking-tight ${light ? "text-white" : "text-pitch-900"}`}>
        LICEN<span className="text-volt-600">GO</span>
      </span>
    </span>
  );
}
