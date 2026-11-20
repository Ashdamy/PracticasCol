/**
 * CLI de ingesta.
 *   npm run ingest -- --xlsx <ruta> [--dry-run] [--json] [--auto-publish]
 *   npm run ingest -- --csv <ruta> …      (alternativa en CSV)
 *   npm run ingest -- --archivo <ruta> …  (elige por la extensión: .xlsx o .csv)
 *   npm run ingest -- --ats [--dry-run] [--json]        (todas las fuentes de ingestion/sources/ats.ts; usa la red)
 *   npm run ingest -- --ats=<id> [--dry-run] [--json]   (una sola fuente ATS)
 *   npm run ingest -- --jooble --dry-run [--max-consultas=N] [--json]  (solo prueba: Jooble no permite guardar sus ofertas)
 *   … --store=supabase                                  (guarda en Supabase; lee la configuración de .env.local)
 *
 * Por defecto (`--store=memoria`) trabaja contra un store en memoria sembrado con los datos de prueba, para
 * que la deduplicación tenga contra qué comparar: sirve para validar un archivo o una fuente y no escribe en
 * ninguna base de datos. Solo escribe en Supabase con `--store=supabase` y SIN `--dry-run`
 * (con `--dry-run` lee de Supabase para deduplicar contra lo real, pero no guarda nada).
 */
import { extname, resolve } from "node:path";
import { getMunicipality } from "@/lib/catalog/geo";
import { MODALITY_LABELS, STATUS_LABELS } from "@/lib/catalog/labels";
import { MOCK_OPPORTUNITIES, MOCK_ORGANIZATIONS } from "@/lib/mocks/data";
import { createCsvAdapter } from "./adapters/csv";
import { createJoobleAdapter, createJoobleTransport, DEFAULT_MAX_REQUESTS, JOOBLE_DAILY_LIMIT } from "./adapters/jooble";
import { createXlsxAdapter } from "./adapters/xlsx";
import { createPoliteFetcher } from "./http";
import { runIngestion, type IngestionItemResult, type IngestionRun } from "./pipeline";
import { ATS_SOURCES, createAtsAdapter, findAtsSource } from "./sources/ats";
import { createMemoryStore, type IngestionStore } from "./store";
import { loadLocalEnv, openSupabaseStore } from "./local-env";
import type { SupabaseStore } from "./stores/supabase";
import type { IngestionLogger, IngestionReport, SourceAdapter } from "./types";

type FileKind = "csv" | "xlsx";
type StoreKind = "memoria" | "supabase";

interface CliArgs {
  /** Archivo a cargar y cómo leerlo (`null` si no se indicó ninguno). */
  file: { path: string; kind: FileKind } | null;
  /** `"todas"`, el id de una fuente ATS o `null` si no se pidió `--ats`. */
  ats: string | null;
  /** `--jooble`: consulta la API de Jooble Colombia. */
  jooble: boolean;
  /** Tope de consultas a Jooble en esta corrida (`null` = el de por defecto). */
  maxRequests: number | null;
  /** Dónde se guarda. Por defecto en memoria (no escribe en ninguna base de datos). */
  store: StoreKind;
  dryRun: boolean;
  json: boolean;
  autoPublish: boolean;
  help: boolean;
}

const ALL_ATS = "todas";

/**
 * Jooble respondió al PO (2026-11-20) que su API es para búsqueda en vivo y NO permite guardar sus ofertas
 * en una base de datos propia. Por eso `--jooble` solo corre en prueba (`--dry-run`, store en memoria).
 */
export const JOOBLE_STORAGE_FORBIDDEN =
  "Jooble no permite guardar sus ofertas en una base de datos propia (respuesta de Jooble, 2026-11-20): " +
  "--jooble solo funciona con --dry-run y sin --store=supabase.";

