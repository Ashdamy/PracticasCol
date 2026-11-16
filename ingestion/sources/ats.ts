/**
 * Registro de fuentes ATS: empresas con presencia en Colombia cuyo tablero público de empleo se consulta
 * por la API de su ATS. Sale del sondeo documentado en `docs/automatizacion-fuentes.md`
 * (sección «Resultado del sondeo de ATS»).
 *
 * Por qué solo Greenhouse y Lever:
 * - **SmartRecruiters NO está**: su robots.txt dice `Disallow: /` para bots genéricos. No se automatiza
 *   (Evolution, Avery Dennison, Endava): esas ofertas entran por carga manual o por un agregador aliado.
 * - **Ashby NO está**: su robots.txt responde 401 y nuestra regla (`ingestion/http.ts`) trata eso como
 *   «no permitido». Queda pendiente de decisión del PO (Addi, Nubank, Belvo, Simetrik).
 * - Greenhouse solo prohíbe `/embed/` y Lever permite todo con `Crawl-delay: 1`.
 *
 * Para agregar una empresa: confirma con el PO que se puede usar (AGENTS.md §12), revisa que el tablero
 * exista y agrega una entrada aquí. Ninguna fuente ATS publica sola: todo entra `en_revision`.
 */
import { createGreenhouseAdapter } from "../adapters/ats/greenhouse";
import { createLeverAdapter } from "../adapters/ats/lever";
import type { AtsAdapterConfig, AtsFilter, AtsProvider } from "../adapters/ats/common";
import type { SourceAdapter } from "../types";

export interface AtsSource extends AtsAdapterConfig {
  provider: AtsProvider;
}

/** Solo Colombia y solo títulos de práctica (ver `isInternshipTitle`). */
const COLOMBIA_INTERNSHIPS: AtsFilter = { countries: ["colombia"], onlyInternships: true };

function source(provider: AtsProvider, token: string, organizationName: string): AtsSource {
  const providerName = provider === "greenhouse" ? "Greenhouse" : "Lever";
  return {
    provider,
    id: `src-ats-${token}`,
    name: `${organizationName} (${providerName})`,
    token,
    organizationName,
    filter: COLOMBIA_INTERNSHIPS,
  };
}

export const ATS_SOURCES: readonly AtsSource[] = [
  source("greenhouse", "powerdigitalmarketing", "Power Digital Marketing"),
  source("greenhouse", "clara", "Clara"),
  source("greenhouse", "cobre", "Cobre"),
  source("greenhouse", "wizeline", "Wizeline"),
  source("lever", "lahaus", "La Haus"),
  source("lever", "yuno", "Yuno"),
];

/** Busca por id de fuente (`src-ats-clara`) o por el token del tablero (`clara`). */
export function findAtsSource(key: string, sources: readonly AtsSource[] = ATS_SOURCES): AtsSource | undefined {
  const wanted = key.trim().toLowerCase();
  return sources.find((s) => s.id === wanted || s.token.toLowerCase() === wanted);
}

export function createAtsAdapter(config: AtsSource): SourceAdapter {
  return config.provider === "greenhouse" ? createGreenhouseAdapter(config) : createLeverAdapter(config);
}
