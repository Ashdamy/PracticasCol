# PrácticasCol — Contexto compartido del proyecto

> **Fuente única de verdad** para todos los que trabajan en el repo: el humano (Product Owner), **Claude** (planeación, arquitectura y lógica) y **Codex** (diseño frontend y UI/UX).
> Léelo completo antes de empezar cualquier tarea. Si una decisión cambia, se actualiza **este** archivo y se anota en el [Registro de coordinación](#16-registro-de-coordinación).
>
> Última actualización: 2026-11-13 · Estado: **Fase 0 (fundaciones), sin código aún**

---

## 1. Producto en una frase

**PrácticasCol** reúne en un solo buscador las prácticas profesionales, pasantías, prácticas empresariales y contratos de aprendizaje que hoy están dispersos por internet. Así, un estudiante del Valle de Aburrá encuentra rápido las convocatorias que le sirven, entiende si cumple los requisitos y no deja pasar fechas límite.

### El problema
- Las convocatorias están repartidas entre páginas de empresas, portales de empleo, bolsas de universidades, el SENA, politécnicos, institutos técnicos y entidades públicas.
- Cada sitio tiene su propio buscador y su propio formato, y casi ninguno le dice al estudiante si cumple.
- Se pierden oportunidades porque el estudiante no sabe **dónde** se publican, **cuándo vencen** o **si aplica** para ellas.

### Lo que PrácticasCol **sí** es
- Un **agregador y organizador** de convocatorias, con datos normalizados y verificables.
- Un asistente que responde **"¿Aplico a esta práctica?"** según el perfil académico del estudiante.

### Lo que PrácticasCol **no** es (por ahora)
- **No** recibe postulaciones ni hojas de vida: siempre lleva al **enlace oficial** de la convocatoria.
- **No** es un marketplace donde las empresas publican (puede llegar en una fase posterior, pero el MVP no depende de eso).
- **No** necesita convenios con instituciones para lanzar.

---

## 2. Decisiones tomadas (con el Product Owner)

| # | Decisión | Detalle |
|---|----------|---------|
| D1 | **Público inicial** | Medellín y el Área Metropolitana del Valle de Aburrá, **todos los niveles de formación**: técnico laboral, técnico profesional, tecnólogo (incluido el SENA), universitario y posgrado. |
| D2 | **Fuentes: enfoque mixto** | Pocas fuentes seleccionadas. Prioridad: (1) feeds/APIs oficiales que permitan reutilizar los datos; (2) recolección automática de **páginas públicas**, respetando robots.txt y términos de uso, **sin** entrar a contenido privado ni evadir restricciones; (3) **carga y revisión manual** para lo que no se pueda automatizar, corregir datos y retirar convocatorias vencidas o duplicadas. |
| D3 | **Trazabilidad obligatoria** | Cada oportunidad muestra su **fuente**, su **enlace original** y su **fecha de última verificación**. |
| D4 | **Postulación externa** | El botón principal siempre lleva a la plataforma de origen. |
| D5 | **Contexto** | Proyecto académico con una arquitectura que pueda crecer a startup sin reescribirse. Costos cercanos a cero al inicio (planes gratuitos). |
| D6 | **Alcance MVP (v1)** | (a) Búsqueda + filtros + detalle; (b) Perfil académico + **"¿Aplico?"**. Guardados, recordatorios y alertas quedan para la **v2**. |
| D7 | **Sin cuenta para estudiantes en v1** | El estudiante busca y arma su perfil **sin registrarse**: el perfil se guarda en una cookie sin datos personales. Solo los administradores inician sesión. Esto quita fricción y reduce la exposición frente a la Ley 1581 de 2012. Las cuentas de estudiante llegan en la v2, junto con guardados y alertas. |
| D8 | **Colaboración** | Un solo repositorio. Claude define los **contratos** (tipos y funciones) y la lógica; Codex construye la UI sobre esos contratos. Coordinación a través de este archivo. |
| D9 | **Tiempo** | Sin fecha fija: avanzamos por fases y cada fase termina en algo usable. |

---

## 3. Usuarios y principios de experiencia

### Personas
1. **Valentina, 8.º semestre de Ingeniería Industrial (universidad privada):** busca una práctica profesional remunerada para el próximo semestre. Le importan el apoyo económico, la modalidad y la fecha de cierre.
2. **Andrés, aprendiz SENA (Tecnólogo en Análisis y Desarrollo de Software):** necesita un **contrato de aprendizaje** para su etapa productiva. Le importan cumplir requisitos y la cercanía (municipio).
3. **Camila, técnica profesional (institución universitaria pública):** no sabe qué empresas reciben técnicos. Le importa saber rápido **si aplica**.

### Principios de UX (de obligatorio cumplimiento)
1. **Mobile-first:** la mayoría entra desde un celular Android de gama media y con datos móviles. La app tiene que ser liviana y rápida.
2. **Sin barreras:** se puede buscar sin cuenta y sin llenar el perfil. El perfil es opcional y mejora los resultados.
3. **Claridad antes que cantidad:** cada tarjeta responde de un vistazo *qué es, quién la ofrece, dónde es, cuánto paga, cuándo cierra y si aplico*.
4. **Incertidumbre honesta:** si no hay certeza, no se afirma. Se dice "Revisa este requisito" en lugar de "No cumples".
5. **Confianza:** la fuente, la fecha de verificación y el enlace oficial siempre están visibles. Nunca se pide dinero ni datos sensibles.
6. **Urgencia útil:** las fechas límite cercanas se destacan ("Cierra en 3 días"), sin alarmismo.
7. **Español claro, tono colombiano y cercano** (tuteo), sin jerga de recursos humanos.
8. **Accesibilidad WCAG 2.2 AA:** contraste, foco visible, navegación con teclado y etiquetas para lectores de pantalla.

---

## 4. Alcance por fases

| Fase | Objetivo | Entregables clave |
|------|----------|-------------------|
| **0. Fundaciones** | Repo listo para trabajar en paralelo | Scaffold Next.js, Supabase, esquema de BD, **contratos y mocks** (Claude) · Design system, layout base y tokens (Codex) |
| **1. Catálogo y búsqueda** | Un estudiante encuentra prácticas | Búsqueda, filtros, resultados, detalle, página de fuentes · Panel admin con carga manual · Seed curado de 100–200 convocatorias reales |
| **2. Perfil + "¿Aplico?"** | El estudiante sabe si cumple | Onboarding de perfil (cookie), motor de elegibilidad, filtro "Solo las que aplico", veredicto en tarjetas y detalle |
| **3. Ingesta automática** | El catálogo se actualiza solo | 2–3 adaptadores de fuentes, normalización, deduplicación, cola de revisión, vencimiento automático, verificación de enlaces |
| **4. Piloto Medellín** | Validar con estudiantes reales | Política de privacidad, términos, SEO, analítica básica, botón "Reportar error", pruebas con 10–20 estudiantes |
| **v2** | Retención | Cuentas de estudiante, guardados, recordatorios de cierre, alertas por correo según búsquedas guardadas, más ciudades, publicación directa por instituciones/empresas |

**Fuera del alcance:** gestión de postulaciones, carga de hojas de vida, chat con empresas, pagos.

---

## 5. Dominio (vocabulario común)

### Tipos de oportunidad (`OpportunityType`)
| Valor | Etiqueta en la UI | Nota |
|-------|-------------------|------|
| `practica_profesional` | Práctica profesional | Típica de pregrado universitario |
| `practica_empresarial` | Práctica empresarial | Muchas instituciones la usan casi como sinónimo de la anterior; se respeta el nombre que usa la fuente |
| `pasantia` | Pasantía | |
| `contrato_aprendizaje` | Contrato de aprendizaje | Ley 789 de 2002. Aplica a SENA, técnicos, tecnólogos y universitarios. Paga **apoyo de sostenimiento** |
| `judicatura` | Judicatura | Para estudiantes y egresados de Derecho |

Otras referencias normativas (contexto, por verificar): Ley 2043 de 2020 (las prácticas cuentan como experiencia profesional) y Resolución 3546 de 2018 del MinTrabajo (prácticas laborales).

### Niveles de formación (`EducationLevel`)
`tecnico_laboral` · `tecnico_profesional` · `tecnologo` · `universitario` · `posgrado`

### Modalidad (`Modality`)
`presencial` · `hibrida` · `remota`

### Sector de la organización (`Sector`)
`privado` · `publico` · `mixto` · `ong`

### Compensación (`CompensationType`)
`salario` · `apoyo_sostenimiento` · `auxilio` · `sin_remuneracion` · `no_especificado` (con monto opcional en COP)

### Fecha límite (`DeadlineType`)
`fecha` (hay una fecha concreta) · `hasta_agotar_cupos` · `no_publicada`

### Estado de la oportunidad (`OpportunityStatus`)
`borrador` → `en_revision` → `publicada` → `vencida` | `retirada`
Al público solo se le muestra `publicada`. Una oportunidad `vencida` puede seguir visible en su URL con un aviso (por SEO), pero sale de los resultados.

### Municipios del MVP
Los 10 del Área Metropolitana del Valle de Aburrá: Medellín, Bello, Itagüí, Envigado, Sabaneta, La Estrella, Caldas, Copacabana, Girardota y Barbosa. Más **Rionegro** (Oriente cercano, muy demandado). Las ofertas remotas aparecen sin importar el municipio elegido.

### Instituciones semilla (por confirmar con el catálogo SNIES)
UdeA, Universidad Nacional (sede Medellín), EAFIT, UPB, Universidad de Medellín, CES, EIA, Universidad Cooperativa, Luis Amigó, ITM, Pascual Bravo, Politécnico Colombiano Jaime Isaza Cadavid, Colegio Mayor de Antioquia, Tecnológico de Antioquia, SENA (Regional Antioquia), Uniminuto, CEIPA, ESUMER, UNAULA y San Buenaventura.

**Programas académicos:** se normalizan contra el catálogo de **SNIES** (datos abiertos del MEN) y el catálogo de programas del SENA. Cada programa se asocia a un **Núcleo Básico del Conocimiento (NBC)** para poder interpretar el "y afines" de las convocatorias.

---

## 6. Arquitectura y stack

| Capa | Elección | Motivo |
|------|----------|--------|
| Framework | **Next.js (última estable, App Router) + TypeScript estricto** | SSR/SEO para las páginas de oportunidades, un solo lenguaje y buena compatibilidad con ambos agentes |
| UI | **Tailwind CSS + shadcn/ui** (Radix) + lucide-react | Accesible por defecto y fácil de tematizar (lo maneja Codex) |
| Base de datos | **Supabase (Postgres)** | Plan gratuito, Auth, RLS y búsqueda de texto completo nativa |
| Búsqueda | Postgres FTS (configuración `spanish` + `unaccent`) + `pg_trgm` | Cero servicios extra. Si algún día hace falta, se migra a Meilisearch o Typesense |
| Validación | **Zod** | El mismo esquema valida formularios, la API y la ingesta |
| Auth | Supabase Auth (solo administradores en v1) | Estudiantes sin cuenta (D7) |
| Ingesta y jobs | Scripts TypeScript en `ingestion/`, ejecutados con **GitHub Actions cron** | Gratis y versionado |
| Hosting | **Vercel** (Hobby) | Despliegue con cada push y previews por PR |
| Tests | **Vitest** (lógica) · **Playwright** (e2e de flujos UI) | |
| Calidad | ESLint + Prettier + `tsc --noEmit` en CI | |
| Gestor de paquetes | **pnpm** · Node LTS actual | |
| v2 | Resend (correos de alertas), PostHog (analítica) | |

### Flujo de datos
```
Fuentes externas ──► ingestion/ (adaptadores) ──► raw_items (crudo + hash)
                                                     │ normalizar + deduplicar
                                                     ▼
Admin (carga manual / revisión) ───────────────► opportunities (Postgres)
                                                     │
                     src/server/queries ◄────────────┘
                            │  (contrato tipado)
                            ▼
              src/app (Server Components de Codex) ──► Estudiante
                            ▲
         src/lib/eligibility (motor puro, isomórfico) + perfil en cookie
```

---

## 7. Estructura del repo y **propiedad de carpetas**

> Regla: **cada carpeta tiene un único dueño**. El otro agente puede **leerla y usarla**, pero no **modificarla**. Si necesita un cambio, lo pide en el [Registro de coordinación](#16-registro-de-coordinación).

```
practicascol/
├─ AGENTS.md                 # Este archivo (ambos lo editan, con cuidado)
├─ CLAUDE.md                 # Importa AGENTS.md para Claude
├─ src/
│  ├─ app/                   # [CODEX]  Rutas, layouts y páginas (App Router)
│  │  └─ api/                # [CLAUDE] Route handlers (solo si hacen falta)
│  ├─ components/            # [CODEX]  Componentes de producto
│  │  └─ ui/                 # [CODEX]  Primitivas shadcn/ui
│  ├─ styles/                # [CODEX]  globals.css, tokens
│  ├─ lib/
│  │  ├─ contracts/          # [CLAUDE] ★ CONTRATO: tipos, esquemas Zod y (de)serialización de URL
│  │  ├─ eligibility/        # [CLAUDE] Motor "¿Aplico?" (funciones puras)
│  │  ├─ mocks/              # [CLAUDE] Fixtures realistas que cumplen el contrato
│  │  ├─ catalog/            # [CLAUDE] Municipios, niveles y etiquetas de enums
│  │  └─ format/             # [CODEX]  Presentación: fechas relativas, COP, pluralización
│  └─ server/                # [CLAUDE] db, queries, actions, auth, perfil (cookie)
│     ├─ queries/
│     ├─ actions/
│     └─ db/
├─ ingestion/                # [CLAUDE] Adaptadores, normalizadores, dedupe y jobs
├─ supabase/                 # [CLAUDE] Migraciones, seeds y políticas RLS
├─ e2e/                      # [CODEX]  Tests Playwright de flujos
├─ .github/workflows/        # [CLAUDE] CI y cron de ingesta
└─ tailwind / components.json / config de UI   # [CODEX]
```

Archivos raíz de infraestructura (`package.json`, `tsconfig.json`, `next.config.*`, `.env.example`): los crea **Claude** en la Fase 0. Codex puede **agregar dependencias de UI** a `package.json` y lo anota en el registro.

---

## 8. Responsabilidades

### Product Owner (humano)
- Aprueba decisiones de producto y prioridades. Resuelve los desacuerdos entre agentes.
- Valida las fuentes (que se puedan usar legalmente) y hace o coordina la curaduría manual inicial.
- Consigue estudiantes para las pruebas y la retroalimentación del piloto.
- Ejecuta en su máquina los comandos que requieren credenciales (Supabase, Vercel y GitHub).

### Claude — planeación, arquitectura y lógica
| Área | Responsabilidades |
|------|-------------------|
| Planeación | Mantener este documento, el roadmap, los criterios de aceptación y las decisiones técnicas (anotadas en §16) |
| Contratos | Tipos TS, esquemas Zod, firmas de funciones de servidor y (de)serialización de los filtros en la URL. **Versionados** y con changelog |
| Mocks | Fixtures realistas (organizaciones **ficticias**) e interruptor `USE_MOCKS=true`, para que Codex trabaje sin depender de la base de datos |
| Base de datos | Esquema, migraciones, índices, RLS, seeds (municipios, instituciones, programas y NBC) |
| Búsqueda | Consulta FTS, ranking, facetas, paginación y filtros |
| "¿Aplico?" | Motor de elegibilidad (§10) con pruebas exhaustivas |
| Servidor | Queries, server actions, auth de admin, lectura y escritura del perfil en cookie, "Reportar error" |
| Ingesta | Adaptadores por fuente, normalización (fechas, municipios, niveles, compensación), deduplicación, cola de revisión, vencimiento y verificación de enlaces |
| Calidad | Tests unitarios de lógica, CI, seguridad, privacidad (Ley 1581), cumplimiento de scraping (robots.txt, términos de uso, rate limiting) |
| Admin (lógica) | Acciones de crear, editar, publicar, retirar y fusionar duplicados, y la validación de cada una |

### Codex — diseño frontend y experiencia (UI/UX)
| Área | Responsabilidades |
|------|-------------------|
| Design system | Identidad visual, tokens (color, tipografía, espaciado, radios), tema claro y oscuro, componentes base |
| Páginas | Todas las rutas de `src/app/` (§9), consumiendo **solo** las funciones de `src/server/queries` y `src/server/actions` |
| Componentes | Tarjeta de oportunidad, filtros (panel en escritorio y *drawer* en móvil), chips de filtros activos, paginación, badge "¿Aplico?", desglose de requisitos, indicador de cierre, sello de fuente y verificación |
| Estados | Carga (skeletons), vacío (con sugerencias para ampliar la búsqueda), error, sin resultados y oportunidad vencida |
| Flujos | Onboarding del perfil (≤ 3 pasos, que se pueda saltar), búsqueda → detalle → "Ir a la convocatoria oficial" |
| Microcopy | Textos de la UI en español. Puede reemplazar los mensajes por defecto del motor de elegibilidad usando `code` (§10) |
| Responsive y a11y | Mobile-first, WCAG 2.2 AA, rendimiento (Core Web Vitals en verde con 4G) |
| Admin (UI) | Pantallas funcionales y sobrias: lista, formulario, cola de revisión, fuentes |
| Tests | Playwright para los flujos críticos de UI |
| SEO visual | Metadatos, Open Graph de cada oportunidad y página 404 |

### Compartido
- Definición de flujos de usuario y criterios de aceptación: Claude los redacta y Codex los revisa desde la UX.
- Textos legales (privacidad, términos): Claude redacta el contenido y Codex lo maqueta.

---

## 9. Rutas (mapa del sitio v1)

| Ruta | Propósito | Datos (función del contrato) |
|------|-----------|------------------------------|
| `/` | Inicio: buscador principal, accesos rápidos por tipo y nivel, "cierran pronto" | `getHomeData()` |
| `/practicas` | Resultados con filtros (el estado vive en la URL) | `searchOpportunities(params)` |
| `/practicas/[slug]` | Detalle, "¿Aplico?" y botón al enlace oficial | `getOpportunity(slug)` |
| `/perfil` | Crear o editar el perfil académico (sin cuenta) | `getProfile()`, `saveProfile()`, `clearProfile()` |
| `/fuentes` | Transparencia: de dónde salen los datos y cada cuánto se verifican | `listSources()` |
| `/privacidad`, `/terminos` | Legales | estático |
| `/admin/*` | Panel protegido: oportunidades, nueva o editar, revisión, fuentes, reportes | `admin*` (§11) |

**Parámetros de búsqueda en la URL** (para compartir y volver atrás). Claude implementa `parseSearchParams` y `toSearchParams` en `src/lib/contracts/search.ts`:

```
/practicas?q=analista&tipo=pasantia,contrato_aprendizaje&nivel=tecnologo
          &municipio=medellin,envigado&modalidad=remota&institucion=<id>
          &programa=<id>&remunerada=1&duracion_max=6&cierra_en=15
          &aplico=1&orden=cierre&pagina=2
```

---

## 10. Motor "¿Aplico?" (especificación)

Es una función **pura y determinista**: `evaluateEligibility(opportunity, profile, today)`. Vive en `src/lib/eligibility/` y corre tanto en el servidor como en el cliente.

### Perfil del estudiante (`StudentProfile`, guardado en la cookie `pc_profile`)
`institutionId` · `programId` · `level` · `semester` (1–12 o `null`) · `isGraduate` · `municipality` (opcional) · `preferredModalities` (opcional)

### Criterios
| Criterio | `cumple` | `no_cumple` | `desconocido` |
|----------|----------|-------------|---------------|
| `nivel` | Su nivel está entre los aceptados | Su nivel no está | La oferta no especifica el nivel |
| `programa` | Su programa aparece de forma explícita | Ni su programa ni su NBC aparecen y la oferta **no** dice "y afines" | La oferta dice "afines" y su programa es del mismo NBC → **`verificar`** · o no especifica programas |
| `semestre` | Está dentro del rango | Fuera del rango | Rango no publicado o semestre no indicado en el perfil |
| `institucion` | La oferta está abierta a cualquiera, o su institución aparece | La oferta es exclusiva de otras instituciones | — |
| `fecha_limite` | Todavía está abierta | Ya venció | `hasta_agotar_cupos` o `no_publicada` → `verificar` |
| `otros` | — | — | Requisitos en texto libre (idioma, promedio, etc.) → siempre `verificar` |

### Veredicto (`EligibilityVerdict`)
- `no_cumple`: al menos un criterio en `no_cumple` (solo cuando el dato es **seguro**).
- `cumple`: ningún `no_cumple`, y nivel y programa en `cumple`.
- `revisar`: cualquier otro caso (hay criterios `desconocido` o `verificar`).
- `sin_perfil`: el estudiante no ha creado su perfil.

Cada `EligibilityCheck` trae `criterion`, `status`, `code` (estable, por ejemplo `LEVEL_NOT_ACCEPTED`, para que Codex escriba su propio texto) y `message` (texto por defecto en español, listo para mostrar).
**Regla de oro:** ante la duda se usa `revisar`, nunca `no_cumple`. Debajo del veredicto siempre va el aviso: "Confirma los requisitos en la convocatoria oficial".

---

## 11. Contrato inicial (borrador v0.1)

> El código real vive en `src/lib/contracts/` (Claude). Esto es un resumen para orientar el diseño. **Si hay diferencias, manda el código.**

```ts
// ---- Búsqueda ----
interface SearchParams {
  q?: string;
  types?: OpportunityType[];
  levels?: EducationLevel[];
  municipalities?: string[];        // slugs
  modalities?: Modality[];
  institutionId?: string;
  programId?: string;
  paidOnly?: boolean;
  maxDurationMonths?: number;
  closesWithinDays?: number;
  eligibleOnly?: boolean;           // usa el perfil de la cookie
  sort?: 'relevancia' | 'cierre' | 'recientes';
  page?: number;                    // empieza en 1
  pageSize?: number;                // 20 por defecto, máx. 50
}

interface SearchResult {
  items: OpportunityCard[];
  total: number;
  page: number;
  pageSize: number;
  facets: Record<'types' | 'levels' | 'municipalities' | 'modalities', { value: string; label: string; count: number }[]>;
  appliedProfile: boolean;          // true si se evaluó la elegibilidad
}

interface OpportunityCard {
  id: string;
  slug: string;
  title: string;
  organization: { name: string; logoUrl: string | null; sector: Sector };
  type: OpportunityType;
  levels: EducationLevel[];
  municipality: { slug: string; name: string } | null;
  modality: Modality;
  compensation: { type: CompensationType; amountCop: number | null };
  durationMonths: { min: number; max: number } | null;
  deadline: { type: DeadlineType; date: string | null; daysLeft: number | null }; // date en ISO yyyy-mm-dd
  source: { name: string };
  lastVerifiedAt: string;           // ISO datetime
  isStale: boolean;                 // true si no se verifica hace más de 14 días
  eligibility: { verdict: EligibilityVerdict } | null;
}

interface OpportunityDetail extends OpportunityCard {
  description: string;              // resumen propio, no copia íntegra de la fuente
  requirements: { semesterMin: number | null; semesterMax: number | null; programs: { id: string; name: string }[];
                  acceptsRelatedPrograms: boolean; institutions: { id: string; name: string }[] | null; other: string[] };
  startDate: string | null;
  applyUrl: string;                 // enlace oficial para postularse
  sourceUrl: string;                // página donde se encontró
  status: OpportunityStatus;
  eligibility: EligibilityResult | null;
}

interface EligibilityResult { verdict: EligibilityVerdict; checks: EligibilityCheck[] }
interface EligibilityCheck {
  criterion: 'nivel' | 'programa' | 'semestre' | 'institucion' | 'fecha_limite' | 'otros';
  status: 'cumple' | 'no_cumple' | 'desconocido' | 'verificar';
  code: string;
  message: string;
}

// ---- Respuesta de las server actions ----
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string> } };

// ---- Funciones (src/server/queries | actions) ----
getHomeData(): Promise<{ closingSoon: OpportunityCard[]; recent: OpportunityCard[]; totals: { active: number; sources: number } }>
searchOpportunities(params: SearchParams): Promise<SearchResult>
getOpportunity(slug: string): Promise<OpportunityDetail | null>
getFilterOptions(): Promise<{ institutions: Option[]; programs: (Option & { institutionId: string; level: EducationLevel })[]; municipalities: Option[] }>
getProfile(): Promise<StudentProfile | null>
saveProfile(input: StudentProfile): Promise<ActionResult<StudentProfile>>
clearProfile(): Promise<ActionResult<null>>
reportIssue(input: { opportunityId: string; reason: 'vencida' | 'enlace_roto' | 'datos_incorrectos' | 'sospechosa' | 'otro'; comment?: string }): Promise<ActionResult<null>>
listSources(): Promise<{ name: string; url: string; method: 'api' | 'scraping' | 'manual'; lastRunAt: string | null; activeCount: number }[]>
// admin*: adminListOpportunities, adminUpsertOpportunity, adminSetStatus, adminReviewQueue, adminMergeDuplicates (se definen en la Fase 1)
```

---

## 12. Ingesta de datos (lineamientos para Claude)

- **Registro de fuentes** (tabla `sources`): nombre, URL, método (`api` | `scraping` | `manual`), base legal y términos revisados (sí/no, con fecha), frecuencia, estado.
- **Interfaz de adaptador:** `fetch() → RawItem[]` → `parse(raw) → OpportunityDraft` → normalizar → deduplicar → upsert. Cada adaptador es independiente: si uno falla, los demás siguen.
- **Ética y legalidad:** respetar robots.txt y los términos de uso, limitar la tasa de peticiones (≥ 2 s entre peticiones por dominio), usar un User-Agent genérico del proyecto, **no** iniciar sesión, **no** evadir captchas ni muros de pago, guardar **datos fácticos y un resumen propio** (no copiar descripciones completas) y enlazar siempre al original.
- **Calidad:** lo que llega por automatización con poca confianza va a `en_revision`. Job diario: oportunidades con fecha límite pasada → `vencida`. Job semanal: verificación de enlaces (404 → marcar para revisión).
- **Deduplicación:** hash de (organización + título normalizado + fecha límite) y similitud trigram para los casos dudosos. Si se fusionan duplicados, se conservan todas las fuentes.
- **Fuentes candidatas para Medellín** (por validar con el PO antes de automatizar): Servicio Público de Empleo / Agencia Pública de Empleo del SENA · programa Estado Joven (prácticas en el sector público) · bolsas de empleo y oficinas de prácticas de las instituciones semilla · páginas de carreras de empresas grandes de la región (muchas usan ATS con tableros públicos) · portales privados de empleo **solo con carga manual y enlace**, sin scraping si sus términos lo prohíben.

---

## 13. Modelo de datos (resumen)

`municipalities` · `institutions` · `programs` (→ institution, level, nbc) · `knowledge_areas` (NBC) · `organizations` · `sources` · `raw_items` (payload crudo, hash, source, fetched_at) · `opportunities` (todos los campos de §11, más `status`, `dedupe_hash`, `needs_review`, `first_seen_at`, `last_verified_at`, `search_vector`) · `opportunity_levels` · `opportunity_programs` · `opportunity_knowledge_areas` · `opportunity_institutions` (restricción opcional) · `opportunity_sources` (N:M) · `issue_reports` · `admin_users`.
v2: `student_accounts`, `saved_opportunities`, `saved_searches`, `notifications`.
RLS: lectura pública solo de `publicada`. Escritura solo para el rol admin y el service role (ingesta).

---

## 14. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Términos de uso o legalidad del scraping | Priorizar APIs y fuentes abiertas, revisar los términos de cada fuente antes de automatizarla, carga manual como respaldo, retirar la fuente si su dueño lo pide |
| Datos desactualizados (ofertas vencidas o enlaces rotos) | `last_verified_at` visible, jobs de vencimiento y verificación de enlaces, botón "Reportar error", aviso `isStale` |
| Catálogo pequeño al lanzar (*cold start*) | Curaduría manual de 100–200 convocatorias antes del piloto, enfocada en el Valle de Aburrá |
| "¿Aplico?" equivocado | Regla de oro "ante la duda, `revisar`", explicación por criterio, aviso fijo y tests con casos reales |
| Ofertas falsas o estafas | Solo fuentes verificadas, revisión humana de lo dudoso, motivo de reporte "sospechosa", aviso de que una práctica nunca debe cobrar |
| Privacidad (Ley 1581 de 2012) | v1 sin cuentas de estudiante, cookie sin datos personales, política de privacidad, datos mínimos en v2 |
| Mantenimiento de adaptadores | Adaptadores aislados, alertas cuando una fuente devuelve 0 resultados, pocas fuentes pero buenas |
| Conflictos entre agentes en el repo | Propiedad de carpetas (§7), contratos versionados, registro de coordinación (§16) |

---

## 15. Reglas de colaboración entre agentes

1. **Antes de empezar:** leer este archivo y las entradas recientes del registro (§16).
2. **Respetar la propiedad de carpetas (§7).** Si necesitas algo de la otra parte, **no lo implementes en su carpeta**: agrega una *Solicitud* en el registro.
3. **Contrato primero:** Claude publica o cambia el contrato y sus mocks **antes** de que Codex construya encima. Los cambios que rompen compatibilidad se marcan **⚠ BREAKING** y suben la versión menor (v0.1 → v0.2).
4. **Codex nunca consulta la base de datos directamente** ni importa desde `src/server/db`. Solo usa `src/server/queries` y `src/server/actions`.
5. **Claude no decide estilos ni maquetación.** Si un dato del contrato existe solo para la UI (por ejemplo `daysLeft`), Codex decide cómo mostrarlo.
6. **Código en inglés, textos de UI y documentación en español.** Los valores de enums del dominio van en español `snake_case` (§5).
7. **Ramas y commits:** ramas `claude/<tema>` y `codex/<tema>`. Commits convencionales (`feat(search): …`, `feat(ui): …`, `fix(eligibility): …`). Nada se mezcla a `main` sin que el PO revise.
8. **Definición de terminado:** tipos sin errores, lint limpio, tests de la parte propia en verde, estados vacío/carga/error cubiertos (Codex), casos borde cubiertos (Claude) y entrada en el registro.
9. **Desacuerdos:** se anotan como *Decisión pendiente* en el registro y los resuelve el PO.

---

## 16. Registro de coordinación

> Lo más reciente va arriba. Tipos: **Decisión** · **Solicitud** (para el otro agente) · **Cambio de contrato** · **Entrega** · **Pendiente PO**.
> Formato: `AAAA-MM-DD · Autor · Tipo · Descripción · Estado`

| Fecha | Autor | Tipo | Descripción | Estado |
|-------|-------|------|-------------|--------|
| 2026-11-13 | Claude | Pendiente PO | Confirmar las fuentes candidatas de §12 (cuáles se pueden usar legalmente) y conseguir 100–200 convocatorias para el seed | Abierto |
| 2026-11-13 | Claude | Pendiente PO | Crear las cuentas de Supabase, Vercel y GitHub, e inicializar git (`git init`) | Abierto |
| 2026-11-13 | Claude | Solicitud → Codex | Fase 0: proponer la identidad visual (nombre/logotipo, paleta, tipografía) y los tokens. Diseñar primero la **tarjeta de oportunidad** y la **página de resultados en móvil** usando los mocks | Abierto (esperando scaffold) |
| 2026-11-13 | Claude | Entrega | Fase 0, lado Claude, planificada: scaffold Next.js + Supabase, contrato v0.1 en `src/lib/contracts`, mocks con `USE_MOCKS=true`, esquema inicial de BD | Próximo |
| 2026-11-13 | Claude | Decisión | Se aprueban las decisiones D1–D9 (§2) con el PO. Stack (§6) y propiedad de carpetas (§7) definidos | Cerrado |
