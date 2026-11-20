/**
 * CLI de administración (contra Supabase, con la clave secreta de .env.local). Mientras no exista el panel web.
 *   npm run admin -- revision                      lista lo que espera revisión
 *   npm run admin -- ver <id|slug>                 muestra una convocatoria completa
 *   npm run admin -- aprobar <id|slug>... [--forzar]
 *   npm run admin -- aprobar-lote [--fuente … --empresa … --municipio … --tipo … --titulo … --sin-observaciones] [--confirmar]
 *   npm run admin -- retirar <id|slug>...
 *   npm run admin -- vencer                        pasa a «vencida» las publicadas cuya fecha límite ya pasó
 *   npm run admin -- desaparecidas [--dias N] [--confirmar]   cierra las de agregadores (Jooble) que dejaron de aparecer
 *   npm run admin -- publicadas                    lista lo publicado
 *   npm run admin -- reportes [--todos]            lista los reportes de los estudiantes (con sugerencia de acción)
 *   npm run admin -- resolver <id-reporte>...      marca reportes como resueltos
 *   npm run admin -- empresas                      lista las empresas: sitio web, logo propio y si tendrán logo
 *   npm run admin -- empresa "<nombre>" --sitio <dominio> | --logo <url https> | --sin-logo
 * Nunca imprime claves.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayInBogota } from "@/lib/time";
import { createSupabaseAdminClient, readSupabaseEnv } from "@/server/repo/supabase-shared";
import { readBrandfetchClientId } from "@/server/domain/logos";
import {
  applyOrganizationPatch,
  formatOrganizationList,
  listOrganizations,
  logoStatus,
  organizationPatch,
  resolveOrganization,
  updateOrganization,
} from "./admin-organizations";
import { formatReportList, listIssueReports, markReportResolved, resolveReportId } from "./admin-reports";
import { formatSubmissionContacts, submissionContacts } from "./admin-submissions";
import {
  decideApproval,
  formatBatchSelection,
  formatDetail,
  formatListItem,
  hasBatchFilter,
  parseAdminArgs,
  resolveTarget,
  selectBatch,
  shortId,
} from "./admin-rules";
import { expireOpportunities } from "./jobs/expire";
import { DEFAULT_MISSING_DAYS, findMissingFromAggregators } from "./jobs/retire-missing";
import type { StoredOpportunity } from "./store";
import { loadLocalEnv } from "./local-env";
import { createSupabaseStore, type SupabaseStore } from "./stores/supabase";

const USAGE = `Uso: npm run admin -- <comando>

  revision                         Lista las convocatorias en revisión (id corto, título, organización, fuente y observaciones)
  ver <id|slug>                    Muestra todos los datos de una convocatoria
  aprobar <id|slug>... [--forzar]  Publica. Se niega si falta el título, la organización o un enlace https, o si ya cerró.
                                   --forzar salta el título, el https y la fecha; sin organización o sin enlace nunca se publica
  aprobar-lote <filtros> [--confirmar]
                                   Publica de una vez las convocatorias en revisión que cumplen TODOS los filtros:
                                     --fuente <texto>      fuente principal (p. ej. jooble)
                                     --empresa <texto>     parte del nombre de la organización
                                     --municipio <nombre>  p. ej. medellin, envigado, itagui
                                     --tipo <tipo>         practica_profesional, practica_empresarial, pasantia,
                                                           contrato_aprendizaje o judicatura
                                     --titulo <texto>      parte del título
                                     --sin-observaciones   solo las que no tienen ninguna observación
                                   Sin --confirmar solo muestra la lista (no cambia nada). Aplica las mismas reglas de
                                   «aprobar» (--forzar también) y nunca incluye posibles duplicados
  retirar <id|slug>...             Retira (deja de verse en el sitio)
  vencer                           Pasa a «vencida» las publicadas cuya fecha límite ya pasó
  desaparecidas [--dias N] [--confirmar]
                                   Ofertas que solo vienen de agregadores (Jooble) y llevan N días sin aparecer
                                   (por defecto ${DEFAULT_MISSING_DAYS}), contados desde la última corrida de la ingesta:
                                   las publicadas pasan a «vencida» y las que estaban en revisión, a «retirada».
                                   Sin --confirmar solo muestra la lista
  publicadas                       Lista las convocatorias publicadas
  reportes [--todos]               Lista los reportes de los estudiantes sin resolver (--todos incluye los resueltos),
                                   con la convocatoria y una sugerencia de acción. No cambia nada
  resolver <id-reporte>...         Marca reportes como resueltos (id corto o completo del reporte)
  empresas                         Lista las empresas: sitio web, logo propio y si el sitio les mostrará logo
  empresa "<nombre>" --sitio <dominio>   Guarda el sitio web (de ahí sale el logo). El nombre puede ser una parte única
  empresa "<nombre>" --logo <url https>  Guarda un logo propio (gana sobre el del sitio web)
  empresa "<nombre>" --sin-logo          Borra el sitio web y el logo (la empresa queda con sus iniciales)

El id puede ser el id corto de las listas (primeros 8 caracteres), el id completo o el slug.`;

const byTitle = (a: StoredOpportunity, b: StoredOpportunity) => a.title.localeCompare(b.title, "es");

async function list(store: SupabaseStore, title: string, filter: (o: StoredOpportunity) => boolean): Promise<number> {
  const [all, sourceNames] = await Promise.all([store.listOpportunities(), store.sourceNames()]);
  const items = all.filter(filter).sort(byTitle);
  console.log(`${title}: ${items.length}`);
  for (const item of items) console.log(formatListItem(item, sourceNames));
  return 0;
}

function needTargets(targets: readonly string[], command: string): void {
  if (targets.length === 0) throw new UsageError(`Indica al menos un id o slug: npm run admin -- ${command} <id|slug>`);
}

class UsageError extends Error {}

async function main(): Promise<number> {
  let args;
  try {
    args = parseAdminArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    return 2;
  }
  if (args.help || !args.command) {
    console.log(USAGE);
    return args.help ? 0 : 2;
  }

  let client: SupabaseClient;
  let store: SupabaseStore;
  try {
    loadLocalEnv();
    client = createSupabaseAdminClient(readSupabaseEnv());
    store = createSupabaseStore(client);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  try {
    switch (args.command) {
      case "revision":
        return await list(store, "En revisión", (o) => o.status === "en_revision" || o.needsReview);

      case "publicadas":
        return await list(store, "Publicadas", (o) => o.status === "publicada");

      case "ver": {
        needTargets(args.targets, "ver");
        const [all, sourceNames] = await Promise.all([store.listOpportunities(), store.sourceNames()]);
        for (const key of args.targets) {
          const target = resolveTarget(key, all);
          const contact = formatSubmissionContacts(await submissionContacts(client, target.id));
          console.log(`${formatDetail(target, sourceNames)}${contact ? `\n${contact}` : ""}\n`);
        }
        return 0;
      }

      case "aprobar": {
        needTargets(args.targets, "aprobar");
        const all = await store.listOpportunities();
        const today = todayInBogota();
        let failed = 0;
        for (const key of args.targets) {
          try {
            const target = resolveTarget(key, all);
            const decision = decideApproval(target, today, args.force);
            const reasons = decision.problems.map((p) => p.message).join("; ");
            if (!decision.approve) {
              failed += 1;
              const hint = decision.problems.some((p) => !p.blocking) && !args.force ? " (usa --forzar si ya lo revisaste)" : "";
              console.error(`No se aprobó ${shortId(target.id)} «${target.title}»: ${reasons}${hint}`);
              continue;
            }
            const now = new Date().toISOString();
            await store.setStatus(target.id, { status: "publicada", needsReview: false, publishedAt: now, lastVerifiedAt: now });
            console.log(`Publicada ${shortId(target.id)} «${target.title}»${reasons ? ` (forzada: ${reasons})` : ""} → /practicas/${target.slug}`);
          } catch (error) {
            failed += 1;
            console.error(error instanceof Error ? error.message : String(error));
          }
        }
        if (failed === 0) console.log("El sitio las muestra en menos de un minuto (caché corta).");
        return failed > 0 ? 1 : 0;
      }

      case "aprobar-lote": {
        if (args.targets.length > 0) {
          throw new UsageError("aprobar-lote no recibe ids: usa filtros (--fuente, --empresa, --municipio, --tipo, --titulo…)");
        }
        if (!hasBatchFilter(args.batch)) {
          throw new UsageError("Indica al menos un filtro, por ejemplo: npm run admin -- aprobar-lote --fuente jooble --municipio envigado");
        }
        const [all, sourceNames] = await Promise.all([store.listOpportunities(), store.sourceNames()]);
        const selection = selectBatch(all, args.batch, sourceNames, todayInBogota(), args.force);
        if (!args.confirm) {
          console.log(formatBatchSelection(selection, false));
          return 0;
        }
        let failed = 0;
        for (const target of selection.approve) {
          try {
            const now = new Date().toISOString();
            await store.setStatus(target.id, { status: "publicada", needsReview: false, publishedAt: now, lastVerifiedAt: now });
          } catch (error) {
            failed += 1;
            console.error(`No se pudo publicar ${shortId(target.id)}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        console.log(formatBatchSelection(selection, true));
        console.log(
          failed === 0
            ? `\nListo: ${selection.approve.length} publicadas. El sitio las muestra en menos de un minuto (caché corta).`
            : `\n${selection.approve.length - failed} publicadas y ${failed} con error (ver arriba).`,
        );
        return failed > 0 ? 1 : 0;
      }

      case "retirar": {
        needTargets(args.targets, "retirar");
        const all = await store.listOpportunities();
        let failed = 0;
        for (const key of args.targets) {
          try {
            const target = resolveTarget(key, all);
            await store.setStatus(target.id, { status: "retirada", needsReview: false });
            console.log(`Retirada ${shortId(target.id)} «${target.title}»`);
          } catch (error) {
            failed += 1;
            console.error(error instanceof Error ? error.message : String(error));
          }
        }
        return failed > 0 ? 1 : 0;
      }

      case "vencer": {
        const all = await store.listOpportunities();
        const ids = expireOpportunities(all, todayInBogota());
        for (const id of ids) {
          await store.setStatus(id, { status: "vencida" });
          console.log(`Vencida ${shortId(id)} «${all.find((o) => o.id === id)?.title ?? ""}»`);
        }
        console.log(`Pasaron a vencida: ${ids.length}`);
        return 0;
      }

      case "desaparecidas": {
        const days = args.days ?? DEFAULT_MISSING_DAYS;
        const { lastRunBySource, decisions } = findMissingFromAggregators(await store.listOpportunities(), { maxDays: days });
        if (lastRunBySource.size === 0) {
          console.log("Todavía no hay ofertas de agregadores (Jooble) en la base de datos.");
          return 0;
        }
        for (const [sourceId, at] of lastRunBySource) console.log(`Última vez que ${sourceId} trajo ofertas: ${at}`);
        console.log(`${args.confirm ? "Se cierran" : "Se cerrarían"} (más de ${days} días sin aparecer): ${decisions.length}`);
        let failed = 0;
        for (const { opportunity, newStatus, daysMissing } of decisions) {
          const label = newStatus === "vencida" ? "vencida" : "retirada";
          if (args.confirm) {
            try {
              await store.setStatus(opportunity.id, { status: newStatus, needsReview: false });
            } catch (error) {
              failed += 1;
              console.error(`No se pudo cerrar ${shortId(opportunity.id)}: ${error instanceof Error ? error.message : String(error)}`);
              continue;
            }
          }
          console.log(`  ${shortId(opportunity.id)}  ${opportunity.title} → ${label} (${daysMissing} días sin aparecer)`);
        }
        if (!args.confirm && decisions.length > 0) {
          console.log("\nNo se cambió nada. Si la lista está bien, repite el comando con --confirmar.");
        }
        return failed > 0 ? 1 : 0;
      }

      case "reportes": {
        const [reports, all] = await Promise.all([listIssueReports(client), store.listOpportunities()]);
        console.log(formatReportList(reports, all, args.all));
        return 0;
      }

      case "resolver": {
        if (args.targets.length === 0) {
          throw new UsageError("Indica al menos un id de reporte: npm run admin -- resolver <id-reporte>");
        }
        const reports = await listIssueReports(client);
        let failed = 0;
        for (const key of args.targets) {
          try {
            const report = resolveReportId(key, reports);
            if (report.resolved) {
              console.log(`El reporte ${shortId(report.id)} ya estaba resuelto`);
              continue;
            }
            await markReportResolved(client, report.id);
            report.resolved = true;
            console.log(`Resuelto el reporte ${shortId(report.id)}`);
          } catch (error) {
            failed += 1;
            console.error(error instanceof Error ? error.message : String(error));
          }
        }
        return failed > 0 ? 1 : 0;
      }

      case "empresas": {
        console.log(formatOrganizationList(await listOrganizations(client), readBrandfetchClientId()));
        return 0;
      }

      case "empresa": {
        if (args.targets.length !== 1) {
          throw new UsageError(
            'Indica una sola empresa, entre comillas si tiene espacios: npm run admin -- empresa "<nombre>" --sitio <dominio>',
          );
        }
        let patch;
        try {
          patch = organizationPatch({ site: args.site, logo: args.logo, noLogo: args.noLogo });
        } catch (error) {
          throw new UsageError(error instanceof Error ? error.message : String(error));
        }
        const organization = resolveOrganization(args.targets[0], await listOrganizations(client));
        await updateOrganization(client, organization.id, patch);
        const updated = applyOrganizationPatch(organization, patch);
        console.log(
          `«${updated.name}»: sitio ${updated.website ?? "—"} · logo propio ${updated.logoUrl ?? "—"} · ¿tendrá logo? ${logoStatus(updated, readBrandfetchClientId())}`,
        );
        return 0;
      }

      default:
        console.error(`Comando desconocido: ${args.command}\n\n${USAGE}`);
        return 2;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof UsageError ? 2 : 1;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  },
);
