import { SiteNav } from "@/components/site-nav";
import { Hero } from "@/components/hero";
import { MarketingSections } from "@/components/sections";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <MarketingSections />
      </main>
      <SiteFooter />
    </>
  );
}
