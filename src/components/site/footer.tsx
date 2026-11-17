import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-charcoal text-white/80">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="[&_span.text-charcoal]:text-white [&_span.text-gold-deep]:text-gold-light">
          <Logo />
        </div>
        <p className="max-w-md text-sm text-white/65">MCX Gold Ten futures price, ₹ per 10 g, no GST. Data via the Groww Trade API. For information only.</p>
      </div>
    </footer>
  );
}