const USAGE = `Uso: npm run ingest -- --xlsx <ruta> [--store=supabase] [--dry-run] [--json] [--auto-publish]
     npm run ingest -- --ats[=<id>] [--store=supabase] [--dry-run] [--json]
     npm run ingest -- --jooble --dry-run [--max-consultas=N] [--json]

  --xlsx <ruta>     Libro de Excel con convocatorias (plantilla: ingestion/templates/convocatorias.xlsx)
  --csv <ruta>      Archivo CSV con convocatorias (plantilla: ingestion/templates/convocatorias.csv)
  --archivo <ruta>  Cualquiera de los dos: se elige por la extensión (.xlsx o .csv)
  --ats             Consulta todas las fuentes ATS de ingestion/sources/ats.ts (usa la red)
  --ats=<id>        Consulta una sola fuente ATS: ${ATS_SOURCES.map((s) => s.token).join(", ")}
  --jooble          Solo con --dry-run: prueba la API de Jooble Colombia sin guardar nada (Jooble no permite guardar sus ofertas)
  --max-consultas=N Tope de consultas a Jooble en esta corrida (por defecto ${DEFAULT_MAX_REQUESTS}, máximo ${JOOBLE_DAILY_LIMIT})
  --store=supabase  Guarda en Supabase (configuración en .env.local). Por defecto: --store=memoria (no guarda)
  --dry-run         Solo valida y muestra el reporte; no guarda nada
  --json            Imprime el resultado en JSON
  --auto-publish    Publica sin revisión las filas con todos los datos en confianza alta (solo archivos)`;

const FILE_OPTIONS = ["--xlsx", "--csv", "--archivo"] as const;
type FileOption = (typeof FILE_OPTIONS)[number];

function kindFromExtension(path: string): FileKind | null {
  const extension = extname(path).toLowerCase();
  if (extension === ".xlsx") return "xlsx";
  if (extension === ".csv") return "csv";
  return null;
}

function resolveFile(option: FileOption, path: string | undefined): NonNullable<CliArgs["file"]> {
  if (!path || path.startsWith("--")) throw new Error(`Falta la ruta del archivo después de ${option}`);
  const byExtension = kindFromExtension(path);
  if (option === "--archivo") {
    if (!byExtension) throw new Error(`No se reconoce la extensión de «${path}»: usa un archivo .xlsx o .csv`);
    return { path, kind: byExtension };
  }
  const kind: FileKind = option === "--xlsx" ? "xlsx" : "csv";
  if (byExtension && byExtension !== kind) {
    throw new Error(`«${path}» es un archivo .${byExtension}: usa --${byExtension} o --archivo en lugar de ${option}`);
  }
  return { path, kind };
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    file: null,
    ats: null,
    jooble: false,
    maxRequests: null,
    store: "memoria",
    dryRun: false,
    json: false,
    autoPublish: false,
    help: false,
  };
  const setFile = (option: FileOption, path: string | undefined) => {
    if (args.file) throw new Error("Indica un solo archivo (--xlsx, --csv o --archivo)");
    args.file = resolveFile(option, path);
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const option = FILE_OPTIONS.find((o) => arg === o || arg.startsWith(`${o}=`));
    if (option && arg === option) {
      setFile(option, argv[i + 1]);
      i += 1;
    } else if (option) setFile(option, arg.slice(option.length + 1));
    else if (arg === "--ats") args.ats = ALL_ATS;
    else if (arg.startsWith("--ats=")) {
      const id = arg.slice("--ats=".length).trim();
      if (!id) throw new Error("Falta el id de la fuente después de --ats=");
      args.ats = id;
    } else if (arg === "--jooble") args.jooble = true;
    else if (arg.startsWith("--max-consultas=")) {
      const value = Number(arg.slice("--max-consultas=".length));
      if (!Number.isInteger(value) || value < 1 || value > JOOBLE_DAILY_LIMIT) {
        throw new Error(`--max-consultas debe ser un número entero entre 1 y ${JOOBLE_DAILY_LIMIT}`);
      }
      args.maxRequests = value;
    } else if (arg.startsWith("--store=")) {
      const store = arg.slice("--store=".length).trim().toLowerCase();
      if (store === "supabase") args.store = "supabase";
      else if (store === "memoria" || store === "memory") args.store = "memoria";
      else throw new Error(`Store desconocido «${store}»: usa --store=memoria o --store=supabase`);
    } else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--auto-publish") args.autoPublish = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Opción desconocida: ${arg}`);
  }
  const sourcesChosen = [args.file !== null, args.ats !== null, args.jooble].filter(Boolean).length;
  if (sourcesChosen > 1) throw new Error("Usa una sola fuente a la vez: un archivo, --ats o --jooble");
  if ((args.ats || args.jooble) && args.autoPublish) {
    throw new Error("--auto-publish solo aplica a archivos: las fuentes automáticas siempre quedan en revisión");
  }
  if (args.maxRequests !== null && !args.jooble) throw new Error("--max-consultas solo aplica a --jooble");
  if (args.jooble && (!args.dryRun || args.store !== "memoria")) {
    throw new Error(JOOBLE_STORAGE_FORBIDDEN);
  }
  return args;
}

