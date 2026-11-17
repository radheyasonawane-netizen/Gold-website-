import { SiteHeader, MobileDock } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { MarketOverview } from "@/components/site/market-overview";
import { HistoryChart } from "@/components/site/history-chart";
import { PriceCalculator } from "@/components/site/calculator";
import { SellerComparison } from "@/components/site/sellers";
import { Methodology } from "@/components/site/methodology";
import { SiteFooter } from "@/components/site/footer";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <MarketOverview />
        <HistoryChart />
        <PriceCalculator />
        <SellerComparison />
        <Methodology />
      </main>
      <SiteFooter />
      <MobileDock />
    </>
  );
}
