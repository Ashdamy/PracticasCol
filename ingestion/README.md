# Motor de ingesta de PrácticasCol

Trae convocatorias desde fuentes externas (o desde una plantilla de Excel o CSV llenada a mano), las normaliza al modelo del proyecto, descarta duplicados y deja listo qué se publica y qué necesita revisión humana. Los lineamientos están en `AGENTS.md` §12; este documento explica cómo está hecho y cómo usarlo.

> **Estado: base.** Hoy el destino es un *store* en memoria (tests y CLI). La escritura en Supabase llega en la Fase 1 con la misma interfaz (`IngestionStore`). Todavía no hay adaptadores de fuentes reales: solo los de carga manual (Excel y CSV).

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

Cada normalizador devuelve `Normalized<T>`: el valor, una confianza (`alta`, `media` o `baja`) y, si hizo alguna suposición, una nota para quien revisa. Nunca inventa un dato: si no entiende el texto, devuelve el valor vacío con confianza baja.

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
   | `modalidad` | Presencial · Híbrida · Remota | |
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
npm run ingest -- --xlsx <ruta> [--dry-run] [--json] [--auto-publish]
npm run ingest -- --csv <ruta> [...]
npm run ingest -- --archivo <ruta> [...]
```

| Opción | Efecto |
|--------|--------|
| `--xlsx <ruta>` | Libro de Excel a cargar |
| `--csv <ruta>` | Archivo CSV a cargar |
| `--archivo <ruta>` | Cualquiera de los dos: se elige por la extensión (`.xlsx` o `.csv`) |
| `--dry-run` | Solo valida y muestra el reporte; no guarda nada |
| `--json` | Imprime el resultado completo en JSON (para scripts) |
| `--auto-publish` | Trata el archivo como ya revisado: publica las filas sin ninguna observación. Sin esta opción todo queda en revisión |

Ejemplo:

```
npm run ingest -- --xlsx ingestion/templates/convocatorias.xlsx --dry-run
```

El CLI trabaja contra un *store* en memoria sembrado con los datos de prueba (`MOCK_OPPORTUNITIES`), para que la deduplicación tenga contra qué comparar. Sirve para **validar un archivo** antes de cargarlo: muestra el reporte y, por cada fila que queda en revisión, las observaciones que hay que corregir (fecha que no se entendió, programa que no está en el catálogo, enlace sin `https`, etc.). No escribe en ninguna base de datos. El código de salida es `1` si hubo errores y `2` si los argumentos son inválidos (por ejemplo, pasar un `.xlsx` a `--csv`).

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

`expireOpportunities(records, today)` es pura: recibe las oportunidades y la fecha de hoy en Colombia (`todayInBogota()`), y devuelve los ids de las `publicada` cuya fecha límite ya pasó. El día de cierre todavía cuenta como abierto. Quien la llame (el cron de GitHub Actions, en la Fase 3) aplica el cambio de estado.

## Tests

```
npx vitest run ingestion
```

Todos usan una fecha fija y redes falsas. Desde Windows ejecútalos en PowerShell.
