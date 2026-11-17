import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-charcoal text-white/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-12 pb-28 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8 lg:pb-12">
        <div>
          <div className="[&_span.text-charcoal]:text-white [&_span.text-gold-deep]:text-gold-light">
            <Logo />
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">
            An independent reference for Indian gold buyers. Prices are international spot converted to rupees; Indian retail, MCX and IBJA prices differ. For information only, not investment advice.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-gold-light uppercase">Explore</div>
            <ul className="space-y-2">
              <li><a className="hover:text-white" href="#overview">Market overview</a></li>
              <li><a className="hover:text-white" href="#chart">Price history</a></li>
              <li><a className="hover:text-white" href="#calculator">Calculator</a></li>
              <li><a className="hover:text-white" href="#sellers">Seller comparison</a></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-gold-light uppercase">Data</div>
            <ul className="space-y-2">
              <li><a className="hover:text-white" href="https://gold-api.com/" target="_blank" rel="noopener noreferrer">gold-api.com</a></li>
              <li><a className="hover:text-white" href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer">ECB via Frankfurter</a></li>
              <li><a className="hover:text-white" href="https://www.worldbank.org/en/research/commodity-markets" target="_blank" rel="noopener noreferrer">World Bank Pink Sheet</a></li>
              <li><a className="hover:text-white" href="#methodology">Methodology</a></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
