import { SiteHeader } from "@/components/site/header";
import { McxPrice } from "@/components/site/mcx-price";
import { McxSource } from "@/components/site/mcx-source";
import { SiteFooter } from "@/components/site/footer";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <McxPrice />
        <McxSource />
      </main>
      <SiteFooter />
    </>
  );
}