/** Adaptadores de las fuentes ATS pedidas. Ninguna tiene `autoPublish`. */
function atsAdapters(selection: string): SourceAdapter[] {
  if (selection === ALL_ATS) return ATS_SOURCES.map(createAtsAdapter);
  const source = findAtsSource(selection);
  if (!source) {
    throw new Error(`No hay una fuente ATS «${selection}». Disponibles: ${ATS_SOURCES.map((s) => s.token).join(", ")}`);
  }
  return [createAtsAdapter(source)];
}

const REPORT_ROWS: [label: string, value: (r: IngestionReport) => number][] = [
  ["Leídas (filas u ofertas)", (r) => r.fetched],
  ["Sin cambios", (r) => r.unchanged],
  ["Nuevas", (r) => r.created],
  ["Actualizadas", (r) => r.updated],
  ["Duplicados exactos (se sumó la fuente)", (r) => r.duplicates],
  ["Duplicados probables (a revisión)", (r) => r.probableDuplicates],
  ["Quedan en revisión", (r) => r.needsReview],
  ["Ya vencidas (no se crean)", (r) => r.expired],
  ["Errores", (r) => r.errors.length],
];

/** "Medellín · Híbrida" (o "sin municipio · Remota"). Vacío si el ítem no llegó a normalizarse. */
function describePlace(item: IngestionItemResult): string {
  if (!item.modality) return "";
  const municipality = getMunicipality(item.municipalitySlug)?.name ?? "sin municipio";
  return ` (${municipality} · ${MODALITY_LABELS[item.modality]})`;
}

function describeItem(item: IngestionItemResult): string {
  // En las cargas manuales el identificador es el número de fila; en las demás fuentes, la URL de la oferta.
  const manual = item.sourceId.startsWith("src-manual");
  const row = manual && item.externalId ? `Fila ${item.externalId}` : item.url;
  const status = item.status ? STATUS_LABELS[item.status] : "—";
  const place = manual ? "" : describePlace(item);
  const lines = [`• ${row}: ${item.title ?? "(sin título)"}${place} [${status}, confianza ${item.confidence ?? "—"}]`];
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
  let adapters: SourceAdapter[] = [];
  try {
    args = parseArgs(process.argv.slice(2));
    if (args.ats) adapters = atsAdapters(args.ats);
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    return 2;
  }
  if (args.help || (!args.file && !args.ats && !args.jooble)) {
    console.log(USAGE);
    return args.help ? 0 : 2;
  }

  if (args.jooble) {
    loadLocalEnv();
    const apiKey = process.env.JOOBLE_API_KEY?.trim();
    if (!apiKey) {
      console.error("Falta JOOBLE_API_KEY en .env.local (la clave de co.jooble.org, no la de jooble.org).");
      return 2;
    }
    adapters = [
      createJoobleAdapter({
        transport: createJoobleTransport({ apiKey }),
        maxRequests: args.maxRequests ?? DEFAULT_MAX_REQUESTS,
      }),
    ];
  }

  if (args.file) {
    const options = { filePath: resolve(args.file.path), autoPublish: args.autoPublish };
    adapters = [args.file.kind === "xlsx" ? createXlsxAdapter(options) : createCsvAdapter(options)];
  }
  // El progreso va por stderr para no ensuciar la salida de --json.
  const log: IngestionLogger = {
    info: (message) => console.error(message),
    warn: (message) => console.error(`Aviso: ${message}`),
  };
  let store: IngestionStore;
  if (args.store === "supabase") {
    let supabase: SupabaseStore;
    try {
      supabase = openSupabaseStore();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 2;
    }
    // Las fuentes deben existir antes de enlazar convocatorias con ellas (llave foránea).
    if (!args.dryRun) await supabase.ensureSources(adapters);
    store = supabase;
  } else {
    store = createMemoryStore({ opportunities: MOCK_OPPORTUNITIES, organizations: MOCK_ORGANIZATIONS });
  }
  const run = await runIngestion({
    adapters,
    store,
    http: createPoliteFetcher(),
    now: new Date(),
    dryRun: args.dryRun,
    log: args.ats || args.jooble ? log : undefined,
  });

  if (args.json) console.log(JSON.stringify(run, null, 2));
  else {
    console.log(formatRun(run));
    if (args.store === "supabase") {
      console.log(
        args.dryRun
          ? "\nSe comparó contra Supabase, pero no se guardó nada (--dry-run)."
          : "\nGuardado en Supabase. Revisa la cola con: npm run admin -- revision",
      );
    } else if (!args.dryRun) {
      console.log("\nNota: el destino fue un store en memoria; no se guardó en ninguna base de datos. Para guardar usa --store=supabase.");
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
