import { SiteHeader, MobileDock } from "@/components/site/header";
import { RateHero } from "@/components/site/rate-hero";
import { CoinComparison } from "@/components/site/coin-comparison";
import { PriceCalculator } from "@/components/site/calculator";
import { Sources } from "@/components/site/sources";
import { SiteFooter } from "@/components/site/footer";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <RateHero />
        <CoinComparison />
        <PriceCalculator />
        <Sources />
      </main>
      <SiteFooter />
      <MobileDock />
    </>
  );
}
