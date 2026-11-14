import { Suspense } from "react";
import { connection } from "next/server";
import { mockCards, mockCardsWithProfile, mockDetail } from "@/lib/mocks";
import { OpportunityListItem as OpportunityCard } from "@/components/opportunity-list";
import { EligibilityBadge } from "@/components/eligibility-badge";
import { ResultsSkeleton } from "@/components/results-skeleton";
export const metadata = {
  title: "Sistema de diseño | PrácticasCol",
  robots: { index: false, follow: false },
};
async function Gallery() {
  await connection();
  return (
    <>
      <p className="notice">
        Datos ficticios para revisar el sistema de diseño. No son convocatorias
        reales.
      </p>
      <div className="active-filters">
        {(["sin_perfil", "cumple", "revisar", "no_cumple"] as const).map(
          (v) => (
            <EligibilityBadge key={v} verdict={v} />
          ),
        )}
      </div>
      <h2>Tarjetas sin perfil</h2>
      <div className="cards">
        {mockCards.map((o) => (
          <OpportunityCard key={o.id} opportunity={o} />
        ))}
      </div>
      <h2>Tarjetas con perfil</h2>
      <div className="cards">
        {mockCardsWithProfile.map((o) => (
          <OpportunityCard key={o.id} opportunity={o} />
        ))}
      </div>
      <h2>Desglose de requisitos</h2>
      <ul>
        {mockDetail.eligibility?.checks.map((c) => (
          <li key={c.code}>{c.message}</li>
        ))}
      </ul>
    </>
  );
}
export default function Page() {
  return (
    <main id="main" className="content simple-page">
      <h1>Sistema de diseño</h1>
      <Suspense fallback={<ResultsSkeleton />}>
        <Gallery />
      </Suspense>
    </main>
  );
}
