/**
 * CLI de ingesta manual.
 *   npm run ingest -- --csv <ruta> [--dry-run] [--json] [--auto-publish]
 *
 * Hoy trabaja contra un store en memoria sembrado con los datos de prueba (para que la deduplicación
 * tenga contra qué comparar): sirve para validar un CSV antes de cargarlo. No escribe en ninguna base de datos.
 */
import { resolve } from "node:path";
import { STATUS_LABELS } from "@/lib/catalog/labels";
import { MOCK_OPPORTUNITIES, MOCK_ORGANIZATIONS } from "@/lib/mocks/data";
import { createCsvAdapter } from "./adapters/csv";
import { createPoliteFetcher } from "./http";
import { runIngestion, type IngestionItemResult, type IngestionRun } from "./pipeline";
import { createMemoryStore } from "./store";
import type { IngestionReport } from "./types";

interface CliArgs {
  csv: string | null;
  dryRun: boolean;
  json: boolean;
  autoPublish: boolean;
  help: boolean;
}

const USAGE = `Uso: npm run ingest -- --csv <ruta> [--dry-run] [--json] [--auto-publish]

  --csv <ruta>     Archivo CSV con convocatorias (plantilla: ingestion/templates/convocatorias.csv)
  --dry-run        Solo valida y muestra el reporte; no guarda nada
  --json           Imprime el resultado en JSON
  --auto-publish   Publica sin revisión las filas con todos los datos en confianza alta`;

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { csv: null, dryRun: false, json: false, autoPublish: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--csv") {
      args.csv = argv[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith("--csv=")) args.csv = arg.slice("--csv=".length);
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--auto-publish") args.autoPublish = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Opción desconocida: ${arg}`);
  }
  return args;
}

const REPORT_ROWS: [label: string, value: (r: IngestionReport) => number][] = [
  ["Filas leídas", (r) => r.fetched],
  ["Sin cambios", (r) => r.unchanged],
  ["Nuevas", (r) => r.created],
  ["Actualizadas", (r) => r.updated],
  ["Duplicados exactos (se sumó la fuente)", (r) => r.duplicates],
  ["Duplicados probables (a revisión)", (r) => r.probableDuplicates],
  ["Quedan en revisión", (r) => r.needsReview],
  ["Ya vencidas (no se crean)", (r) => r.expired],
  ["Errores", (r) => r.errors.length],
];

function describeItem(item: IngestionItemResult): string {
  const row = item.externalId ? `Fila ${item.externalId}` : item.url;
  const status = item.status ? STATUS_LABELS[item.status] : "—";
  const lines = [`• ${row}: ${item.title ?? "(sin título)"} [${status}, confianza ${item.confidence ?? "—"}]`];
  for (const issue of item.issues) lines.push(`    - ${issue}`);
  if (item.status === "en_revision" && item.issues.length === 0) {
    lines.push("    - Sin observaciones: queda en revisión porque esta carga no publica automáticamente");
  }
  return lines.join("\n");
}

export function formatRun(run: IngestionRun): string {
  const out: string[] = [];
  out.push(run.dryRun ? "Ingesta en modo de prueba (--dry-run): no se guardó nada." : "Ingesta terminada.");
  for (const report of run.reports) {
    out.push("", `Fuente: ${report.sourceId} (${report.durationMs} ms)`);
    const width = Math.max(...REPORT_ROWS.map(([label]) => label.length));
    for (const [label, value] of REPORT_ROWS) out.push(`  ${label.padEnd(width)}  ${String(value(report)).padStart(4)}`);
    for (const warning of report.warnings) out.push(`  Aviso: ${warning}`);
    for (const error of report.errors) out.push(`  Error en ${error.url}: ${error.message}`);
  }

  const groups: [title: string, items: IngestionItemResult[]][] = [
    ["En revisión (necesitan una persona)", run.items.filter((i) => i.status === "en_revision" && i.outcome !== "duplicado_exacto")],
    ["Publicadas automáticamente", run.items.filter((i) => i.status === "publicada" && i.outcome === "creada")],
    ["Vencidas (no se crearon)", run.items.filter((i) => i.outcome === "vencida")],
    ["Duplicados exactos", run.items.filter((i) => i.outcome === "duplicado_exacto")],
  ];
  for (const [title, items] of groups) {
    if (items.length === 0) continue;
    out.push("", `${title}: ${items.length}`);
    for (const item of items) out.push(describeItem(item));
  }
  return out.join("\n");
}

async function main(): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    return 2;
  }
  if (args.help || !args.csv) {
    console.log(USAGE);
    return args.help ? 0 : 2;
  }

  const adapter = createCsvAdapter({ filePath: resolve(args.csv), autoPublish: args.autoPublish });
  const store = createMemoryStore({ opportunities: MOCK_OPPORTUNITIES, organizations: MOCK_ORGANIZATIONS });
  const run = await runIngestion({
    adapters: [adapter],
    store,
    http: createPoliteFetcher(),
    now: new Date(),
    dryRun: args.dryRun,
  });

  if (args.json) console.log(JSON.stringify(run, null, 2));
  else {
    console.log(formatRun(run));
    if (!args.dryRun) {
      console.log("\nNota: por ahora el destino es un store en memoria (la escritura en Supabase llega en la Fase 1).");
    }
  }
  return run.reports.some((r) => r.errors.length > 0) ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
