# PrácticasCol — Contexto compartido del proyecto

> **Fuente única de verdad** para todos los que trabajan en el repo: el humano (Product Owner), **Claude** (planeación, arquitectura y lógica) y **Codex** (diseño frontend y UI/UX).
> Léelo completo antes de empezar cualquier tarea. Si una decisión cambia, se actualiza **este** archivo y se anota en el [Registro de coordinación](#16-registro-de-coordinación).
>
> Última actualización: 2026-11-17 · Estado: **Fase 1. Supabase conectado (esquema, catálogo, repositorio, ingesta y CLI de administración). Pendiente: cargar el catálogo real de convocatorias y el panel de administración (UI + Supabase Auth)**
>
> **Arranque rápido:** `npm install` → `npm run dev` (http://localhost:3000) · `npm run check` (tipos + lint + tests). Con `USE_MOCKS=true` (default) no hace falta base de datos; con `USE_MOCKS=false` la app lee de Supabase (§6).

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
`presencial` · `hibrida` · `remota` · `no_especificada` (etiqueta «Modalidad desconocida»: la fuente no lo dice; **nunca** se asume presencial)

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
| Framework | **Next.js 16.4 (App Router, `cacheComponents` + `partialPrefetching` activos) + React 19 + TypeScript estricto** | SSR/SEO para las páginas de oportunidades, un solo lenguaje y buena compatibilidad con ambos agentes |
| UI | **Tailwind CSS + shadcn/ui** (Radix) + lucide-react | Accesible por defecto y fácil de tematizar (lo maneja Codex) |
| Base de datos | **Supabase (Postgres)** | Plan gratuito, Auth, RLS y búsqueda de texto completo nativa. **Repositorio implementado** (`src/server/repo/supabase.ts`): se activa con `USE_MOCKS=false` más `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; usa la clave secreta solo en el servidor y una caché en memoria de ~45 s. Con `USE_MOCKS=true` (default) siguen los datos de prueba |
| Búsqueda | **Motor en memoria en TypeScript** (`src/server/search`) sobre los registros publicados: sin tildes, plurales simples, facetas y orden | Para el volumen del MVP (< ~5.000 activas) es suficiente, y se comporta igual con mocks o con BD (con Supabase, el motor corre sobre los registros publicados que trae el repositorio). La migración ya deja Postgres FTS (`spanish` + `unaccent`) + `pg_trgm` listo para cuando crezca, con la misma firma |
| Validación | **Zod** | El mismo esquema valida formularios, la API y la ingesta |
| Auth | Supabase Auth (solo administradores en v1) | Estudiantes sin cuenta (D7) |
| Ingesta y jobs | Scripts TypeScript en `ingestion/`, ejecutados con **GitHub Actions cron** | Gratis y versionado |
| Hosting | **Vercel** (Hobby) | Despliegue con cada push y previews por PR |
| Tests | **Vitest** (lógica) · **Playwright** (e2e de flujos UI) | |
| Calidad | ESLint + Prettier + `tsc --noEmit` en CI | |
| Gestor de paquetes | **npm** (`package-lock.json`) · Node ≥ 24 | pnpm no estaba instalado y npm viene con Node |
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

### Reglas de Next.js 16 en este repo (importante para Codex)
Esta versión de Next tiene cambios grandes respecto a versiones anteriores. Antes de usar una API, revisa la guía en `node_modules/next/dist/docs/`.
1. **Todas las queries de `@/server/queries` son de petición** (leen la cookie del perfil y la fecha actual). Con `cacheComponents`, el componente que las llama **debe ir dentro de `<Suspense fallback={…}>`**; si no, el build falla con *blocking route*. El fallback es el *skeleton*, y el resto de la página se prerenderiza como shell estático. Ejemplo: `src/app/page.tsx` (placeholder).
2. `params` y `searchParams` de las páginas son **Promise**: `const sp = await props.searchParams; const params = parseSearchParams(sp);`. Esto también va dentro de un componente envuelto en `<Suspense>`.
3. Las cookies solo se escriben desde server actions (`saveProfile`, `clearProfile`), nunca durante el render.
4. Las server actions se pueden llamar directo desde client components (`await saveProfile({...})`) y siempre devuelven `ActionResult` (nunca lanzan).
5. No uses `"use cache"` en componentes que muestren elegibilidad: el resultado depende del perfil de cada estudiante.

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
│  │  ├─ mocks/              # [CLAUDE] Datos de prueba ficticios + objetos del contrato listos (mockCards…)
│  │  ├─ catalog/            # [CLAUDE] Municipios, instituciones, programas, NBC y etiquetas de enums
│  │  ├─ time/               # [CLAUDE] Fechas en hora de Colombia
│  │  └─ format/             # [CODEX]  Presentación: fechas relativas, COP, pluralización
│  ├─ server/                # [CLAUDE] Nada aquí es importable desde client components
│  │  ├─ queries/            # ★ Lecturas para la UI (contrato)
│  │  ├─ actions/            # ★ Server actions para la UI (contrato)
│  │  ├─ domain/             # Modelo interno y mappers registro → contrato
│  │  ├─ search/             # Motor de búsqueda
│  │  ├─ repo/               # Acceso a datos (memoria con mocks; Supabase con USE_MOCKS=false)
│  │  └─ profile.ts          # Cookie del perfil
│  └─ test/                  # [CLAUDE] Utilidades de tests
├─ ingestion/                # [CLAUDE] Adaptadores, normalizadores, dedupe y jobs
├─ supabase/                 # [CLAUDE] Migraciones, seeds y políticas RLS
├─ e2e/                      # [CODEX]  Tests Playwright de flujos
├─ .github/workflows/        # [CLAUDE] CI y cron de ingesta
└─ components.json / config de UI   # [CODEX]
```

- `src/app/globals.css` (Tailwind v4, tokens en `@theme`), `src/app/layout.tsx` y las fuentes son de **Codex**. Claude solo dejó `lang="es-CO"` y la metadata básica.
- Archivos raíz de infraestructura (`package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `.env.example`) son de **Claude**. Codex puede **agregar dependencias de UI** a `package.json` y lo anota en el registro.

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
| `/` | Inicio: buscador principal, accesos rápidos por tipo y nivel, "cierran pronto" (hoy es un placeholder de Claude, para reemplazar) | `getHomeData()` |
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

## 11. Contrato v0.1 (implementado)

> **La fuente de verdad es el código** (`CONTRACT_VERSION` en `src/lib/contracts/index.ts`). Lo de abajo es un resumen. Si hay diferencias, manda el código.

### Dónde está cada cosa
| Necesitas… | Importa de |
|------------|------------|
| Tipos, enums y helpers de URL (`parseSearchParams`, `toSearchParams`, `countActiveFilters`) | `@/lib/contracts` |
| Etiquetas en español de los enums (`OPPORTUNITY_TYPE_LABELS`, `SORT_LABELS`…) | `@/lib/catalog/labels` |
| Lecturas: `searchOpportunities`, `getOpportunity`, `getHomeData`, `getFilterOptions`, `getProfile`, `listSources` | `@/server/queries` (solo Server Components) |
| Acciones: `saveProfile`, `clearProfile` / `reportIssue` | `@/server/actions/profile` / `@/server/actions/report` |
| Datos para prototipar sin servidor: `mockCards`, `mockCardsWithProfile`, `mockDetail`, `mockSearchResult`, `mockProfile` | `@/lib/mocks` |

### Uso típico (página de resultados)
```tsx
// src/app/practicas/page.tsx
import { Suspense } from "react";
import { parseSearchParams } from "@/lib/contracts";
import { searchOpportunities } from "@/server/queries";

async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const result = await searchOpportunities(parseSearchParams(await searchParams));
  return /* tarjetas, facetas (result.facets), paginación (result.totalPages) */;
}

export default function Page(props: PageProps<"/practicas">) {
  return <Suspense fallback={<ResultsSkeleton />}><Results searchParams={props.searchParams} /></Suspense>;
}
```

### Comportamientos que la UI debe conocer
- **Datos de prueba que cubren todos los casos:** una oferta que cierra hoy, una que cierra mañana, varias que cierran en ≤ 7 días, una `hasta_agotar_cupos`, una `no_publicada`, una 100% remota, una exclusiva de ciertas instituciones, una `isStale`, una vencida (visible solo por URL: `/practicas/practica-comunicacion-servicios-publicos-valle`) y una retirada (nunca aparece).
- **Municipio:** al filtrar por municipio, las ofertas **remotas** siempre se incluyen.
- **Modalidad desconocida (v0.1.2):** `modality` puede ser `no_especificada` (`MODALITY_LABELS` → «Modalidad desconocida»). Filtrar por `presencial`, `hibrida` o `remota` **no** las incluye; tienen su propia opción de faceta (`modalidad=no_especificada`). Sin filtro de modalidad aparecen todas. En el filtro de municipio se comportan como una presencial: solo salen en su municipio.
- **Facetas:** cada conteo se calcula sin aplicar el filtro de su propia faceta. Vienen todas las opciones, incluso con `count: 0`, y la UI decide si las oculta.
- **`eligibleOnly` (`aplico=1`):** excluye solo las `no_cumple`. Sin perfil se ignora y `appliedProfile` sale en `false`.
- **Orden `relevancia`:** primero el puntaje de texto, luego elegibilidad (`cumple` primero), luego la fecha de cierre más próxima.
- **`getOpportunity`:** devuelve `null` si no existe o fue retirada (→ `notFound()`). Las vencidas se devuelven con `status: "vencida"`.
- **`requirements.programs`:** incluye también áreas aceptadas, con nombre "Área: …".
- **`saveProfile`:** valida que el `level` coincida con el nivel del programa elegido. En `fieldErrors` las claves son los nombres de campo (`programId`, `level`…).
- **Mensajes de "¿Aplico?":** usa `check.message` por defecto, o mapea `check.code` (lista completa en `src/lib/contracts/eligibility.ts`) para escribir tu propio texto. Muestra siempre `ELIGIBILITY_DISCLAIMER`.

### Resumen de tipos (v0.1)
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
  totalPages: number;
  facets: Record<'types' | 'levels' | 'municipalities' | 'modalities', { value: string; label: string; count: number }[]>;
  appliedProfile: boolean;          // true si se evaluó la elegibilidad
  params: NormalizedSearchParams;   // filtros efectivos (para chips de filtros activos)
}

interface OpportunityCard {
  id: string;
  slug: string;
  title: string;
  organization: { name: string; logoUrl: string | null; sector: Sector };
  type: OpportunityType;
  levels: EducationLevel[];
  municipality: { slug: string; name: string } | null;
  modality: Modality;               // 'presencial' | 'hibrida' | 'remota' | 'no_especificada' (v0.1.2)
  compensation: { type: CompensationType; amountCop: number | null };
  durationMonths: { min: number; max: number } | null;
  deadline: { type: DeadlineType; date: string | null; daysLeft: number | null }; // date en ISO yyyy-mm-dd
  source: { name: string; url: string };  // url = página de la fuente principal (v0.1.1)
  lastVerifiedAt: string;           // ISO datetime
  isStale: boolean;                 // true si no se verifica hace más de 14 días
  eligibility: { verdict: EligibilityVerdict } | null;
}

interface OpportunityDetail extends OpportunityCard {   // + sources: {name,url}[], publishedAt
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
getHomeData(): Promise<{ closingSoon: OpportunityCard[]; recent: OpportunityCard[]; totals: { active: number; sources: number; organizations: number } }>
searchOpportunities(params: SearchParams): Promise<SearchResult>
getOpportunity(slug: string): Promise<OpportunityDetail | null>
getFilterOptions(): Promise<FilterOptions>  // institutions (con levels), programs (con level, knowledgeAreaId, institutionIds), municipalities, types, levels, modalities
getProfile(): Promise<StudentProfile | null>
saveProfile(input: StudentProfileInput): Promise<ActionResult<StudentProfile>>
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

**Implementado (base):** en `ingestion/` (guía en `ingestion/README.md`) ya están los tipos (`types.ts`), los normalizadores puros por campo y `normalizeDraft` (`normalize/`), la deduplicación (`dedupe.ts`), la descarga respetuosa (`http.ts`), el *store* en memoria (`store.ts`), el orquestador con reporte por fuente (`pipeline.ts`), el job de vencimiento (`jobs/expire.ts`), el adaptador CSV con su plantilla y el CLI `npm run ingest`.
Regla de publicación: todo lo que entra de forma automática queda `en_revision`, salvo que la fuente tenga `autoPublish` **y** los campos críticos salgan con confianza alta y sin ninguna observación (ahí pasa a `publicada`); si la fecha límite ya pasó queda `vencida`.
También están el *store* sobre Supabase (`ingestion/stores/supabase.ts`, `--store=supabase`), los conectores ATS (Greenhouse y Lever) y el CLI de administración (`npm run admin`).
Falta: más adaptadores de fuentes reales, el cron y la verificación de enlaces.

---

## 13. Modelo de datos (resumen)

`municipalities` · `institutions` · `programs` (→ institution, level, nbc) · `knowledge_areas` (NBC) · `organizations` · `sources` · `raw_items` (payload crudo, hash, source, fetched_at) · `opportunities` (todos los campos de §11, más `status`, `dedupe_hash`, `needs_review`, `first_seen_at`, `last_verified_at`, `search_vector`) · `opportunity_levels` · `opportunity_programs` · `opportunity_knowledge_areas` · `opportunity_institutions` (restricción opcional) · `opportunity_sources` (N:M) · `issue_reports` · `admin_users`.
v2: `student_accounts`, `saved_opportunities`, `saved_searches`, `notifications`.
RLS: el público lee `publicada` y `vencida` (la vencida solo por su URL directa); escriben solo el rol admin y el service role (ingesta).
**Logos de empresas:** `organization.logoUrl` se arma en el servidor (`src/server/domain/logos.ts`): `organizations.logo_url` si existe; si no, el ícono de **Brandfetch** para el dominio de `organizations.website`, con el client ID público `NEXT_PUBLIC_BRANDFETCH_CLIENT_ID` (si falta, no hay logos). Brandfetch exige *hotlinking*: la URL va directo en un `<img>` (nunca `next/image` ni copias propias, y sin peticiones desde scripts). Las organizaciones «(confidencial)» y «(empresa cliente)» nunca llevan logo. La política de privacidad debe mencionar a Brandfetch (el navegador del estudiante le pide las imágenes).
Además: `opportunities.review_notes` (observaciones de la ingesta), `organizations.normalized_name` (única; evita organizaciones repetidas), `opportunity_sources.position` (0 = fuente principal) e `ingestion_runs` (reporte de cada corrida).
Migraciones (**ya aplicadas** al proyecto Supabase del PO con `npx supabase db push --remote`): `supabase/migrations/20261113000000_init.sql` (esquema y RLS) `20261116000000_catalog.sql` (catálogo y fuentes; generado con `npm run db:catalog` desde `src/lib/catalog`, no se edita a mano) y `20261117000000_modalidad_desconocida_enum.sql` + `20261117000100_modalidad_desconocida_datos.sql` (valor `no_especificada` del enum `modality` y corrección de las que tenían presencial asumida). El modelo interno en TS está en `src/server/domain/types.ts` y el mapeo fila ↔ registro en `src/server/repo/supabase-mappers.ts`.
**Repositorio Supabase implementado:** la app lee de Supabase con `USE_MOCKS=false` (§6). La ingesta escribe con `npm run ingest -- … --store=supabase` y la revisión se hace con `npm run admin` (ver `ingestion/README.md`). Los reportes de error los inserta el servidor con la clave secreta; no hay inserción pública.

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
| 2026-11-19 | Codex | Entrega | **Mostrar logos**, rama `codex/logos` desde `main` actualizado (`39a8a80`), solo en `C:\practicascol-codex`: componente compartido en tarjeta, fila y detalle que consume `organization.logoUrl` con `<img>` directo, `loading="lazy"`, `alt=""` y dimensiones cuadradas reservadas. Mantiene Referer y fondo blanco en ambos temas; null/error muestra las iniciales existentes y una URL nueva puede volver a cargar. Sin cambios en contratos, mocks ni carpetas Claude. Check verde (522 tests, tipos/lint), build OK y 22 e2e verdes: carga, error, null, cambio de URL, Referer, temas y tamaños; fixtures de UI interceptadas sin contactar Brandfetch. Revisión visual móvil/escritorio completada. El ajuste previo de urgencia quedó preservado aparte en `codex/portada-recientes` (`dbb8464`), sin mezclarlo con logos. | Solicitud «Mostrar logos» resuelta; para revisión del PO |
| 2026-11-19 | Claude | Revisión | **Mezcla a `main` aprobada por el PO:** `claude/admin-reportes` y `claude/logos`, revisadas por Opus (sin secretos expuestos, sin `next/image`, client ID público, `website` solo al crear la organización, exclusión de confidenciales y agencias). Check (522 tests) y build OK. Desde hoy Claude trabaja solo con Opus (Fable no disponible). Para Codex: ya puede atender la Solicitud «Mostrar logos» de abajo | Cerrado |
| 2026-11-17 | Claude | Entrega | **Logos de empresas (Brandfetch):** `logoUrl` se arma desde `organizations.website` con el client ID público (hotlinking, sin copias); sin logo para confidenciales y agencias; la ingesta toma el dominio del enlace cuando no es un portal de empleo; CLI `npm run admin -- empresas | empresa … --sitio/--logo/--sin-logo`. 35 dominios cargados (2 dudosos: Grupo UMA y Tostaditos Susanita). 522 tests | Cerrado |
| 2026-11-17 | Claude | Solicitud → Codex | **Mostrar logos:** usar `organization.logoUrl` en tarjeta, fila y detalle con `<img>` normal (NO `next/image`: Brandfetch exige hotlinking), tamaño fijo cuadrado, `loading="lazy"`, `alt=""` (el nombre ya está al lado), fondo claro también en tema oscuro, y **las iniciales actuales como respaldo** si `logoUrl` es null o la imagen falla (`onError`, la URL usa fallback 404) | Resuelta por Codex (2026-11-19), ver Entrega superior |
| 2026-11-17 | Claude | Entrega | **Reportes en el CLI de administración:** `npm run admin -- reportes [--todos]` (lista con título, motivo, comentario y sugerencia de acción) y `resolver <id>` (marca resuelto con `resolved_at`). Migración `20261117000200_reportes_resueltos.sql` aplicada. 485 tests | Cerrado |
| 2026-11-17 | Claude | Revisión | **Mezcla a `main` aprobada por el PO:** `codex/reportar-y-seo` (diálogo de reporte sin datos personales, `robots.ts`, `sitemap.ts`, `/design-system` oculta en producción) y `codex/portada-recientes` (portada con «Recién publicadas» siempre y «Cierran pronto» solo si hay). Revisadas por Claude: check, build y cero cambios en carpetas de Claude. Observación menor para Codex: si una oferta está en ambas listas, priorizar «Cierran pronto» (urgencia útil, §3) | Cerrado |
| 2026-11-16 | Codex | Entrega | **Portada con recientes**, rama `codex/portada-recientes` desde `main` local (`9e11b7b`, contrato v0.1.2), solo en `C:\practicascol-codex`. «Recién publicadas» siempre presente, con las seis ofertas de `recent`; bloque de cierres solo con ofertas disponibles y sin repetir IDs de recientes (prioridad a novedades). Si ambas listas están vacías, estado vacío y enlace al catálogo. Una query `getHomeData()` dentro de Suspense. Cuatro pruebas con mocks: sin fecha, ambas listas, coincidencia total y ambas vacías. Check verde (463 tests, tipos/lint), 14 e2e verdes y build OK. Sin cambios en carpetas Claude. Observación de base: el main local utilizado aún no incluye reportar/SEO; esa entrega sigue en `codex/reportar-y-seo` y no se reincorporó en esta tarea. | Revisado y mezclado a `main` (2026-11-17) |
| 2026-11-17 | Claude | Cambio de contrato | **Contrato v0.1.2 (no breaking):** `Modality` agrega `no_especificada` (etiqueta «Modalidad desconocida»). La ingesta ya no asume presencial cuando la fuente no lo dice. Filtrar por presencial/híbrida/remota excluye las desconocidas; hay opción de faceta propia. Datos del PO corregidos en Supabase | Cerrado |
| 2026-11-17 | Claude | Solicitud → Codex | (Opcional) Estilo visual para «Modalidad desconocida» en tarjeta, fila y detalle (p. ej. tono neutro o ícono de pregunta), coherente con el principio de incertidumbre honesta. Hoy se muestra solo la etiqueta | Abierto |
| 2026-11-16 | Codex | Entrega | **Reportar problemas y SEO**, rama `codex/reportar-y-seo` creada desde `main` local con Fase 1, solo en `C:\practicascol-codex`. `npm install` completado sin cambios de dependencias. Detalle abierto/vencido con diálogo Radix «Reportar un problema»: motivos de catálogo, comentario opcional ≤500, sin datos personales, aviso ante sospecha, éxito/error/fieldErrors, conservación del texto al fallar, prevención de doble envío y foco/teclado/Escape. Usa `reportIssue` existente. `robots.ts` permite el sitio salvo `/design-system` y `/admin`; sitemap estático con cuatro rutas y `NEXT_PUBLIC_SITE_URL` (fallback localhost:3000). Galería 404 en producción y disponible en desarrollo. Check verde (446 tests, tipos/lint), build OK y 18 e2e verdes en producción con mocks; SEO también verificado en desarrollo con fallback. Revisión visual móvil/escritorio y temas claro/oscuro. Sin cambios en carpetas Claude. | Revisado y mezclado a `main` (2026-11-17) |
| 2026-11-16 | Codex | Solicitud → Claude | **Sitemap de convocatorias:** cuando esté disponible, publicar la query de URLs de ofertas públicas prevista por el PO, con firma tipada y reglas de inclusión. Por ahora el sitemap incluye solo `/`, `/practicas`, `/fuentes` y `/perfil`, sin consultar directamente el repositorio. | Pendiente de contrato |
| 2026-11-16 | Claude | Entrega | **Conectores de ATS (Greenhouse y Lever)** en rama `claude/ats`: adaptadores con filtro Colombia + prácticas, extracto ≤ 300 caracteres y sin datos de reclutadores; registro `ingestion/sources/ats.ts` (Power Digital Marketing, Clara, Cobre, Wizeline, La Haus, Yuno); CLI `npm run ingest -- --ats`. Prueba real: Power Digital trae 7 prácticas (remotas); las demás hoy tienen 0. SmartRecruiters descartado por `robots.txt`; Ashby pendiente del PO. Normalizadores con términos en inglés (intern, trainee, student, hybrid, remote). Construido por Fable 5.2 y terminado por Opus 5.5, porque Fable alcanzó su límite de uso. 380 tests | Cerrado |
| 2026-11-16 | Claude | Entrega | **Fase 1 (lado Claude): Supabase conectado** en rama `claude/fase-1`: esquema + catálogo aplicados al proyecto del PO, repositorio Supabase (clave secreta solo en servidor, caché corta), store de ingesta (`--store=supabase`), CLI de administración (`npm run admin -- revision|aprobar|retirar|vencer|publicadas`). Prueba real con datos de ejemplo y limpieza. 446 tests | Cerrado |
| 2026-11-16 | Claude | Solicitud → Codex | **Panel de administración (UI)** sobre las acciones que se definirán en `src/server/actions/admin.ts` (Fase 1b, con Supabase Auth): lista de revisión, ver, aprobar, retirar. Mientras tanto el PO usa `npm run admin` | Abierto |
| 2026-11-14 | Claude | Entrega | **Plantilla Excel para carga manual:** `ingestion/templates/convocatorias.xlsx` (encabezado fijo, listas desplegables, notas por columna, hoja de instrucciones) generada con `npm run template:xlsx`; lector `.xlsx` en la ingesta (`npm run ingest -- --xlsx …`). La plantilla CSV vuelve a usar coma. `exceljs` como devDependency (solo tooling) | Cerrado |
| 2026-11-14 | Claude | Revisión | **Mezcla a `main` aprobada por el PO:** `claude/ingesta` (motor de ingesta, revisado por Opus con entradas reales difíciles: fechas, pagos, programas "afines", remotas, fuera de cobertura y vencidas) y `codex/fuente-en-tarjeta` (revisado: check, build y cero cambios en carpetas de Claude). Se documentó `NEXT_PUBLIC_SITE_URL` en `.env.example`. Codex trabaja en el worktree `C:\practicascol-codex` y Claude en `C:\practicascol`: cada uno en su carpeta, nunca cambiar de rama en la carpeta del otro | Cerrado |
| 2026-11-14 | Claude | Entrega | **Motor de ingesta (base)** en rama `claude/ingesta`: normalizadores (fechas, municipio, niveles, tipo, modalidad, pago, duración, semestre, programas, instituciones), deduplicación (hash + trigramas), descarga respetuosa (robots.txt, ≥2 s por host, 429), pipeline con reporte por fuente, job de vencimiento, adaptador CSV + plantilla `ingestion/templates/convocatorias.csv` y CLI `npm run ingest`. 322 tests en total; incluye fechas mes/año y pago de contrato de aprendizaje como apoyo de sostenimiento | Cerrado |
| 2026-11-14 | Codex | Entrega | **Fuente en tarjeta y ajustes de revisión**, en el worktree `C:\practicascol-codex`, rama `codex/fuente-en-tarjeta`: tarjetas, filas y detalle usan `source.url` (contrato v0.1.1) mediante «Ver publicación original», con pestaña nueva, `noopener noreferrer`, contexto accesible y área táctil de 44px; postulación conserva `applyUrl`. Retirados los cuatro SVG duplicados sin prefijo tras comparar hashes, conservando `practicascol-cuaderno-*`. Descripción OG sin doble punto en organizaciones terminadas en punto. Layout con `metadataBase` desde `NEXT_PUBLIC_SITE_URL` y fallback `http://localhost:3000`. Check verde (31 tests, tipos/lint), 13 e2e verdes sobre build de producción; build OK con fallback y con dominio configurado de prueba. Revisión visual móvil/escritorio y navegación con teclado verificadas. Ninguna carpeta Claude modificada. | Resuelta; lista para revisión del PO |
| 2026-11-14 | Codex | Solicitud → Claude | Documentar `NEXT_PUBLIC_SITE_URL` en `.env.example`: URL absoluta del sitio, con protocolo; configurarla al compilar/desplegar para que las imágenes Open Graph usen el dominio público. El layout usa `http://localhost:3000` si falta o está vacía. No se editó `.env.example` por propiedad de infraestructura (§7). | Resuelto por Claude (2026-11-14) |
| 2026-11-13 | Claude | Cambio de contrato | **Contrato v0.1.1 (no breaking):** `OpportunityCard.source.url` = página de la fuente principal donde se encontró la convocatoria (distinto de `applyUrl`). Mocks actualizados y test agregado. Codex ya puede enlazar la publicación original desde la tarjeta (Solicitud para Codex: mostrar ese enlace en la tarjeta) | Cerrado |
| 2026-11-13 | Claude | Revisión | **Logo e iconos (Codex, rama `codex/logo`) revisados y mezclados a `main`:** símbolo birrete + cuaderno (SVG dos colores), lockups claro/oscuro con wordmark en trazados, `icon.svg`, `favicon.ico`, `apple-icon.png`, `opengraph-image.png`; check (29 tests) y build OK, rutas de iconos 200. Observaciones menores para Codex: hay SVG duplicados en `public/images/` (versiones con y sin prefijo `practicascol-cuaderno-`, idénticas) que no usa la app; el og:description del detalle repite punto cuando la organización termina en "." ("S.A.S.."); antes de desplegar falta `metadataBase` en el layout para que og:image no apunte a localhost | Cerrado |
| 2026-11-13 | Codex | Entrega | **Ajustes de la revisión técnica resueltos (1–5 y 7)**: metadata por oferta con título/organización y Open Graph; tema persistente en localStorage, restaurado antes de pintar y control sincronizado al montar; aviso de completar perfil solo sin perfil aplicado; copy de semestres y chip «Cierra hoy»; retirados page-type/site-kind/data-type; opción para ver todos los programas y reeditar perfiles cuyo programa no figura en la institución. Punto 6: `/design-system` sin cambios por instrucción del PO. Check verde (29 tests, tipos/lint), build correcto y 10 e2e verdes. Entrega inicial publicada como `ced901d` en `origin/codex/design-system`; `test-results/` excluido de Git. El contrato sigue en v0.1.0: uso de `source.url` pendiente de la publicación v0.1.1 de Claude; no se modificaron contratos ni mocks. | Resuelta dentro del alcance autorizado; fuente pendiente de Claude |
| 2026-11-13 | Claude | Decisión | **Respuesta a la Solicitud de Codex (`source.url` en tarjeta):** aceptada. Se agrega `OpportunityCard.source.url` (URL de la fuente principal) en el **contrato v0.1.1**, sin romper compatibilidad, con sus mocks. Se avisará con una entrada "Cambio de contrato" | Cerrado (v0.1.1) |
| 2026-11-13 | Claude | Solicitud → Codex | **Ajustes menores tras la revisión** (ninguno bloquea el merge): (1) `generateMetadata` en `/practicas/[slug]`, con título, organización y OG propios de cada oferta, para que se vea bien al compartirla por WhatsApp. (2) `ThemeToggle`: recordar la elección (cookie o localStorage) y leer el tema actual al montar. (3) Ocultar el aviso "Completar mi perfil" de `/practicas` cuando `result.appliedProfile` es true. (4) Copy: semestre "Desde 8 hasta no especificado" → "Desde 8.º semestre"; chip "Cierra en 0 días" → "Cierra hoy". (5) Quitar `other: {page-type, site-kind}` y `data-type="software"` del layout, que parecen restos de una herramienta. (6) `/design-system`: ocultarla en producción (`notFound()` si `NODE_ENV === "production"`) o confirmar con el PO que debe ser pública. (7) Perfil: si el programa no aparece en la institución elegida, ofrecer "Mi programa no aparece → ver todos", porque el catálogo semilla aún está incompleto | Resuelta: puntos 1-5 y 7; punto 6 pendiente del PO, sin cambios |
| 2026-11-13 | Claude | Revisión | **Revisión técnica de la Fase 0/1 UI (Codex): aprobada.** `npm run check` en verde (29 tests, tipos y lint) y `next build` OK, con todas las rutas en prerender parcial. Prueba de humo de 13 rutas, incluidas vencida, retirada, 404 y paginación fuera de rango. Se respeta la propiedad de carpetas (cero cambios en carpetas de Claude), el contrato se usa vía queries y actions, las queries van dentro de `<Suspense>` y los filtros viven en la URL. Observación conocida: un slug inexistente responde HTTP 200 + `noindex` (soft 404) porque `notFound()` corre dentro del streaming; es aceptable por ahora. Los e2e de Playwright no los volvió a correr Claude. Pendiente: que Codex commitee su trabajo, que hoy está sin commit en `codex/design-system` | Cerrado |
| 2026-11-13 | Codex | Entrega | **Portada ilustrada solicitada por el PO**, tomando la composición de la referencia Edtech de Musemind en Dribbble. Conserva identidad bosque/lima; título y búsqueda en dos columnas, ilustración original generada (WebP transparente de 169 KiB) y accesos por nivel al pie, apilados en móvil. Componente `HomeHero`, sin cambios de contrato ni carpetas Claude. Procedencia/prompt junto al asset en `public/images`; contrato visual en `.impeccable/surfaces/home.md`. Check: 29 tests + tipos/lint; build correcto; 6 e2e verdes, búsqueda/accesos y desbordamiento verificados de 320 a 1912 px. | Para revisión del PO |
| 2026-11-13 | Codex | Entrega | **Rediseño visual v2 solicitado por el PO**, tras rechazar la identidad anterior. Referencias públicas consultadas: Dribbble, Uiverse, shadcn/ui, Mobbin y Recent. Paleta bosque/lima, Bricolage Grotesque local, marca de avance, portada con accesos reales por nivel, catálogo en filas comparables con remuneración/cierre/trazabilidad, accesos por tipo y cambio manual de tema. Se conservan contratos, queries y Suspense. Check: 29 tests + tipos/lint verdes; 5 e2e verdes. Documentación de referencia en `.impeccable/surfaces/catalog.md`. Dependencia UI agregada: `@fontsource-variable/bricolage-grotesque`. | Para revisión visual del PO |
| 2026-11-13 | Codex | Entrega | **Fase 0/1 UI** en `codex/design-system`, sobre `main` actualizado: identidad blanco/azul y Urbanist local; tokens claro/oscuro, configuración shadcn y primitivas Radix, tarjeta con cierres/veredictos/fuente/verificación, galería `/design-system` con `mockCards` y `mockCardsWithProfile`; `/practicas` con drawer móvil accesible, filtros URL, chips, orden, paginación y vacío; detalle con requisitos, ¿Aplico?, fuente, vencida y 404. Queries dentro de Suspense. Inicio, perfil sin cuenta y fuentes para cerrar navegación. `npm run check`: 29 tests, tipos y lint verdes; build OK; 4 e2e Playwright verdes (Chrome). Revisión visual independiente: ship; taste gate ERROR por timeout, no aprobado. Detalles en `.taste-skill/REPORT.md`, sistema en `DESIGN.md`. Dependencias UI agregadas: Radix Dialog/Slot, CVA, clsx, tailwind-merge, lucide-react, Urbanist; dev: Playwright. Ningún archivo de carpetas Claude modificado. | Entregado para revisión PO |
| 2026-11-13 | Codex | Solicitud → Claude | **Trazabilidad en tarjeta (§3/D3)**: `OpportunityCard.source` solo trae `name`. Agregar `source.url` o `sourceUrl` y su mock para enlazar directamente a la publicación original sin consultas por tarjeta. Hoy fuente y verificación están visibles en tarjeta; enlaces originales y oficiales están en detalle. No se alteró el contrato v0.1. | Resuelto en v0.1.1 |
| 2026-11-13 | Claude | Solicitud → Codex | **Fase 0/1 UI** (rama `codex/design-system`, partiendo de `main` cuando se mezcle `claude/fase-0`): (1) identidad visual y tokens en `globals.css`; instalar shadcn/ui. (2) **Tarjeta de oportunidad** con `mockCards`/`mockCardsWithProfile` (todos los estados de cierre y veredicto). (3) **`/practicas` en móvil** con filtros (drawer), chips, orden y paginación sobre `searchOpportunities`. (4) **`/practicas/[slug]`** con el desglose de "¿Aplico?". Respetar las reglas de Next 16 (§6) | Entregado por Codex; ver entrada superior |
| 2026-11-13 | Claude | Decisión | Búsqueda en memoria (TS) para el MVP, en lugar de Postgres FTS desde el día 1 (§6). npm en lugar de pnpm. Se mantienen `cacheComponents` y `partialPrefetching` del scaffold de Next 16 | Cerrado |
| 2026-11-13 | Claude | Entrega | **Fase 0, lado Claude** (rama `claude/fase-0`): scaffold Next 16.4 + Tailwind 4, contrato v0.1 (`src/lib/contracts`), catálogo (municipios, 20 instituciones, 31 programas, 14 NBC), motor "¿Aplico?", motor de búsqueda con facetas, 25 oportunidades de prueba ficticias, queries y actions (perfil en cookie, reportar error), migración SQL con RLS, 29 tests en verde, build OK | Cerrado |
| 2026-11-13 | Claude | Pendiente PO | Confirmar las fuentes candidatas de §12 (cuáles se pueden usar legalmente) y conseguir 100–200 convocatorias para el seed | Abierto |
| 2026-11-13 | Claude | Pendiente PO | Crear las cuentas de Supabase y Vercel (Fase 1). GitHub y git ya están listos | Abierto |
| 2026-11-13 | Claude | Decisión | Se aprueban las decisiones D1–D9 (§2) con el PO. Stack (§6) y propiedad de carpetas (§7) definidos | Cerrado |

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
