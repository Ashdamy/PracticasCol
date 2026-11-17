import { Suspense } from "react";
import { getHomeData } from "@/server/queries";
import { HomeHero } from "@/components/home-hero";
import { HomeOpportunities } from "@/components/home-opportunities";
import { ResultsSkeleton } from "@/components/results-skeleton";
async function Opportunities() {
  const data = await getHomeData();
  return <HomeOpportunities data={data} />;
}
export default function Home() {
  return (
    <main id="main">
      <HomeHero />
      <Suspense fallback={<ResultsSkeleton />}>
        <Opportunities />
      </Suspense>
    </main>
  );
}
