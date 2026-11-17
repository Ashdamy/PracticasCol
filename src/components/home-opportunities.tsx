import Link from "next/link";
import type { HomeData } from "@/lib/contracts";
import { OpportunityListItem } from "./opportunity-list";

export function HomeOpportunities({ data }: { data: HomeData }) {
  const recentIds = new Set(data.recent.map(opportunity => opportunity.id));
  const closingSoon = data.closingSoon
    .filter(opportunity => !recentIds.has(opportunity.id))
    .slice(0, 4);
  const empty = data.closingSoon.length === 0 && data.recent.length === 0;

  return (
    <>
      {closingSoon.length > 0 && (
        <section className="content home-opportunities" aria-labelledby="closing-soon-title">
          <div className="section-heading">
            <h2 id="closing-soon-title">Prácticas que cierran pronto</h2>
            <Link className="clear-link" href="/practicas?orden=cierre">
              Ver todas las prácticas
            </Link>
          </div>
          <p style={{ marginBlock: "12px 24px" }}>Cierran en los próximos 7 días.</p>
          <div className="opportunity-list">
            {closingSoon.map(opportunity => (
              <OpportunityListItem key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        </section>
      )}
      <section className="content home-opportunities" aria-labelledby="recent-title">
        <div className="section-heading">
          <h2 id="recent-title">Recién publicadas</h2>
          {data.recent.length > 0 && (
            <Link className="clear-link" href="/practicas?orden=recientes">
              Ver todas las prácticas
            </Link>
          )}
        </div>
        {data.recent.length > 0 ? (
          <>
            <p style={{ marginBlock: "12px 24px" }}>
              {data.totals.active} convocatorias de {data.totals.sources} fuentes.
            </p>
            <div className="opportunity-list">
              {data.recent.map(opportunity => (
                <OpportunityListItem key={opportunity.id} opportunity={opportunity} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty">
            <p>{empty ? "Todavía no hay prácticas para mostrar." : "No hay publicaciones recientes para mostrar."}</p>
            <Link className="button button-primary" href="/practicas">Explorar prácticas</Link>
          </div>
        )}
      </section>
    </>
  );
}
