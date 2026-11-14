import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { listSources } from "@/server/queries";
import { SOURCE_METHOD_LABELS } from "@/lib/catalog/labels";
import { date } from "@/lib/format";
import { ResultsSkeleton } from "@/components/results-skeleton";
async function Sources() {
  const sources = await listSources();
  return sources.map((s) => (
    <article key={s.url} className="source-row">
      <h2>{s.name}</h2>
      <p>
        {SOURCE_METHOD_LABELS[s.method]} · {s.activeCount} convocatorias
      </p>
      <p>
        Última actualización: {s.lastRunAt ? date(s.lastRunAt) : "Sin registro"}
      </p>
      <a href={s.url} target="_blank" rel="noopener noreferrer">
        Visitar fuente <ArrowUpRight size={16} />
        <span className="sr-only"> (abre en una pestaña nueva)</span>
      </a>
    </article>
  ));
}
export const metadata = { title: "Fuentes y verificación | PrácticasCol" };
export default function Page() {
  return (
    <main id="main" className="content simple-page">
      <h1>Fuentes y verificación</h1>
      <p>
        Reunimos la información y enlazamos a su publicación original. Revisa
        siempre los requisitos y las fechas en la fuente antes de postularte.
      </p>
      <Suspense fallback={<ResultsSkeleton />}>
        <Sources />
      </Suspense>
    </main>
  );
}
