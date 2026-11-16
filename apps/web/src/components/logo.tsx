/** LICENGO mark: italic green "L" with a running player, on night blue. */
export const LOGO_PATHS = `
  <path d="M10.5 7h6.2l-3.9 18.2h12.4L24 31H5.6z" fill="#35CF5B"/>
  <circle cx="27.6" cy="8.6" r="3.1" fill="#FFFFFF"/>
  <path d="M19.2 15.2l5.4-2.6 3.4 3.9 4.6.6M24.6 12.6l-3.3 7.6 4.6 3.1-1.9 5.2M21.3 20.2l-5.1.3" stroke="#FFFFFF" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#0B1426" />
      <g dangerouslySetInnerHTML={{ __html: LOGO_PATHS }} />
    </svg>
  );
}

export function Logo({ light = false, tagline = false, className = "" }: { light?: boolean; tagline?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className={`font-display text-xl font-black italic tracking-tight ${light ? "text-white" : "text-pitch-900"}`}>LICEN<span className="text-volt-500">GO</span></span>
        {tagline && <span className={`mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${light ? "text-white/60" : "text-muted"}`}>Le sport. La licence. En un clic.</span>}
      </span>
    </span>
  );
}
