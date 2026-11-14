import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";
import { parseSearchParams, toSearchParams } from "@/lib/contracts";
import { searchOpportunities, getFilterOptions } from "@/server/queries";
import {
  SearchBox,
  Filters,
  SortControl,
  ActiveFilters,
} from "@/components/search-controls";
import { OpportunityListItem } from "@/components/opportunity-list";
import { ResultsSkeleton } from "@/components/results-skeleton";
export const metadata = {
  title: "Buscar prácticas | PrácticasCol",
  description:
    "Compara prácticas, pasantías y contratos de aprendizaje en Medellín y el Valle de Aburrá.",
};
async function Results({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseSearchParams(await searchParams);
  const [result, options] = await Promise.all([
    searchOpportunities(params),
    getFilterOptions(),
  ]);
  return (
    <>
      <div className="search-band">
        <div className="content">
          <SearchBox
            key={toSearchParams(result.params).toString()}
            params={result.params}
          />
          <nav className="quick-filters" aria-label="Búsquedas rápidas">
            {[
              { label: "Todas las prácticas", types: undefined },
              {
                label: "Contrato de aprendizaje",
                types: ["contrato_aprendizaje"] as const,
              },
              { label: "Pasantías", types: ["pasantia"] as const },
              {
                label: "Prácticas profesionales",
                types: ["practica_profesional"] as const,
              },
            ].map((t) => (
              <Link
                key={t.label}
                aria-current={
                  JSON.stringify(result.params.types) ===
                  JSON.stringify(t.types)
                    ? "page"
                    : undefined
                }
                href={`/practicas?${toSearchParams({ ...result.params, types: t.types ? [...t.types] : undefined, page: 1 })}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="content catalog-layout">
        <Filters result={result} options={options} />
        <div className="results">
          <div className="results-top">
            <div>
              <h2>
                {result.total}{" "}
                {result.total === 1 ? "convocatoria" : "convocatorias"}
                {params.q ? ` para “${params.q}”` : " disponibles"}
              </h2>
              <p>Revisa los requisitos y continúa en la fuente oficial.</p>
            </div>
            <SortControl params={result.params} />
          </div>
          <ActiveFilters params={result.params} options={options} />
          {!result.appliedProfile && (
            <div className="profile-nudge">
              <span>
                <strong>¿Esta práctica es para ti?</strong> Revisa los
                requisitos con tu perfil académico.
              </span>
              <Link href="/perfil">
                Completar mi perfil <ArrowRight size={17} />
              </Link>
            </div>
          )}
          {params.eligibleOnly && !result.appliedProfile && (
            <p role="status" className="notice">
              El filtro “Solo las que aplico” necesita tu perfil. Por ahora ves
              todas las coincidencias.
            </p>
          )}
          {result.items.length ? (
            <div className="opportunity-list">
              {result.items.map((o) => (
                <OpportunityListItem key={o.id} opportunity={o} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <SearchX size={36} />
              <h2>
                {result.total
                  ? "Esta página no tiene resultados"
                  : "No encontramos prácticas con estos filtros"}
              </h2>
              <p>
                Prueba otro programa, amplía el municipio o quita un filtro.
              </p>
              <Link
                className="button button-primary"
                href={
                  result.total
                    ? `/practicas?${toSearchParams({ ...result.params, page: 1 })}`
                    : "/practicas"
                }
              >
                {result.total
                  ? "Ir a la primera página"
                  : "Ver todas las prácticas"}
              </Link>
            </div>
          )}
          {result.totalPages > 1 && (
            <nav aria-label="Páginas de resultados" className="pagination">
              {result.page > 1 && (
                <Link
                  href={`/practicas?${toSearchParams({ ...result.params, page: result.page - 1 })}`}
                >
                  Anterior
                </Link>
              )}
              <span>
                Página {result.page} de {result.totalPages}
              </span>
              {result.page < result.totalPages && (
                <Link
                  href={`/practicas?${toSearchParams({ ...result.params, page: result.page + 1 })}`}
                >
                  Siguiente <ArrowRight size={16} />
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
export default function Page(props: PageProps<"/practicas">) {
  return (
    <main id="main">
      <div className="catalog-header content" data-enter>
        <h1>
          Encuentra tu
          <span>punto de partida.</span>
        </h1>
        <p>
          Prácticas, pasantías y contratos de aprendizaje.
          <br />
          Medellín, el Valle de Aburrá y oportunidades remotas.
        </p>
      </div>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
