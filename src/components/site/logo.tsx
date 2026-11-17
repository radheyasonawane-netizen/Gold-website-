export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <defs>
          <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E3C88E" />
            <stop offset="1" stopColor="#A9843E" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="10" fill="#F5DCE5" />
        <path d="M8 21.5 11.2 12h9.6L24 21.5Z" fill="url(#lg-gold)" />
        <path d="M11.2 12h9.6l-1 3H12.2Z" fill="#fff" opacity=".45" />
      </svg>
      <span className="leading-none">
        <span className="font-display text-[19px] font-semibold tracking-tight text-charcoal">Kanchan</span>
        <span className="ml-1.5 hidden text-[10px] font-semibold tracking-[0.18em] text-gold-deep uppercase sm:inline">Gold Intelligence</span>
      </span>
    </span>
  );
}
