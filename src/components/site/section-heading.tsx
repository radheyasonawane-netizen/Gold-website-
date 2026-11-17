export function SectionHeading({ eyebrow, title, children, id }: { eyebrow: string; title: string; children?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-8 max-w-3xl">
      <p className="mb-3 flex items-center gap-3 text-[11px] font-semibold tracking-[0.18em] text-gold-deep uppercase">
        <span className="h-px w-8 bg-gold" aria-hidden />
        {eyebrow}
      </p>
      <h2 id={id} className="font-display text-3xl leading-tight font-medium tracking-tight text-charcoal sm:text-4xl">
        {title}
      </h2>
      {children ? <div className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div> : null}
    </div>
  );
}
