/**
 * PLACEHOLDER de Fase 0 (Claude). Solo verifica que el contrato y los mocks funcionan.
 * Codex: reemplaza este archivo por la página de inicio real.
 * Patrón obligatorio con cacheComponents: los datos de "@/server/queries" van dentro de <Suspense>.
 */
import { Suspense } from "react";
import { getHomeData } from "@/server/queries";

async function Totals() {
  const { totals, closingSoon } = await getHomeData();
  return (
    <div>
      <p>
        {totals.active} convocatorias activas · {totals.organizations} organizaciones · {totals.sources} fuentes
      </p>
      <ul>
        {closingSoon.map((o) => (
          <li key={o.id}>
            {o.title} — {o.organization.name} (cierra en {o.deadline.daysLeft} días)
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>PrácticasCol</h1>
      <p>Fase 0 · datos de prueba (USE_MOCKS=true)</p>
      <Suspense fallback={<p>Cargando…</p>}>
        <Totals />
      </Suspense>
    </main>
  );
}
