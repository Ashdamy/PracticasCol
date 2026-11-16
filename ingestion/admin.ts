/**
 * CLI de administración (contra Supabase, con la clave secreta de .env.local). Mientras no exista el panel web.
 *   npm run admin -- revision                      lista lo que espera revisión
 *   npm run admin -- ver <id|slug>                 muestra una convocatoria completa
 *   npm run admin -- aprobar <id|slug>... [--forzar]
 *   npm run admin -- retirar <id|slug>...
 *   npm run admin -- vencer                        pasa a «vencida» las publicadas cuya fecha límite ya pasó
 *   npm run admin -- publicadas                    lista lo publicado
 * Nunca imprime claves.
 */
import { todayInBogota } from "@/lib/time";
import { decideApproval, formatDetail, formatListItem, parseAdminArgs, resolveTarget, shortId } from "./admin-rules";
import { expireOpportunities } from "./jobs/expire";
import type { StoredOpportunity } from "./store";
import { openSupabaseStore, type SupabaseStore } from "./stores/supabase";

const USAGE = `Uso: npm run admin -- <comando>

  revision                         Lista las convocatorias en revisión (id corto, título, organización, fuente y observaciones)
  ver <id|slug>                    Muestra todos los datos de una convocatoria
  aprobar <id|slug>... [--forzar]  Publica. Se niega si falta el título, la organización o un enlace https, o si ya cerró.
                                   --forzar salta el título, el https y la fecha; sin organización o sin enlace nunca se publica
  retirar <id|slug>...             Retira (deja de verse en el sitio)
  vencer                           Pasa a «vencida» las publicadas cuya fecha límite ya pasó
  publicadas                       Lista las convocatorias publicadas

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

  let store: SupabaseStore;
  try {
    store = openSupabaseStore();
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
        for (const key of args.targets) console.log(`${formatDetail(resolveTarget(key, all), sourceNames)}\n`);
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
