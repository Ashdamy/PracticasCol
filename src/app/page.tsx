import { Suspense } from "react";
import Link from "next/link";
import { getHomeData } from "@/server/queries";
import { HomeHero } from "@/components/home-hero";
import { OpportunityListItem } from "@/components/opportunity-list";
import { ResultsSkeleton } from "@/components/results-skeleton";
async function ClosingSoon() {
  const { closingSoon, totals } = await getHomeData();
  return (
    <div className="content home-opportunities">
      <div className="section-heading">
        <h2>Prácticas que cierran pronto</h2>
        <Link className="clear-link" href="/practicas?orden=cierre">
          Ver todas las prácticas
        </Link>
      </div>
      <p style={{ marginBlock: "12px 24px" }}>
        {totals.active} convocatorias de {totals.sources} fuentes.
      </p>
      <div className="opportunity-list">
        {closingSoon.slice(0, 4).map((o) => (
          <OpportunityListItem key={o.id} opportunity={o} />
        ))}
      </div>
    </div>
  );
}
export default function Home() {
  return (
    <main id="main">
      <HomeHero />
      <Suspense fallback={<ResultsSkeleton />}>
        <ClosingSoon />
      </Suspense>
    </main>
  );
}
