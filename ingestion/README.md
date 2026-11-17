# Motor de ingesta de PrácticasCol

Trae convocatorias desde fuentes externas (o desde una plantilla de Excel o CSV llenada a mano), las normaliza al modelo del proyecto, descarta duplicados y deja listo qué se publica y qué necesita revisión humana. Los lineamientos están en `AGENTS.md` §12; este documento explica cómo está hecho y cómo usarlo.

> **Estado: Fase 1.** Hay dos destinos con la misma interfaz (`IngestionStore`): un *store* en memoria (por defecto: valida sin guardar) y **Supabase** (`--store=supabase`). Fuentes: carga manual (Excel y CSV) y conectores de ATS (Greenhouse y Lever). La revisión de lo cargado se hace con el [CLI de administración](#cli-de-administración-npm-run-admin).

## Arquitectura

```
adapter.fetch(ctx) ──► RawItem[] ──► adapter.parse(raw) ──► OpportunityDraft (texto tal como viene)
                                                                   │ normalizeDraft()
                                                                   ▼
                              OpportunityCandidate + issues + confidence + needsReview
                                                                   │ findDuplicate()
                                                                   ▼
                                               IngestionStore (crear, actualizar o sumar fuente)
```

| Archivo | Qué hace |
|---------|----------|
| `types.ts` | `RawItem`, `OpportunityDraft`, `SourceAdapter`, `AdapterContext`, `Confidence`, `Normalized<T>`, `IngestionReport` |
| `normalize/` | Normalizadores **puros**, uno por campo: fechas en español (`dates.ts`), municipio (`geo.ts`), niveles (`levels.ts`), tipo (`type.ts`), modalidad (`modality.ts`), pago en COP (`compensation.ts`), duración (`duration.ts`), semestre y egresados (`semester.ts`), programas y áreas (`programs.ts`), instituciones (`institutions.ts`). `index.ts` los junta en `normalizeDraft()` |
| `dedupe.ts` | `dedupeHash` (sha256 de organización + título normalizado + fecha límite), `trigramSimilarity` y `findDuplicate` |
| `http.ts` | `createPoliteFetcher`: descarga respetuosa (robots.txt, pausa por host, reintento, timeout) |
| `store.ts` | Interfaz `IngestionStore` y `createMemoryStore` |
| `stores/supabase.ts` | `createSupabaseStore`: la misma interfaz sobre Supabase (organizaciones, slugs únicos, relaciones, crudos y corridas) |
| `admin.ts` · `admin-rules.ts` · `admin-reports.ts` | CLI de administración (`npm run admin`), sus reglas puras y los reportes de los estudiantes |
| `pipeline.ts` | `runIngestion`: orquesta todo y devuelve un reporte por fuente |
| `jobs/expire.ts` | `expireOpportunities(records, today)`: qué publicadas deben pasar a `vencida` |
| `adapters/tabular.ts` | Base común de las cargas en tabla: columnas de la plantilla, reconocimiento de encabezados y mapeo fila → borrador |
| `adapters/xlsx.ts` | Adaptador de carga manual desde Excel (`.xlsx`) |
| `adapters/csv.ts` | Adaptador de carga manual desde CSV |
| `templates/convocatorias.xlsx` | Plantilla para el Product Owner (recomendada) |
| `templates/convocatorias.csv` | La misma plantilla en CSV (alternativa) |
| `templates/build-template.ts` | Genera las dos plantillas: `npm run template:xlsx` |
| `templates/LEEME.md` | Guía de llenado para el Product Owner |
| `cli.ts` | `npm run ingest` |

Nada de `ingestion/` se importa desde `src/`: usa `node:fs`, `node:crypto` y `exceljs` (devDependency, solo para la plantilla y el lector de Excel), y la aplicación web no debe empaquetarlos. La dirección contraria sí vale: la ingesta reutiliza el catálogo, los contratos y las utilidades de fecha de `src/lib` y `src/server`.

### Confianza y regla de publicación

Cada normalizador devuelve `Normalized<T>`: el valor, una confianza (`alta`, `media` o `baja`) y, si hizo alguna suposición, una nota para quien revisa. Nunca inventa un dato: si no entiende el texto, devuelve el valor vacío con confianza baja. Con la **modalidad** pasa lo mismo: si la fuente no la dice (celda vacía, «Desconocida», «Por confirmar»…) queda `no_especificada` («Modalidad desconocida») con confianza alta y sin observación, porque es un hecho y no una duda, así que no impide publicar; si trae un texto que no se reconoce, también queda `no_especificada`, pero con una observación. Nunca se asume presencial.

`normalizeDraft(draft, { today, sourceId, autoPublish })` decide el estado:

| Situación | Estado |
|-----------|--------|
| La fecha límite ya pasó | `vencida` |
| La fuente tiene `autoPublish: true`, los campos críticos (título, organización, enlace de postulación `https`, tipo, niveles y fecha límite) salen con confianza **alta** y no hay **ninguna** observación | `publicada` |
| Cualquier otro caso | `en_revision` |

Es decir: lo automático va a revisión por defecto. `autoPublish` se activa solo en fuentes en las que ya se confía, y aun así una sola duda manda el ítem a la cola.

Además: la descripción se recorta a 600 caracteres en límite de palabra (resumen, no copia), los requisitos en texto libre se limpian y se dejan máximo 8 sin repetidos, y el *slug* va sin tildes y con 80 caracteres como máximo.

### Deduplicación

- **Exacto** (mismo hash): si viene de otra fuente, no se crea nada: se agrega la fuente a la oportunidad existente y se actualiza `lastVerifiedAt`. Si viene de la misma fuente, es que el contenido cambió y se actualiza (sin pisar decisiones humanas: lo `publicada` sigue publicado y lo `retirada` sigue retirado; si el cambio trae dudas, queda marcado con `needsReview`).
- **Probable** (misma organización normalizada, títulos con similitud de trigramas ≥ 0,8 y misma fecha límite o alguna sin fecha): se crea en `en_revision` con la nota «Posible duplicado de…», para que una persona decida si se fusionan.

### Reporte

`runIngestion` devuelve, por fuente: `fetched`, `unchanged` (mismo hash de contenido que la corrida anterior), `created`, `updated`, `duplicates`, `probableDuplicates`, `needsReview`, `expired`, `errors`, `warnings` y `durationMs`. También la lista de ítems con su resultado y sus observaciones.

- Cada adaptador y cada ítem corren aislados: si uno falla, queda en `errors` y los demás siguen.
- Una fuente que devuelve 0 ítems deja un aviso (suele indicar que la página cambió).
- Una convocatoria nueva que ya cerró no se crea (cuenta en `expired`).
- Con `dryRun: true` no se escribe nada en el *store*.

## Reglas éticas y legales (AGENTS.md §12)

Aplican a **cualquier** adaptador nuevo. No son opcionales.

1. **Antes de automatizar una fuente**, el Product Owner valida que se pueda usar y se revisan sus términos de uso. Si los términos prohíben la recolección automática, esa fuente solo entra por carga manual con enlace al original.
2. **robots.txt se respeta siempre.** Si no hay robots.txt (404) se asume permitido; si no se puede leer (error de red, 401/403 o 5xx) se asume **no** permitido.
3. **Mínimo 2 segundos entre peticiones al mismo host** (más si el sitio pide `Crawl-delay`). Ante un 429 o 503 se hace un solo reintento, respetando `Retry-After` (máximo 60 s).
4. **Solo páginas públicas y solo GET.** Sin iniciar sesión, sin cookies, sin evadir captchas, muros de pago ni bloqueos. `http.ts` no ofrece forma de hacerlo, a propósito.
5. **User-Agent genérico del proyecto:** `PracticasColBot/0.1`. Solo si existe la variable de entorno `INGESTION_CONTACT_URL` se agrega ` (+<url>)`. No se ponen nombres, correos ni URLs personales en el código.
6. **Se guardan datos fácticos y un resumen propio**, nunca la descripción completa de la fuente, y siempre se enlaza al original (`applyUrl` y `sourceUrl`).
7. **No se recogen datos personales** (nombres de reclutadores, correos, teléfonos).
8. Si el dueño de una fuente pide retirarla, se retira.

Toda descarga pasa por `ctx.http` (el `PoliteFetcher`). Un adaptador **no** debe llamar a `fetch` directamente.

## Cómo escribir un adaptador nuevo

1. Confirma con el PO que la fuente se puede usar (regla 1) y regístrala en la tabla `sources`.
2. Crea `ingestion/adapters/<fuente>.ts` con un objeto `SourceAdapter`:

   ```ts
   import type { OpportunityDraft, RawItem, SourceAdapter } from "../types";

   export const ejemploAdapter: SourceAdapter = {
     id: "src-ejemplo",          // id estable de la fuente
     name: "Portal de ejemplo",
     method: "scraping",          // "api" | "scraping" | "manual"
     // autoPublish: true,        // solo cuando la fuente ya demostró ser confiable

     async fetch(ctx): Promise<RawItem[]> {
       const response = await ctx.http.get("https://example.com/convocatorias.json");
       if (response.status !== 200) throw new Error(`Respuesta ${response.status}`);
       const rows = JSON.parse(response.text) as { id: string; url: string }[];
       return rows.map((row) => ({
         sourceId: "src-ejemplo",
         externalId: row.id,
         url: row.url,
         payload: row,              // crudo: se guarda con su hash para detectar cambios
         fetchedAt: ctx.now.toISOString(),
       }));
     },

     parse(raw): OpportunityDraft {
       // Solo copia textos tal como vienen. No interpretes fechas, montos ni niveles aquí.
       const row = raw.payload as Record<string, string | undefined>;
       return {
         title: row.titulo ?? null,
         organizationName: row.empresa ?? null,
         typeText: row.tipo ?? null,
         levelText: row.nivel ?? null,
         municipalityText: row.ciudad ?? null,
         modalityText: row.modalidad ?? null,
         compensationText: row.pago ?? null,
         durationText: row.duracion ?? null,
         deadlineText: row.cierre ?? null,
         startDateText: null,
         description: row.resumen ?? null,
         programsText: row.carreras ?? null,
         semesterText: null,
         requirementsText: row.requisitos ?? null,
         institutionsText: null,
         applyUrl: row.url ?? null,
         sourceUrl: raw.url,
       };
     },
   };
   ```

3. Reglas del adaptador:
   - `fetch` descarga y parte en ítems; `parse` es pura y solo mapea textos. Interpretar es trabajo de `normalize/`.
   - El `payload` debe ser estable entre corridas (sin marcas de tiempo ni tokens), porque su hash decide si el ítem cambió.
   - Si la fuente falla, lanza un error: el pipeline lo aísla y lo reporta. No devuelvas una lista vacía para ocultar un fallo.
   - Si un normalizador no entiende un formato de esa fuente, mejora el normalizador (con su test), no lo resuelvas dentro del adaptador.
4. Tests en `ingestion/adapters/<fuente>.test.ts` con respuestas guardadas en `__fixtures__/` y un `http` falso. **Ningún test hace peticiones reales** y todos fijan la fecha (`now`/`today`).
5. Agrégalo a la lista de adaptadores de la corrida y deja una entrada en el Registro de coordinación (§16).

## Carga manual con la plantilla (Excel o CSV)

La vía recomendada es **`ingestion/templates/convocatorias.xlsx`**: se abre igual en cualquier computador, mientras que un CSV depende de si el Excel de cada quien separa por coma o por punto y coma. La guía para quien llena la plantilla está en `templates/LEEME.md`.

1. Copia `ingestion/templates/convocatorias.xlsx` y ábrela con doble clic (hoja «Convocatorias»). Borra las dos filas de ejemplo (dicen «EJEMPLO (borrar)» y apuntan a `example.com`). La plantilla trae la fila de encabezados fija, listas desplegables en `tipo`, `nivel`, `municipio` y `modalidad` (ninguna bloquea el texto libre), una nota con ejemplos en cada encabezado y una hoja de «Instrucciones».
2. Una fila por convocatoria. Columnas:

   | Columna | Ejemplo | Notas |
   |---------|---------|-------|
   | `titulo` * | Practicante de Ingeniería Industrial | |
   | `organizacion` * | Empresa Ficticia Uno S.A.S. | |
   | `tipo` | Práctica profesional · Pasantía · Contrato de aprendizaje · Judicatura | Como lo nombra la fuente |
   | `nivel` | Universitario · Tecnólogo · Técnico laboral · Técnico profesional · Posgrado | Se pueden poner varios separados por coma |
   | `municipio` | Medellín · Envigado · Remoto | Fuera del Valle de Aburrá y Rionegro queda como «fuera de cobertura» |
   | `modalidad` | Presencial · Híbrida · Remota · Desconocida | Vacío o «Desconocida» = modalidad desconocida (`no_especificada`); nunca se asume presencial |
   | `pago` | Apoyo de sostenimiento $1.750.000 · No remunerada · A convenir | Monto mensual en pesos |
   | `duracion` | 6 meses · 4 a 6 meses · 1 semestre | |
   | `fecha_limite` | 15/12/2026 · 15 de diciembre de 2026 · Hasta agotar cupos | Vacío = no publicada |
   | `fecha_inicio` | 01/02/2027 | |
   | `descripcion` | Resumen propio de 2 o 3 frases | No copies la descripción completa de la fuente |
   | `programas` | Ingeniería Industrial, Ingeniería de Producción y afines · Cualquier carrera | |
   | `semestre` | A partir de 8° semestre · 6 a 9 semestre · Egresados | |
   | `requisitos` | Excel intermedio; Disponibilidad de tiempo completo | Separados por `;` o por salto de línea |
   | `instituciones` | SENA, ITM | Solo si la convocatoria es exclusiva de ciertas instituciones |
   | `enlace_postulacion` | https://… | Enlace oficial para postularse (debe ser `https`) |
   | `enlace_fuente` | https://… | Página donde se encontró |

   \* Columnas obligatorias. Los encabezados se reconocen sin importar mayúsculas ni tildes («Fecha límite» = `fecha_limite`); las columnas desconocidas y las filas vacías se ignoran.
3. Guarda normal, como libro de Excel **.xlsx**. No hace falta exportar a CSV.

**Cómo se lee el .xlsx** (`adapters/xlsx.ts`): se usa la hoja «Convocatorias» y, si no existe, la primera del libro. El número de fila de Excel es el `externalId`. Cada celda se pasa a texto antes de normalizar: las fechas de Excel salen como `aaaa-mm-dd` (en UTC, para no correr el día), los números sin notación científica, los hipervínculos como su URL en las columnas de enlace y como su texto visible en las demás, el texto con formato como texto plano y las fórmulas por su resultado. Las filas vacías (también las que solo tienen formato o lista desplegable) se ignoran. Para la misma fila, el borrador es idéntico al del CSV.

**Alternativa en CSV:** `ingestion/templates/convocatorias.csv` tiene las mismas columnas y ejemplos, separada por comas y con BOM UTF-8 (abre bien en Google Sheets y en Excel configurado con coma). Al leer, el archivo puede venir con o sin BOM y separado por `,` o por `;` (lo que exporta Excel en español): se detecta solo. Las celdas con comas, punto y coma o saltos de línea deben ir entre comillas dobles (la hoja de cálculo lo hace sola).

Las dos plantillas se generan con `npm run template:xlsx` a partir de `templates/build-template.ts`; no se editan a mano.

## CLI

```
npm run ingest -- --xlsx <ruta> [--store=supabase] [--dry-run] [--json] [--auto-publish]
npm run ingest -- --csv <ruta> [...]
npm run ingest -- --archivo <ruta> [...]
```

| Opción | Efecto |
|--------|--------|
| `--xlsx <ruta>` | Libro de Excel a cargar |
| `--csv <ruta>` | Archivo CSV a cargar |
| `--archivo <ruta>` | Cualquiera de los dos: se elige por la extensión (`.xlsx` o `.csv`) |
| `--store=supabase` | Guarda en Supabase. Sin esta opción (`--store=memoria`) no se guarda en ninguna base de datos |
| `--dry-run` | Solo valida y muestra el reporte; no guarda nada (tampoco con `--store=supabase`) |
| `--json` | Imprime el resultado completo en JSON (para scripts) |
| `--auto-publish` | Trata el archivo como ya revisado: publica las filas sin ninguna observación. Sin esta opción todo queda en revisión |

Ejemplo:

```
npm run ingest -- --xlsx ingestion/templates/convocatorias.xlsx --dry-run
```

Por defecto el CLI trabaja contra un *store* en memoria sembrado con los datos de prueba (`MOCK_OPPORTUNITIES`), para que la deduplicación tenga contra qué comparar. Sirve para **validar un archivo** antes de cargarlo: muestra el reporte y, por cada fila que queda en revisión, las observaciones que hay que corregir (fecha que no se entendió, programa que no está en el catálogo, enlace sin `https`, etc.). No escribe en ninguna base de datos. El código de salida es `1` si hubo errores y `2` si los argumentos son inválidos (por ejemplo, pasar un `.xlsx` a `--csv`).

## Guardar en Supabase (`--store=supabase`)

```
npm run ingest -- --xlsx data/mis-convocatorias.xlsx --store=supabase --dry-run   # compara contra lo real, no guarda
npm run ingest -- --xlsx data/mis-convocatorias.xlsx --store=supabase             # guarda
```

- **Configuración:** lee `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de `.env.local` (con `process.loadEnvFile`; las variables que ya vengan del entorno mandan). La clave secreta omite RLS: no la compartas, no la subas al repo y no la pongas en variables `NEXT_PUBLIC_`. El CLI nunca la imprime. No depende de `USE_MOCKS`.
- **Solo escribe con `--store=supabase` y sin `--dry-run`.** Con `--dry-run` lee de Supabase para deduplicar contra lo que ya existe, pero no guarda nada.
- **Qué guarda** (`stores/supabase.ts`):
  - La **organización** se busca por su nombre normalizado («Empresa X S.A.S.» = «empresa x») y se crea si no existe.
  - El **slug** es único: si choca, se agrega un sufijo (`-2`, `-3`…). Al actualizar se conserva el slug original, para no romper enlaces.
  - Las **relaciones** (programas, áreas, instituciones y fuentes; la primera fuente es la principal).
  - Las **observaciones** de la normalización y la deduplicación en `review_notes`, para la cola de revisión.
  - El **crudo** de cada ítem en `raw_items` (único por fuente + hash: lo que no cambió no se vuelve a procesar) y el **reporte** de la corrida en `ingestion_runs`.
- **Estado:** todo entra `en_revision`, salvo con `--auto-publish` (misma regla de arriba). Nada se ve en el sitio hasta aprobarlo.
- Cada convocatoria se guarda en varias peticiones, no en una transacción: si algo falla a mitad, el ítem sale como error, su crudo no se guarda y la siguiente corrida lo reintenta.

### Esquema y catálogo

Las migraciones están en `supabase/migrations/` y se aplican con `npx supabase db push --remote` (ya aplicadas al proyecto del PO). El catálogo (municipios, NBC, programas, instituciones y fuentes) **se genera** desde `src/lib/catalog` e `ingestion/sources/ats.ts`:

```
npm run db:catalog                                              # regenera supabase/migrations/20261116000000_catalog.sql
npm run db:catalog -- supabase/migrations/<fecha>_catalog_2.sql # si el catálogo cambia después de aplicada la primera
```

Usa `insert … on conflict … do update`, así que una migración nueva del catálogo solo agrega o corrige filas. Una migración ya aplicada no se vuelve a ejecutar: si agregas una fuente ATS o un programa en el código, genera una migración nueva y aplícala. Mientras tanto, la ingesta crea sola la fila de la fuente que falte.

## CLI de administración (`npm run admin`)

Mientras no exista el panel web, lo cargado se revisa desde la terminal (contra Supabase, con la clave secreta de `.env.local`):

| Comando | Qué hace |
|---------|----------|
| `npm run admin -- revision` | Lista lo que espera revisión: id corto, título, organización, fuente y observaciones |
| `npm run admin -- ver <id o slug>` | Muestra todos los datos de una convocatoria |
| `npm run admin -- aprobar <id o slug>... [--forzar]` | Publica: estado `publicada`, fecha de publicación y de verificación = ahora, sin marca de revisión |
| `npm run admin -- retirar <id o slug>...` | Retira: deja de verse en el sitio (también por su URL) |
| `npm run admin -- vencer` | Pasa a `vencida` las publicadas cuya fecha límite ya pasó (`expireOpportunities`) |
| `npm run admin -- publicadas` | Lista lo publicado |
| `npm run admin -- reportes [--todos]` | Lista los reportes de los estudiantes («Reportar error») sin resolver, los más recientes primero. `--todos` incluye los resueltos. Solo lee |
| `npm run admin -- resolver <id-reporte>...` | Marca reportes como resueltos (`resolved = true` y `resolved_at` = ahora) |

- El **id** puede ser el id corto de las listas (primeros 8 caracteres), el id completo o el slug.
- `aprobar` **se niega** si falta el título, la organización o un enlace de postulación `https`, o si la fecha límite ya pasó. `--forzar` salta el título, el `https` y la fecha; sin organización o sin enlace no se publica nunca (la base de datos tampoco lo permite).
- El sitio usa una caché de unos 45 segundos: lo aprobado o retirado se refleja en menos de un minuto.
- Código de salida: `0` bien, `1` si alguna convocatoria no se pudo procesar, `2` si faltan argumentos o configuración.

Flujo típico:

```
npm run ingest -- --xlsx data/mis-convocatorias.xlsx --store=supabase
npm run admin -- revision
npm run admin -- ver 0ecf4a19
npm run admin -- aprobar 0ecf4a19 122e3125
```

### Reportes de los estudiantes

El botón «Reportar error» del sitio guarda cada reporte en `issue_reports`. `npm run admin -- reportes` los muestra así:

```
Reportes sin resolver: 1
3f2a9c1d  2026-11-17 09:42  El enlace no funciona
          Convocatoria: 0ecf4a19 «Practicante de datos» — Empresa Ficticia [Publicada]
          Comentario: Al dar clic sale un error 404.
          Sugerencia: Si confirmas que el enlace no funciona, retírala: npm run admin -- retirar 0ecf4a19

Cuando atiendas uno, ciérralo con: npm run admin -- resolver <id-reporte>
```

- Cada reporte trae su id corto, la fecha y hora en Colombia, el motivo, la convocatoria (id corto, título, organización y estado) y el comentario en una línea, recortado a 200 caracteres.
- **Sugerencia según el motivo:** para «Ya cerró» y «El enlace no funciona» deja listo el comando para retirarla; para «Parece sospechosa o fraudulenta» pide revisarla con prioridad y deja el mismo comando. Los demás motivos se revisan a mano (`ver <id>`). El CLI **nunca** retira nada por su cuenta.
- `resolver` acepta el id corto o el completo del reporte; avisa si no existe, si coincide con varios o si ya estaba resuelto. Resolver un reporte no cambia la convocatoria.
- `resolved_at` viene de la migración `20261117000200_reportes_resueltos.sql`.

## Conectores de ATS (Greenhouse y Lever)

Algunas empresas publican sus vacantes en sistemas de selección (ATS) con API pública, pensada para mostrar ofertas en otros sitios. Hay conectores para dos:

| ATS | URL | `robots.txt` |
|-----|-----|--------------|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | Solo prohíbe `/embed/` |
| Lever | `api.lever.co/v0/postings/{empresa}?mode=json` | Permite todo (`Crawl-delay: 1`) |

- **Código:** `adapters/ats/greenhouse.ts`, `adapters/ats/lever.ts` y lo común en `adapters/ats/common.ts`. Siempre usan `ctx.http` (robots.txt, ≥ 2 s por host y User-Agent genérico).
- **Filtro:** solo ofertas en Colombia (país, municipio del catálogo o "Remote - Colombia") y, si `onlyInternships`, solo títulos de práctica en español o inglés (practicante, pasantía, aprendiz, intern, trainee…).
- **Qué se guarda:** título, ubicación, modalidad, salario si existe, enlaces y un **extracto de máximo 300 caracteres**. Nunca la descripción completa (§12) ni datos de personas: los nombres de reclutadores o *hiring managers*, los correos y los teléfonos se descartan (Ley 1581).
- **Publicación:** ninguna fuente ATS publica sola; todo entra `en_revision`. Como estos ATS no publican fecha de cierre, la verificación de enlaces (Fase 3) es la que detecta las ofertas retiradas.

### Agregar una empresa
1. Confirma con el PO que se puede usar (AGENTS.md §12).
2. Encuentra su token: es la última parte de la URL de su página de empleo (`job-boards.greenhouse.io/{token}` o `jobs.lever.co/{empresa}`).
3. Agrega una línea en `sources/ats.ts`: `source("greenhouse", "token", "Nombre de la empresa")`.
4. Pruébala sola: `npm run ingest -- --ats=token --dry-run`.

### Por qué no SmartRecruiters ni Ashby
- **SmartRecruiters:** su `robots.txt` dice `Disallow: /` para bots genéricos. No se automatiza, aunque la API responda. Así quedan fuera, por ejemplo, Evolution y Avery Dennison; sus ofertas entran a mano o por un agregador aliado.
- **Ashby:** su `robots.txt` responde 401, y `http.ts` lo trata como "no permitido". Queda pendiente de decisión del PO.

Detalle y resultados del sondeo en [`docs/automatizacion-fuentes.md`](../docs/automatizacion-fuentes.md).

### CLI
```
npm run ingest -- --ats --dry-run               # todas las fuentes de sources/ats.ts
npm run ingest -- --ats=powerdigitalmarketing --dry-run
```
Hace peticiones reales a las APIs. El log muestra, por fuente, cuántas ofertas tiene el tablero, cuántas son en Colombia y cuántas prácticas pasan el filtro. Que una fuente devuelva 0 prácticas puede ser normal.

## Job de vencimiento

`expireOpportunities(records, today)` es pura: recibe las oportunidades y la fecha de hoy en Colombia (`todayInBogota()`), y devuelve los ids de las `publicada` cuya fecha límite ya pasó. El día de cierre todavía cuenta como abierto. Quien la llame aplica el cambio de estado: hoy `npm run admin -- vencer`; en la Fase 3, el cron de GitHub Actions.

## Tests

```
npx vitest run ingestion
```

Todos usan una fecha fija y redes falsas; los del *store* de Supabase usan un cliente falso (`src/test/fake-supabase.ts`) y nunca llaman a la base. Desde Windows ejecútalos en PowerShell.
