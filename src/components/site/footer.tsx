import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-charcoal text-white/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-12 pb-28 sm:px-6 md:grid-cols-[1.4fr_1fr] md:pb-12 lg:px-8">
        <div>
          <div className="[&_span.text-charcoal]:text-white [&_span.text-gold-deep]:text-gold-light">
            <Logo />
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">
            Today’s Indian 24K gold rate with GST, and a fair way to compare what brands charge for a 10 g coin. Rates by OroPocket. For information only, not investment advice.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-2 text-sm">
          <li><a className="hover:text-white" href="#rate">Today’s rate</a></li>
          <li><a className="hover:text-white" href="#coins">Coin prices</a></li>
          <li><a className="hover:text-white" href="#calculator">Calculator</a></li>
          <li><a className="hover:text-white" href="#sources">Sources</a></li>
        </ul>
      </div>
    </footer>
  );
}
