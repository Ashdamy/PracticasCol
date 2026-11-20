# PrÃ¡cticasCol â€” Contexto compartido del proyecto

> **Fuente Ãºnica de verdad** para todos los que trabajan en el repo: el humano (Product Owner), **Claude** (planeaciÃ³n, arquitectura y lÃ³gica) y **Codex** (diseÃ±o frontend y UI/UX).
> LÃ©elo completo antes de empezar cualquier tarea. Si una decisiÃ³n cambia, se actualiza **este** archivo y se anota en el [Registro de coordinaciÃ³n](#16-registro-de-coordinaciÃ³n).
>
> Ãšltima actualizaciÃ³n: 2026-11-17 Â· Estado: **Fase 1. Supabase conectado (esquema, catÃ¡logo, repositorio, ingesta y CLI de administraciÃ³n). Pendiente: cargar el catÃ¡logo real de convocatorias y el panel de administraciÃ³n (UI + Supabase Auth)**
>
> **Arranque rÃ¡pido:** `npm install` â†’ `npm run dev` (http://localhost:3000) Â· `npm run check` (tipos + lint + tests). Con `USE_MOCKS=true` (default) no hace falta base de datos; con `USE_MOCKS=false` la app lee de Supabase (Â§6).

---

## 1. Producto en una frase

**PrÃ¡cticasCol** reÃºne en un solo buscador las prÃ¡cticas profesionales, pasantÃ­as, prÃ¡cticas empresariales y contratos de aprendizaje que hoy estÃ¡n dispersos por internet. AsÃ­, un estudiante del Valle de AburrÃ¡ encuentra rÃ¡pido las convocatorias que le sirven, entiende si cumple los requisitos y no deja pasar fechas lÃ­mite.

### El problema
- Las convocatorias estÃ¡n repartidas entre pÃ¡ginas de empresas, portales de empleo, bolsas de universidades, el SENA, politÃ©cnicos, institutos tÃ©cnicos y entidades pÃºblicas.
- Cada sitio tiene su propio buscador y su propio formato, y casi ninguno le dice al estudiante si cumple.
- Se pierden oportunidades porque el estudiante no sabe **dÃ³nde** se publican, **cuÃ¡ndo vencen** o **si aplica** para ellas.

### Lo que PrÃ¡cticasCol **sÃ­** es
- Un **agregador y organizador** de convocatorias, con datos normalizados y verificables.
- Un asistente que responde **"Â¿Aplico a esta prÃ¡ctica?"** segÃºn el perfil acadÃ©mico del estudiante.

### Lo que PrÃ¡cticasCol **no** es (por ahora)
- **No** recibe postulaciones ni hojas de vida: siempre lleva al **enlace oficial** de la convocatoria.
- **No** es un marketplace donde las empresas publican (puede llegar en una fase posterior, pero el MVP no depende de eso).
- **No** necesita convenios con instituciones para lanzar.

---

## 2. Decisiones tomadas (con el Product Owner)

| # | DecisiÃ³n | Detalle |
|---|----------|---------|
| D1 | **PÃºblico inicial** | MedellÃ­n y el Ãrea Metropolitana del Valle de AburrÃ¡, **todos los niveles de formaciÃ³n**: tÃ©cnico laboral, tÃ©cnico profesional, tecnÃ³logo (incluido el SENA), universitario y posgrado. |
| D2 | **Fuentes: enfoque mixto** | Pocas fuentes seleccionadas. Prioridad: (1) feeds/APIs oficiales que permitan reutilizar los datos; (2) recolecciÃ³n automÃ¡tica de **pÃ¡ginas pÃºblicas**, respetando robots.txt y tÃ©rminos de uso, **sin** entrar a contenido privado ni evadir restricciones; (3) **carga y revisiÃ³n manual** para lo que no se pueda automatizar, corregir datos y retirar convocatorias vencidas o duplicadas. |
| D3 | **Trazabilidad obligatoria** | Cada oportunidad muestra su **fuente**, su **enlace original** y su **fecha de Ãºltima verificaciÃ³n**. |
| D4 | **PostulaciÃ³n externa** | El botÃ³n principal siempre lleva a la plataforma de origen. |
| D5 | **Contexto** | Proyecto acadÃ©mico con una arquitectura que pueda crecer a startup sin reescribirse. Costos cercanos a cero al inicio (planes gratuitos). |
| D6 | **Alcance MVP (v1)** | (a) BÃºsqueda + filtros + detalle; (b) Perfil acadÃ©mico + **"Â¿Aplico?"**. Guardados, recordatorios y alertas quedan para la **v2**. |
| D7 | **Sin cuenta para estudiantes en v1** | El estudiante busca y arma su perfil **sin registrarse**: el perfil se guarda en una cookie sin datos personales. Solo los administradores inician sesiÃ³n. Esto quita fricciÃ³n y reduce la exposiciÃ³n frente a la Ley 1581 de 2012. Las cuentas de estudiante llegan en la v2, junto con guardados y alertas. |
| D8 | **ColaboraciÃ³n** | Un solo repositorio. Claude define los **contratos** (tipos y funciones) y la lÃ³gica; Codex construye la UI sobre esos contratos. CoordinaciÃ³n a travÃ©s de este archivo. |
| D9 | **Tiempo** | Sin fecha fija: avanzamos por fases y cada fase termina en algo usable. |

---

## 3. Usuarios y principios de experiencia

### Personas
1. **Valentina, 8.Âº semestre de IngenierÃ­a Industrial (universidad privada):** busca una prÃ¡ctica profesional remunerada para el prÃ³ximo semestre. Le importan el apoyo econÃ³mico, la modalidad y la fecha de cierre.
2. **AndrÃ©s, aprendiz SENA (TecnÃ³logo en AnÃ¡lisis y Desarrollo de Software):** necesita un **contrato de aprendizaje** para su etapa productiva. Le importan cumplir requisitos y la cercanÃ­a (municipio).
3. **Camila, tÃ©cnica profesional (instituciÃ³n universitaria pÃºblica):** no sabe quÃ© empresas reciben tÃ©cnicos. Le importa saber rÃ¡pido **si aplica**.

### Principios de UX (de obligatorio cumplimiento)
1. **Mobile-first:** la mayorÃ­a entra desde un celular Android de gama media y con datos mÃ³viles. La app tiene que ser liviana y rÃ¡pida.
2. **Sin barreras:** se puede buscar sin cuenta y sin llenar el perfil. El perfil es opcional y mejora los resultados.
3. **Claridad antes que cantidad:** cada tarjeta responde de un vistazo *quÃ© es, quiÃ©n la ofrece, dÃ³nde es, cuÃ¡nto paga, cuÃ¡ndo cierra y si aplico*.
4. **Incertidumbre honesta:** si no hay certeza, no se afirma. Se dice "Revisa este requisito" en lugar de "No cumples".
5. **Confianza:** la fuente, la fecha de verificaciÃ³n y el enlace oficial siempre estÃ¡n visibles. Nunca se pide dinero ni datos sensibles.
6. **Urgencia Ãºtil:** las fechas lÃ­mite cercanas se destacan ("Cierra en 3 dÃ­as"), sin alarmismo.
7. **EspaÃ±ol claro, tono colombiano y cercano** (tuteo), sin jerga de recursos humanos.
8. **Accesibilidad WCAG 2.2 AA:** contraste, foco visible, navegaciÃ³n con teclado y etiquetas para lectores de pantalla.

---

## 4. Alcance por fases

| Fase | Objetivo | Entregables clave |
|------|----------|-------------------|
| **0. Fundaciones** | Repo listo para trabajar en paralelo | Scaffold Next.js, Supabase, esquema de BD, **contratos y mocks** (Claude) Â· Design system, layout base y tokens (Codex) |
| **1. CatÃ¡logo y bÃºsqueda** | Un estudiante encuentra prÃ¡cticas | BÃºsqueda, filtros, resultados, detalle, pÃ¡gina de fuentes Â· Panel admin con carga manual Â· Seed curado de 100â€“200 convocatorias reales |
| **2. Perfil + "Â¿Aplico?"** | El estudiante sabe si cumple | Onboarding de perfil (cookie), motor de elegibilidad, filtro "Solo las que aplico", veredicto en tarjetas y detalle |
| **3. Ingesta automÃ¡tica** | El catÃ¡logo se actualiza solo | 2â€“3 adaptadores de fuentes, normalizaciÃ³n, deduplicaciÃ³n, cola de revisiÃ³n, vencimiento automÃ¡tico, verificaciÃ³n de enlaces |
| **4. Piloto MedellÃ­n** | Validar con estudiantes reales | PolÃ­tica de privacidad, tÃ©rminos, SEO, analÃ­tica bÃ¡sica, botÃ³n "Reportar error", pruebas con 10â€“20 estudiantes |
| **v2** | RetenciÃ³n | Cuentas de estudiante, guardados, recordatorios de cierre, alertas por correo segÃºn bÃºsquedas guardadas, mÃ¡s ciudades, publicaciÃ³n directa por instituciones/empresas |

**Fuera del alcance:** gestiÃ³n de postulaciones, carga de hojas de vida, chat con empresas, pagos.

---

## 5. Dominio (vocabulario comÃºn)

### Tipos de oportunidad (`OpportunityType`)
| Valor | Etiqueta en la UI | Nota |
|-------|-------------------|------|
| `practica_profesional` | PrÃ¡ctica profesional | TÃ­pica de pregrado universitario |
| `practica_empresarial` | PrÃ¡ctica empresarial | Muchas instituciones la usan casi como sinÃ³nimo de la anterior; se respeta el nombre que usa la fuente |
| `pasantia` | PasantÃ­a | |
| `contrato_aprendizaje` | Contrato de aprendizaje | Ley 789 de 2002. Aplica a SENA, tÃ©cnicos, tecnÃ³logos y universitarios. Paga **apoyo de sostenimiento** |
| `judicatura` | Judicatura | Para estudiantes y egresados de Derecho |

Otras referencias normativas (contexto, por verificar): Ley 2043 de 2020 (las prÃ¡cticas cuentan como experiencia profesional) y ResoluciÃ³n 3546 de 2018 del MinTrabajo (prÃ¡cticas laborales).

### Niveles de formaciÃ³n (`EducationLevel`)
`tecnico_laboral` Â· `tecnico_profesional` Â· `tecnologo` Â· `universitario` Â· `posgrado`

### Modalidad (`Modality`)
`presencial` Â· `hibrida` Â· `remota` Â· `no_especificada` (etiqueta Â«Modalidad desconocidaÂ»: la fuente no lo dice; **nunca** se asume presencial)

### Sector de la organizaciÃ³n (`Sector`)
`privado` Â· `publico` Â· `mixto` Â· `ong`

### CompensaciÃ³n (`CompensationType`)
`salario` Â· `apoyo_sostenimiento` Â· `auxilio` Â· `sin_remuneracion` Â· `no_especificado` (con monto opcional en COP)

### Fecha lÃ­mite (`DeadlineType`)
`fecha` (hay una fecha concreta) Â· `hasta_agotar_cupos` Â· `no_publicada`

### Estado de la oportunidad (`OpportunityStatus`)
`borrador` â†’ `en_revision` â†’ `publicada` â†’ `vencida` | `retirada`
Al pÃºblico solo se le muestra `publicada`. Una oportunidad `vencida` puede seguir visible en su URL con un aviso (por SEO), pero sale de los resultados.

### Municipios del MVP
Los 10 del Ãrea Metropolitana del Valle de AburrÃ¡: MedellÃ­n, Bello, ItagÃ¼Ã­, Envigado, Sabaneta, La Estrella, Caldas, Copacabana, Girardota y Barbosa. MÃ¡s **Rionegro** (Oriente cercano, muy demandado). Las ofertas remotas aparecen sin importar el municipio elegido.

### Instituciones semilla (por confirmar con el catÃ¡logo SNIES)
UdeA, Universidad Nacional (sede MedellÃ­n), EAFIT, UPB, Universidad de MedellÃ­n, CES, EIA, Universidad Cooperativa, Luis AmigÃ³, ITM, Pascual Bravo, PolitÃ©cnico Colombiano Jaime Isaza Cadavid, Colegio Mayor de Antioquia, TecnolÃ³gico de Antioquia, SENA (Regional Antioquia), Uniminuto, CEIPA, ESUMER, UNAULA y San Buenaventura.

**Programas acadÃ©micos:** se normalizan contra el catÃ¡logo de **SNIES** (datos abiertos del MEN) y el catÃ¡logo de programas del SENA. Cada programa se asocia a un **NÃºcleo BÃ¡sico del Conocimiento (NBC)** para poder interpretar el "y afines" de las convocatorias.

---

## 6. Arquitectura y stack

| Capa | ElecciÃ³n | Motivo |
|------|----------|--------|
| Framework | **Next.js 16.4 (App Router, `cacheComponents` + `partialPrefetching` activos) + React 19 + TypeScript estricto** | SSR/SEO para las pÃ¡ginas de oportunidades, un solo lenguaje y buena compatibilidad con ambos agentes |
| UI | **Tailwind CSS + shadcn/ui** (Radix) + lucide-react | Accesible por defecto y fÃ¡cil de tematizar (lo maneja Codex) |
| Base de datos | **Supabase (Postgres)** | Plan gratuito, Auth, RLS y bÃºsqueda de texto completo nativa. **Repositorio implementado** (`src/server/repo/supabase.ts`): se activa con `USE_MOCKS=false` mÃ¡s `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; usa la clave secreta solo en el servidor y una cachÃ© en memoria de ~45 s. Con `USE_MOCKS=true` (default) siguen los datos de prueba |
| BÃºsqueda | **Motor en memoria en TypeScript** (`src/server/search`) sobre los registros publicados: sin tildes, plurales simples, facetas y orden | Para el volumen del MVP (< ~5.000 activas) es suficiente, y se comporta igual con mocks o con BD (con Supabase, el motor corre sobre los registros publicados que trae el repositorio). La migraciÃ³n ya deja Postgres FTS (`spanish` + `unaccent`) + `pg_trgm` listo para cuando crezca, con la misma firma |
| ValidaciÃ³n | **Zod** | El mismo esquema valida formularios, la API y la ingesta |
| Auth | Supabase Auth (solo administradores en v1) | Estudiantes sin cuenta (D7) |
| Ingesta y jobs | Scripts TypeScript en `ingestion/`, ejecutados con **GitHub Actions cron** | Gratis y versionado |
| Hosting | **Vercel** (Hobby) | Despliegue con cada push y previews por PR |
| Tests | **Vitest** (lÃ³gica) Â· **Playwright** (e2e de flujos UI) | |
| Calidad | ESLint + Prettier + `tsc --noEmit` en CI | |
| Gestor de paquetes | **npm** (`package-lock.json`) Â· Node â‰¥ 24 | pnpm no estaba instalado y npm viene con Node |
| v2 | Resend (correos de alertas), PostHog (analÃ­tica) | |

### Flujo de datos
```
Fuentes externas â”€â”€â–º ingestion/ (adaptadores) â”€â”€â–º raw_items (crudo + hash)
                                                     â”‚ normalizar + deduplicar
                                                     â–¼
Admin (carga manual / revisiÃ³n) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º opportunities (Postgres)
                                                     â”‚
                     src/server/queries â—„â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â”‚  (contrato tipado)
                            â–¼
              src/app (Server Components de Codex) â”€â”€â–º Estudiante
                            â–²
         src/lib/eligibility (motor puro, isomÃ³rfico) + perfil en cookie
```

### Reglas de Next.js 16 en este repo (importante para Codex)
Esta versiÃ³n de Next tiene cambios grandes respecto a versiones anteriores. Antes de usar una API, revisa la guÃ­a en `node_modules/next/dist/docs/`.
1. **Todas las queries de `@/server/queries` son de peticiÃ³n** (leen la cookie del perfil y la fecha actual). Con `cacheComponents`, el componente que las llama **debe ir dentro de `<Suspense fallback={â€¦}>`**; si no, el build falla con *blocking route*. El fallback es el *skeleton*, y el resto de la pÃ¡gina se prerenderiza como shell estÃ¡tico. Ejemplo: `src/app/page.tsx` (placeholder).
2. `params` y `searchParams` de las pÃ¡ginas son **Promise**: `const sp = await props.searchParams; const params = parseSearchParams(sp);`. Esto tambiÃ©n va dentro de un componente envuelto en `<Suspense>`.
3. Las cookies solo se escriben desde server actions (`saveProfile`, `clearProfile`), nunca durante el render.
4. Las server actions se pueden llamar directo desde client components (`await saveProfile({...})`) y siempre devuelven `ActionResult` (nunca lanzan).
5. No uses `"use cache"` en componentes que muestren elegibilidad: el resultado depende del perfil de cada estudiante.

---

## 7. Estructura del repo y **propiedad de carpetas**

> Regla: **cada carpeta tiene un Ãºnico dueÃ±o**. El otro agente puede **leerla y usarla**, pero no **modificarla**. Si necesita un cambio, lo pide en el [Registro de coordinaciÃ³n](#16-registro-de-coordinaciÃ³n).

```
practicascol/
â”œâ”€ AGENTS.md                 # Este archivo (ambos lo editan, con cuidado)
â”œâ”€ CLAUDE.md                 # Importa AGENTS.md para Claude
â”œâ”€ src/
â”‚  â”œâ”€ app/                   # [CODEX]  Rutas, layouts y pÃ¡ginas (App Router)
â”‚  â”‚  â””â”€ api/                # [CLAUDE] Route handlers (solo si hacen falta)
â”‚  â”œâ”€ components/            # [CODEX]  Componentes de producto
â”‚  â”‚  â””â”€ ui/                 # [CODEX]  Primitivas shadcn/ui
â”‚  â”œâ”€ styles/                # [CODEX]  globals.css, tokens
â”‚  â”œâ”€ lib/
â”‚  â”‚  â”œâ”€ contracts/          # [CLAUDE] â˜… CONTRATO: tipos, esquemas Zod y (de)serializaciÃ³n de URL
â”‚  â”‚  â”œâ”€ eligibility/        # [CLAUDE] Motor "Â¿Aplico?" (funciones puras)
â”‚  â”‚  â”œâ”€ mocks/              # [CLAUDE] Datos de prueba ficticios + objetos del contrato listos (mockCardsâ€¦)
â”‚  â”‚  â”œâ”€ catalog/            # [CLAUDE] Municipios, instituciones, programas, NBC y etiquetas de enums
â”‚  â”‚  â”œâ”€ time/               # [CLAUDE] Fechas en hora de Colombia
â”‚  â”‚  â””â”€ format/             # [CODEX]  PresentaciÃ³n: fechas relativas, COP, pluralizaciÃ³n
â”‚  â”œâ”€ server/                # [CLAUDE] Nada aquÃ­ es importable desde client components
â”‚  â”‚  â”œâ”€ queries/            # â˜… Lecturas para la UI (contrato)
â”‚  â”‚  â”œâ”€ actions/            # â˜… Server actions para la UI (contrato)
â”‚  â”‚  â”œâ”€ domain/             # Modelo interno y mappers registro â†’ contrato
â”‚  â”‚  â”œâ”€ search/             # Motor de bÃºsqueda
â”‚  â”‚  â”œâ”€ repo/               # Acceso a datos (memoria con mocks; Supabase con USE_MOCKS=false)
â”‚  â”‚  â””â”€ profile.ts          # Cookie del perfil
â”‚  â””â”€ test/                  # [CLAUDE] Utilidades de tests
â”œâ”€ ingestion/                # [CLAUDE] Adaptadores, normalizadores, dedupe y jobs
â”œâ”€ supabase/                 # [CLAUDE] Migraciones, seeds y polÃ­ticas RLS
â”œâ”€ e2e/                      # [CODEX]  Tests Playwright de flujos
â”œâ”€ .github/workflows/        # [CLAUDE] CI y cron de ingesta
â””â”€ components.json / config de UI   # [CODEX]
```

- `src/app/globals.css` (Tailwind v4, tokens en `@theme`), `src/app/layout.tsx` y las fuentes son de **Codex**. Claude solo dejÃ³ `lang="es-CO"` y la metadata bÃ¡sica.
- Archivos raÃ­z de infraestructura (`package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `.env.example`) son de **Claude**. Codex puede **agregar dependencias de UI** a `package.json` y lo anota en el registro.

---

## 8. Responsabilidades

### Product Owner (humano)
- Aprueba decisiones de producto y prioridades. Resuelve los desacuerdos entre agentes.
- Valida las fuentes (que se puedan usar legalmente) y hace o coordina la curadurÃ­a manual inicial.
- Consigue estudiantes para las pruebas y la retroalimentaciÃ³n del piloto.
- Ejecuta en su mÃ¡quina los comandos que requieren credenciales (Supabase, Vercel y GitHub).

### Claude â€” planeaciÃ³n, arquitectura y lÃ³gica
| Ãrea | Responsabilidades |
|------|-------------------|
| PlaneaciÃ³n | Mantener este documento, el roadmap, los criterios de aceptaciÃ³n y las decisiones tÃ©cnicas (anotadas en Â§16) |
| Contratos | Tipos TS, esquemas Zod, firmas de funciones de servidor y (de)serializaciÃ³n de los filtros en la URL. **Versionados** y con changelog |
| Mocks | Fixtures realistas (organizaciones **ficticias**) e interruptor `USE_MOCKS=true`, para que Codex trabaje sin depender de la base de datos |
| Base de datos | Esquema, migraciones, Ã­ndices, RLS, seeds (municipios, instituciones, programas y NBC) |
| BÃºsqueda | Consulta FTS, ranking, facetas, paginaciÃ³n y filtros |
| "Â¿Aplico?" | Motor de elegibilidad (Â§10) con pruebas exhaustivas |
| Servidor | Queries, server actions, auth de admin, lectura y escritura del perfil en cookie, "Reportar error" |
| Ingesta | Adaptadores por fuente, normalizaciÃ³n (fechas, municipios, niveles, compensaciÃ³n), deduplicaciÃ³n, cola de revisiÃ³n, vencimiento y verificaciÃ³n de enlaces |
| Calidad | Tests unitarios de lÃ³gica, CI, seguridad, privacidad (Ley 1581), cumplimiento de scraping (robots.txt, tÃ©rminos de uso, rate limiting) |
| Admin (lÃ³gica) | Acciones de crear, editar, publicar, retirar y fusionar duplicados, y la validaciÃ³n de cada una |

### Codex â€” diseÃ±o frontend y experiencia (UI/UX)
| Ãrea | Responsabilidades |
|------|-------------------|
| Design system | Identidad visual, tokens (color, tipografÃ­a, espaciado, radios), tema claro y oscuro, componentes base |
| PÃ¡ginas | Todas las rutas de `src/app/` (Â§9), consumiendo **solo** las funciones de `src/server/queries` y `src/server/actions` |
| Componentes | Tarjeta de oportunidad, filtros (panel en escritorio y *drawer* en mÃ³vil), chips de filtros activos, paginaciÃ³n, badge "Â¿Aplico?", desglose de requisitos, indicador de cierre, sello de fuente y verificaciÃ³n |
| Estados | Carga (skeletons), vacÃ­o (con sugerencias para ampliar la bÃºsqueda), error, sin resultados y oportunidad vencida |
| Flujos | Onboarding del perfil (â‰¤ 3 pasos, que se pueda saltar), bÃºsqueda â†’ detalle â†’ "Ir a la convocatoria oficial" |
| Microcopy | Textos de la UI en espaÃ±ol. Puede reemplazar los mensajes por defecto del motor de elegibilidad usando `code` (Â§10) |
| Responsive y a11y | Mobile-first, WCAG 2.2 AA, rendimiento (Core Web Vitals en verde con 4G) |
| Admin (UI) | Pantallas funcionales y sobrias: lista, formulario, cola de revisiÃ³n, fuentes |
| Tests | Playwright para los flujos crÃ­ticos de UI |
| SEO visual | Metadatos, Open Graph de cada oportunidad y pÃ¡gina 404 |

### Compartido
- DefiniciÃ³n de flujos de usuario y criterios de aceptaciÃ³n: Claude los redacta y Codex los revisa desde la UX.
- Textos legales (privacidad, tÃ©rminos): Claude redacta el contenido y Codex lo maqueta.

---

## 9. Rutas (mapa del sitio v1)

| Ruta | PropÃ³sito | Datos (funciÃ³n del contrato) |
|------|-----------|------------------------------|
| `/` | Inicio: buscador principal, accesos rÃ¡pidos por tipo y nivel, "cierran pronto" (hoy es un placeholder de Claude, para reemplazar) | `getHomeData()` |
| `/practicas` | Resultados con filtros (el estado vive en la URL) | `searchOpportunities(params)` |
| `/practicas/[slug]` | Detalle, "Â¿Aplico?" y botÃ³n al enlace oficial | `getOpportunity(slug)` |
| `/perfil` | Crear o editar el perfil acadÃ©mico (sin cuenta) | `getProfile()`, `saveProfile()`, `clearProfile()` |
| `/fuentes` | Transparencia: de dÃ³nde salen los datos y cada cuÃ¡nto se verifican | `listSources()` |
| `/privacidad`, `/terminos` | Legales | estÃ¡tico |
| `/admin/*` | Panel protegido: oportunidades, nueva o editar, revisiÃ³n, fuentes, reportes | `admin*` (Â§11) |

**ParÃ¡metros de bÃºsqueda en la URL** (para compartir y volver atrÃ¡s). Claude implementa `parseSearchParams` y `toSearchParams` en `src/lib/contracts/search.ts`:

```
/practicas?q=analista&tipo=pasantia,contrato_aprendizaje&nivel=tecnologo
          &municipio=medellin,envigado&modalidad=remota&institucion=<id>
          &programa=<id>&remunerada=1&duracion_max=6&cierra_en=15
          &aplico=1&orden=cierre&pagina=2
```

---

## 10. Motor "Â¿Aplico?" (especificaciÃ³n)

Es una funciÃ³n **pura y determinista**: `evaluateEligibility(opportunity, profile, today)`. Vive en `src/lib/eligibility/` y corre tanto en el servidor como en el cliente.

### Perfil del estudiante (`StudentProfile`, guardado en la cookie `pc_profile`)
`institutionId` Â· `programId` Â· `level` Â· `semester` (1â€“12 o `null`) Â· `isGraduate` Â· `municipality` (opcional) Â· `preferredModalities` (opcional)

### Criterios
| Criterio | `cumple` | `no_cumple` | `desconocido` |
|----------|----------|-------------|---------------|
| `nivel` | Su nivel estÃ¡ entre los aceptados | Su nivel no estÃ¡ | La oferta no especifica el nivel |
| `programa` | Su programa aparece de forma explÃ­cita | Ni su programa ni su NBC aparecen y la oferta **no** dice "y afines" | La oferta dice "afines" y su programa es del mismo NBC â†’ **`verificar`** Â· o no especifica programas |
| `semestre` | EstÃ¡ dentro del rango | Fuera del rango | Rango no publicado o semestre no indicado en el perfil |
| `institucion` | La oferta estÃ¡ abierta a cualquiera, o su instituciÃ³n aparece | La oferta es exclusiva de otras instituciones | â€” |
| `fecha_limite` | TodavÃ­a estÃ¡ abierta | Ya venciÃ³ | `hasta_agotar_cupos` o `no_publicada` â†’ `verificar` |
| `otros` | â€” | â€” | Requisitos en texto libre (idioma, promedio, etc.) â†’ siempre `verificar` |

### Veredicto (`EligibilityVerdict`)
- `no_cumple`: al menos un criterio en `no_cumple` (solo cuando el dato es **seguro**).
- `cumple`: ningÃºn `no_cumple`, y nivel y programa en `cumple`.
- `revisar`: cualquier otro caso (hay criterios `desconocido` o `verificar`).
- `sin_perfil`: el estudiante no ha creado su perfil.

Cada `EligibilityCheck` trae `criterion`, `status`, `code` (estable, por ejemplo `LEVEL_NOT_ACCEPTED`, para que Codex escriba su propio texto) y `message` (texto por defecto en espaÃ±ol, listo para mostrar).
**Regla de oro:** ante la duda se usa `revisar`, nunca `no_cumple`. Debajo del veredicto siempre va el aviso: "Confirma los requisitos en la convocatoria oficial".

---

## 11. Contrato v0.1 (implementado)

> **La fuente de verdad es el cÃ³digo** (`CONTRACT_VERSION` en `src/lib/contracts/index.ts`). Lo de abajo es un resumen. Si hay diferencias, manda el cÃ³digo.

### DÃ³nde estÃ¡ cada cosa
| Necesitasâ€¦ | Importa de |
|------------|------------|
| Tipos, enums y helpers de URL (`parseSearchParams`, `toSearchParams`, `countActiveFilters`) | `@/lib/contracts` |
| Etiquetas en espaÃ±ol de los enums (`OPPORTUNITY_TYPE_LABELS`, `SORT_LABELS`â€¦) | `@/lib/catalog/labels` |
| Lecturas: `searchOpportunities`, `getOpportunity`, `getHomeData`, `getFilterOptions`, `getProfile`, `listSources` | `@/server/queries` (solo Server Components) |
| Acciones: `saveProfile`, `clearProfile` / `reportIssue` | `@/server/actions/profile` / `@/server/actions/report` |
| Datos para prototipar sin servidor: `mockCards`, `mockCardsWithProfile`, `mockDetail`, `mockSearchResult`, `mockProfile` | `@/lib/mocks` |

### Uso tÃ­pico (pÃ¡gina de resultados)
```tsx
// src/app/practicas/page.tsx
import { Suspense } from "react";
import { parseSearchParams } from "@/lib/contracts";
import { searchOpportunities } from "@/server/queries";

async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const result = await searchOpportunities(parseSearchParams(await searchParams));
  return /* tarjetas, facetas (result.facets), paginaciÃ³n (result.totalPages) */;
}

export default function Page(props: PageProps<"/practicas">) {
  return <Suspense fallback={<ResultsSkeleton />}><Results searchParams={props.searchParams} /></Suspense>;
}
```

### Comportamientos que la UI debe conocer
- **Datos de prueba que cubren todos los casos:** una oferta que cierra hoy, una que cierra maÃ±ana, varias que cierran en â‰¤ 7 dÃ­as, una `hasta_agotar_cupos`, una `no_publicada`, una 100% remota, una exclusiva de ciertas instituciones, una `isStale`, una vencida (visible solo por URL: `/practicas/practica-comunicacion-servicios-publicos-valle`) y una retirada (nunca aparece).
- **Municipio:** al filtrar por municipio, las ofertas **remotas** siempre se incluyen.
- **Modalidad desconocida (v0.1.2):** `modality` puede ser `no_especificada` (`MODALITY_LABELS` â†’ Â«Modalidad desconocidaÂ»). Filtrar por `presencial`, `hibrida` o `remota` **no** las incluye; tienen su propia opciÃ³n de faceta (`modalidad=no_especificada`). Sin filtro de modalidad aparecen todas. En el filtro de municipio se comportan como una presencial: solo salen en su municipio.
- **Facetas:** cada conteo se calcula sin aplicar el filtro de su propia faceta. Vienen todas las opciones, incluso con `count: 0`, y la UI decide si las oculta.
- **`eligibleOnly` (`aplico=1`):** excluye solo las `no_cumple`. Sin perfil se ignora y `appliedProfile` sale en `false`.
- **Orden `relevancia`:** primero el puntaje de texto, luego elegibilidad (`cumple` primero), luego la fecha de cierre mÃ¡s prÃ³xima.
- **`getOpportunity`:** devuelve `null` si no existe o fue retirada (â†’ `notFound()`). Las vencidas se devuelven con `status: "vencida"`.
- **`requirements.programs`:** incluye tambiÃ©n Ã¡reas aceptadas, con nombre "Ãrea: â€¦".
- **`saveProfile`:** valida que el `level` coincida con el nivel del programa elegido. En `fieldErrors` las claves son los nombres de campo (`programId`, `level`â€¦).
- **Mensajes de "Â¿Aplico?":** usa `check.message` por defecto, o mapea `check.code` (lista completa en `src/lib/contracts/eligibility.ts`) para escribir tu propio texto. Muestra siempre `ELIGIBILITY_DISCLAIMER`.

### Resumen de tipos (v0.1)
```ts
// ---- BÃºsqueda ----
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
  pageSize?: number;                // 20 por defecto, mÃ¡x. 50
}

interface SearchResult {
  items: OpportunityCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: Record<'types' | 'levels' | 'municipalities' | 'modalities', { value: string; label: string; count: number }[]>;
  appliedProfile: boolean;          // true si se evaluÃ³ la elegibilidad
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
  source: { name: string; url: string };  // url = pÃ¡gina de la fuente principal (v0.1.1)
  lastVerifiedAt: string;           // ISO datetime
  isStale: boolean;                 // true si no se verifica hace mÃ¡s de 14 dÃ­as
  eligibility: { verdict: EligibilityVerdict } | null;
}

interface OpportunityDetail extends OpportunityCard {   // + sources: {name,url}[], publishedAt
  description: string;              // resumen propio, no copia Ã­ntegra de la fuente
  requirements: { semesterMin: number | null; semesterMax: number | null; programs: { id: string; name: string }[];
                  acceptsRelatedPrograms: boolean; institutions: { id: string; name: string }[] | null; other: string[] };
  startDate: string | null;
  applyUrl: string;                 // enlace oficial para postularse
  sourceUrl: string;                // pÃ¡gina donde se encontrÃ³
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

- **Registro de fuentes** (tabla `sources`): nombre, URL, mÃ©todo (`api` | `scraping` | `manual`), base legal y tÃ©rminos revisados (sÃ­/no, con fecha), frecuencia, estado.
- **Interfaz de adaptador:** `fetch() â†’ RawItem[]` â†’ `parse(raw) â†’ OpportunityDraft` â†’ normalizar â†’ deduplicar â†’ upsert. Cada adaptador es independiente: si uno falla, los demÃ¡s siguen.
- **Ã‰tica y legalidad:** respetar robots.txt y los tÃ©rminos de uso, limitar la tasa de peticiones (â‰¥ 2 s entre peticiones por dominio), usar un User-Agent genÃ©rico del proyecto, **no** iniciar sesiÃ³n, **no** evadir captchas ni muros de pago, guardar **datos fÃ¡cticos y un resumen propio** (no copiar descripciones completas) y enlazar siempre al original.
- **Calidad:** lo que llega por automatizaciÃ³n con poca confianza va a `en_revision`. Job diario: oportunidades con fecha lÃ­mite pasada â†’ `vencida`. Job semanal: verificaciÃ³n de enlaces (404 â†’ marcar para revisiÃ³n).
- **DeduplicaciÃ³n:** hash de (organizaciÃ³n + tÃ­tulo normalizado + fecha lÃ­mite) y similitud trigram para los casos dudosos. Si se fusionan duplicados, se conservan todas las fuentes.
- **Fuentes candidatas para MedellÃ­n** (por validar con el PO antes de automatizar): Servicio PÃºblico de Empleo / Agencia PÃºblica de Empleo del SENA Â· programa Estado Joven (prÃ¡cticas en el sector pÃºblico) Â· bolsas de empleo y oficinas de prÃ¡cticas de las instituciones semilla Â· pÃ¡ginas de carreras de empresas grandes de la regiÃ³n (muchas usan ATS con tableros pÃºblicos) Â· portales privados de empleo **solo con carga manual y enlace**, sin scraping si sus tÃ©rminos lo prohÃ­ben.

**Implementado (base):** en `ingestion/` (guÃ­a en `ingestion/README.md`) ya estÃ¡n los tipos (`types.ts`), los normalizadores puros por campo y `normalizeDraft` (`normalize/`), la deduplicaciÃ³n (`dedupe.ts`), la descarga respetuosa (`http.ts`), el *store* en memoria (`store.ts`), el orquestador con reporte por fuente (`pipeline.ts`), el job de vencimiento (`jobs/expire.ts`), el adaptador CSV con su plantilla y el CLI `npm run ingest`.
Regla de publicaciÃ³n: todo lo que entra de forma automÃ¡tica queda `en_revision`, salvo que la fuente tenga `autoPublish` **y** los campos crÃ­ticos salgan con confianza alta y sin ninguna observaciÃ³n (ahÃ­ pasa a `publicada`); si la fecha lÃ­mite ya pasÃ³ queda `vencida`.
TambiÃ©n estÃ¡n el *store* sobre Supabase (`ingestion/stores/supabase.ts`, `--store=supabase`), los conectores ATS (Greenhouse y Lever) y el CLI de administraciÃ³n (`npm run admin`).
Falta: mÃ¡s adaptadores de fuentes reales, el cron y la verificaciÃ³n de enlaces.

---

## 13. Modelo de datos (resumen)

`municipalities` Â· `institutions` Â· `programs` (â†’ institution, level, nbc) Â· `knowledge_areas` (NBC) Â· `organizations` Â· `sources` Â· `raw_items` (payload crudo, hash, source, fetched_at) Â· `opportunities` (todos los campos de Â§11, mÃ¡s `status`, `dedupe_hash`, `needs_review`, `first_seen_at`, `last_verified_at`, `search_vector`) Â· `opportunity_levels` Â· `opportunity_programs` Â· `opportunity_knowledge_areas` Â· `opportunity_institutions` (restricciÃ³n opcional) Â· `opportunity_sources` (N:M) Â· `issue_reports` Â· `admin_users`.
v2: `student_accounts`, `saved_opportunities`, `saved_searches`, `notifications`.
RLS: el pÃºblico lee `publicada` y `vencida` (la vencida solo por su URL directa); escriben solo el rol admin y el service role (ingesta).
**Logos de empresas:** `organization.logoUrl` se arma en el servidor (`src/server/domain/logos.ts`): `organizations.logo_url` si existe; si no, el Ã­cono de **Brandfetch** para el dominio de `organizations.website`, con el client ID pÃºblico `NEXT_PUBLIC_BRANDFETCH_CLIENT_ID` (si falta, no hay logos). Brandfetch exige *hotlinking*: la URL va directo en un `<img>` (nunca `next/image` ni copias propias, y sin peticiones desde scripts). Las organizaciones Â«(confidencial)Â» y Â«(empresa cliente)Â» nunca llevan logo. La polÃ­tica de privacidad debe mencionar a Brandfetch (el navegador del estudiante le pide las imÃ¡genes).
AdemÃ¡s: `opportunities.review_notes` (observaciones de la ingesta), `organizations.normalized_name` (Ãºnica; evita organizaciones repetidas), `opportunity_sources.position` (0 = fuente principal) e `ingestion_runs` (reporte de cada corrida).
Migraciones (**ya aplicadas** al proyecto Supabase del PO con `npx supabase db push --remote`): `supabase/migrations/20261113000000_init.sql` (esquema y RLS) `20261116000000_catalog.sql` (catÃ¡logo y fuentes; generado con `npm run db:catalog` desde `src/lib/catalog`, no se edita a mano) y `20261117000000_modalidad_desconocida_enum.sql` + `20261117000100_modalidad_desconocida_datos.sql` (valor `no_especificada` del enum `modality` y correcciÃ³n de las que tenÃ­an presencial asumida). El modelo interno en TS estÃ¡ en `src/server/domain/types.ts` y el mapeo fila â†” registro en `src/server/repo/supabase-mappers.ts`.
**Repositorio Supabase implementado:** la app lee de Supabase con `USE_MOCKS=false` (Â§6). La ingesta escribe con `npm run ingest -- â€¦ --store=supabase` y la revisiÃ³n se hace con `npm run admin` (ver `ingestion/README.md`). Los reportes de error los inserta el servidor con la clave secreta; no hay inserciÃ³n pÃºblica.

---

## 14. Riesgos y mitigaciones

| Riesgo | MitigaciÃ³n |
|--------|------------|
| TÃ©rminos de uso o legalidad del scraping | Priorizar APIs y fuentes abiertas, revisar los tÃ©rminos de cada fuente antes de automatizarla, carga manual como respaldo, retirar la fuente si su dueÃ±o lo pide |
| Datos desactualizados (ofertas vencidas o enlaces rotos) | `last_verified_at` visible, jobs de vencimiento y verificaciÃ³n de enlaces, botÃ³n "Reportar error", aviso `isStale` |
| CatÃ¡logo pequeÃ±o al lanzar (*cold start*) | CuradurÃ­a manual de 100â€“200 convocatorias antes del piloto, enfocada en el Valle de AburrÃ¡ |
| "Â¿Aplico?" equivocado | Regla de oro "ante la duda, `revisar`", explicaciÃ³n por criterio, aviso fijo y tests con casos reales |
| Ofertas falsas o estafas | Solo fuentes verificadas, revisiÃ³n humana de lo dudoso, motivo de reporte "sospechosa", aviso de que una prÃ¡ctica nunca debe cobrar |
| Privacidad (Ley 1581 de 2012) | v1 sin cuentas de estudiante, cookie sin datos personales, polÃ­tica de privacidad, datos mÃ­nimos en v2 |
| Mantenimiento de adaptadores | Adaptadores aislados, alertas cuando una fuente devuelve 0 resultados, pocas fuentes pero buenas |
| Conflictos entre agentes en el repo | Propiedad de carpetas (Â§7), contratos versionados, registro de coordinaciÃ³n (Â§16) |

---

## 15. Reglas de colaboraciÃ³n entre agentes

1. **Antes de empezar:** leer este archivo y las entradas recientes del registro (Â§16).
2. **Respetar la propiedad de carpetas (Â§7).** Si necesitas algo de la otra parte, **no lo implementes en su carpeta**: agrega una *Solicitud* en el registro.
3. **Contrato primero:** Claude publica o cambia el contrato y sus mocks **antes** de que Codex construya encima. Los cambios que rompen compatibilidad se marcan **âš  BREAKING** y suben la versiÃ³n menor (v0.1 â†’ v0.2).
4. **Codex nunca consulta la base de datos directamente** ni importa desde `src/server/db`. Solo usa `src/server/queries` y `src/server/actions`.
5. **Claude no decide estilos ni maquetaciÃ³n.** Si un dato del contrato existe solo para la UI (por ejemplo `daysLeft`), Codex decide cÃ³mo mostrarlo.
6. **CÃ³digo en inglÃ©s, textos de UI y documentaciÃ³n en espaÃ±ol.** Los valores de enums del dominio van en espaÃ±ol `snake_case` (Â§5).
7. **Ramas y commits:** ramas `claude/<tema>` y `codex/<tema>`. Commits convencionales (`feat(search): â€¦`, `feat(ui): â€¦`, `fix(eligibility): â€¦`). Nada se mezcla a `main` sin que el PO revise.
8. **DefiniciÃ³n de terminado:** tipos sin errores, lint limpio, tests de la parte propia en verde, estados vacÃ­o/carga/error cubiertos (Codex), casos borde cubiertos (Claude) y entrada en el registro.
9. **Desacuerdos:** se anotan como *DecisiÃ³n pendiente* en el registro y los resuelve el PO.

---

## 16. Registro de coordinaciÃ³n

> Lo mÃ¡s reciente va arriba. Tipos: **DecisiÃ³n** Â· **Solicitud** (para el otro agente) Â· **Cambio de contrato** Â· **Entrega** Â· **Pendiente PO**.
> Formato: `AAAA-MM-DD Â· Autor Â· Tipo Â· DescripciÃ³n Â· Estado`

| Fecha | Autor | Tipo | DescripciÃ³n | Estado |
|-------|-------|------|-------------|--------|
| 2026-11-19 | Claude | Entrega | **Sitio publicado en Vercel:** https://practicas-col.vercel.app (proyecto `practicas-col`, plan Hobby, rama `main`; cada push a `main` despliega solo). Variables: `USE_MOCKS=false`, las tres de Supabase, `NEXT_PUBLIC_BRANDFETCH_CLIENT_ID` y `NEXT_PUBLIC_SITE_URL` (solo Production). Verificado: `/`, `/practicas` (datos reales y logos), `/fuentes`, `/perfil` y og:image con el dominio pÃºblico. TambiÃ©n se mezclÃ³ `codex/logos` a `main` (revisada por Claude). Siguiente: claves de Jooble y Careerjet | Cerrado |
| 2026-11-19 | Codex | Entrega | **Mostrar logos**, rama `codex/logos` desde `main` actualizado (`39a8a80`), solo en `C:\practicascol-codex`: componente compartido en tarjeta, fila y detalle que consume `organization.logoUrl` con `<img>` directo, `loading="lazy"`, `alt=""` y dimensiones cuadradas reservadas. Mantiene Referer y fondo blanco en ambos temas; null/error muestra las iniciales existentes y una URL nueva puede volver a cargar. Sin cambios en contratos, mocks ni carpetas Claude. Check verde (522 tests, tipos/lint), build OK y 22 e2e verdes: carga, error, null, cambio de URL, Referer, temas y tamaÃ±os; fixtures de UI interceptadas sin contactar Brandfetch. RevisiÃ³n visual mÃ³vil/escritorio completada. El ajuste previo de urgencia quedÃ³ preservado aparte en `codex/portada-recientes` (`dbb8464`), sin mezclarlo con logos. | Solicitud Â«Mostrar logosÂ» resuelta; para revisiÃ³n del PO |
| 2026-11-19 | Claude | RevisiÃ³n | **Mezcla a `main` aprobada por el PO:** `claude/admin-reportes` y `claude/logos`, revisadas por Opus (sin secretos expuestos, sin `next/image`, client ID pÃºblico, `website` solo al crear la organizaciÃ³n, exclusiÃ³n de confidenciales y agencias). Check (522 tests) y build OK. Desde hoy Claude trabaja solo con Opus (Fable no disponible). Para Codex: ya puede atender la Solicitud Â«Mostrar logosÂ» de abajo | Cerrado |
| 2026-11-17 | Claude | Entrega | **Logos de empresas (Brandfetch):** `logoUrl` se arma desde `organizations.website` con el client ID pÃºblico (hotlinking, sin copias); sin logo para confidenciales y agencias; la ingesta toma el dominio del enlace cuando no es un portal de empleo; CLI `npm run admin -- empresas | empresa â€¦ --sitio/--logo/--sin-logo`. 35 dominios cargados (2 dudosos: Grupo UMA y Tostaditos Susanita). 522 tests | Cerrado |
| 2026-11-17 | Claude | Solicitud â†’ Codex | **Mostrar logos:** usar `organization.logoUrl` en tarjeta, fila y detalle con `<img>` normal (NO `next/image`: Brandfetch exige hotlinking), tamaÃ±o fijo cuadrado, `loading="lazy"`, `alt=""` (el nombre ya estÃ¡ al lado), fondo claro tambiÃ©n en tema oscuro, y **las iniciales actuales como respaldo** si `logoUrl` es null o la imagen falla (`onError`, la URL usa fallback 404) | Resuelta por Codex (2026-11-19), ver Entrega superior |
| 2026-11-17 | Claude | Entrega | **Reportes en el CLI de administraciÃ³n:** `npm run admin -- reportes [--todos]` (lista con tÃ­tulo, motivo, comentario y sugerencia de acciÃ³n) y `resolver <id>` (marca resuelto con `resolved_at`). MigraciÃ³n `20261117000200_reportes_resueltos.sql` aplicada. 485 tests | Cerrado |
| 2026-11-17 | Claude | RevisiÃ³n | **Mezcla a `main` aprobada por el PO:** `codex/reportar-y-seo` (diÃ¡logo de reporte sin datos personales, `robots.ts`, `sitemap.ts`, `/design-system` oculta en producciÃ³n) y `codex/portada-recientes` (portada con Â«ReciÃ©n publicadasÂ» siempre y Â«Cierran prontoÂ» solo si hay). Revisadas por Claude: check, build y cero cambios en carpetas de Claude. ObservaciÃ³n menor para Codex: si una oferta estÃ¡ en ambas listas, priorizar Â«Cierran prontoÂ» (urgencia Ãºtil, Â§3) | Cerrado |
| 2026-11-16 | Codex | Entrega | **Portada con recientes**, rama `codex/portada-recientes` desde `main` local (`9e11b7b`, contrato v0.1.2), solo en `C:\practicascol-codex`. Â«ReciÃ©n publicadasÂ» siempre presente, con las seis ofertas de `recent`; bloque de cierres solo con ofertas disponibles y sin repetir IDs de recientes (prioridad a novedades). Si ambas listas estÃ¡n vacÃ­as, estado vacÃ­o y enlace al catÃ¡logo. Una query `getHomeData()` dentro de Suspense. Cuatro pruebas con mocks: sin fecha, ambas listas, coincidencia total y ambas vacÃ­as. Check verde (463 tests, tipos/lint), 14 e2e verdes y build OK. Sin cambios en carpetas Claude. ObservaciÃ³n de base: el main local utilizado aÃºn no incluye reportar/SEO; esa entrega sigue en `codex/reportar-y-seo` y no se reincorporÃ³ en esta tarea. | Revisado y mezclado a `main` (2026-11-17) |
| 2026-11-17 | Claude | Cambio de contrato | **Contrato v0.1.2 (no breaking):** `Modality` agrega `no_especificada` (etiqueta Â«Modalidad desconocidaÂ»). La ingesta ya no asume presencial cuando la fuente no lo dice. Filtrar por presencial/hÃ­brida/remota excluye las desconocidas; hay opciÃ³n de faceta propia. Datos del PO corregidos en Supabase | Cerrado |
| 2026-11-17 | Claude | Solicitud â†’ Codex | (Opcional) Estilo visual para Â«Modalidad desconocidaÂ» en tarjeta, fila y detalle (p. ej. tono neutro o Ã­cono de pregunta), coherente con el principio de incertidumbre honesta. Hoy se muestra solo la etiqueta | Abierto |
| 2026-11-16 | Codex | Entrega | **Reportar problemas y SEO**, rama `codex/reportar-y-seo` creada desde `main` local con Fase 1, solo en `C:\practicascol-codex`. `npm install` completado sin cambios de dependencias. Detalle abierto/vencido con diÃ¡logo Radix Â«Reportar un problemaÂ»: motivos de catÃ¡logo, comentario opcional â‰¤500, sin datos personales, aviso ante sospecha, Ã©xito/error/fieldErrors, conservaciÃ³n del texto al fallar, prevenciÃ³n de doble envÃ­o y foco/teclado/Escape. Usa `reportIssue` existente. `robots.ts` permite el sitio salvo `/design-system` y `/admin`; sitemap estÃ¡tico con cuatro rutas y `NEXT_PUBLIC_SITE_URL` (fallback localhost:3000). GalerÃ­a 404 en producciÃ³n y disponible en desarrollo. Check verde (446 tests, tipos/lint), build OK y 18 e2e verdes en producciÃ³n con mocks; SEO tambiÃ©n verificado en desarrollo con fallback. RevisiÃ³n visual mÃ³vil/escritorio y temas claro/oscuro. Sin cambios en carpetas Claude. | Revisado y mezclado a `main` (2026-11-17) |
| 2026-11-16 | Codex | Solicitud â†’ Claude | **Sitemap de convocatorias:** cuando estÃ© disponible, publicar la query de URLs de ofertas pÃºblicas prevista por el PO, con firma tipada y reglas de inclusiÃ³n. Por ahora el sitemap incluye solo `/`, `/practicas`, `/fuentes` y `/perfil`, sin consultar directamente el repositorio. | Pendiente de contrato |
| 2026-11-16 | Claude | Entrega | **Conectores de ATS (Greenhouse y Lever)** en rama `claude/ats`: adaptadores con filtro Colombia + prÃ¡cticas, extracto â‰¤ 300 caracteres y sin datos de reclutadores; registro `ingestion/sources/ats.ts` (Power Digital Marketing, Clara, Cobre, Wizeline, La Haus, Yuno); CLI `npm run ingest -- --ats`. Prueba real: Power Digital trae 7 prÃ¡cticas (remotas); las demÃ¡s hoy tienen 0. SmartRecruiters descartado por `robots.txt`; Ashby pendiente del PO. Normalizadores con tÃ©rminos en inglÃ©s (intern, trainee, student, hybrid, remote). Construido por Fable 5.2 y terminado por Opus 5.5, porque Fable alcanzÃ³ su lÃ­mite de uso. 380 tests | Cerrado |
| 2026-11-16 | Claude | Entrega | **Fase 1 (lado Claude): Supabase conectado** en rama `claude/fase-1`: esquema + catÃ¡logo aplicados al proyecto del PO, repositorio Supabase (clave secreta solo en servidor, cachÃ© corta), store de ingesta (`--store=supabase`), CLI de administraciÃ³n (`npm run admin -- revision|aprobar|retirar|vencer|publicadas`). Prueba real con datos de ejemplo y limpieza. 446 tests | Cerrado |
| 2026-11-16 | Claude | Solicitud â†’ Codex | **Panel de administraciÃ³n (UI)** sobre las acciones que se definirÃ¡n en `src/server/actions/admin.ts` (Fase 1b, con Supabase Auth): lista de revisiÃ³n, ver, aprobar, retirar. Mientras tanto el PO usa `npm run admin` | Abierto |
| 2026-11-14 | Claude | Entrega | **Plantilla Excel para carga manual:** `ingestion/templates/convocatorias.xlsx` (encabezado fijo, listas desplegables, notas por columna, hoja de instrucciones) generada con `npm run template:xlsx`; lector `.xlsx` en la ingesta (`npm run ingest -- --xlsx â€¦`). La plantilla CSV vuelve a usar coma. `exceljs` como devDependency (solo tooling) | Cerrado |
| 2026-11-14 | Claude | RevisiÃ³n | **Mezcla a `main` aprobada por el PO:** `claude/ingesta` (motor de ingesta, revisado por Opus con entradas reales difÃ­ciles: fechas, pagos, programas "afines", remotas, fuera de cobertura y vencidas) y `codex/fuente-en-tarjeta` (revisado: check, build y cero cambios en carpetas de Claude). Se documentÃ³ `NEXT_PUBLIC_SITE_URL` en `.env.example`. Codex trabaja en el worktree `C:\practicascol-codex` y Claude en `C:\practicascol`: cada uno en su carpeta, nunca cambiar de rama en la carpeta del otro | Cerrado |
| 2026-11-14 | Claude | Entrega | **Motor de ingesta (base)** en rama `claude/ingesta`: normalizadores (fechas, municipio, niveles, tipo, modalidad, pago, duraciÃ³n, semestre, programas, instituciones), deduplicaciÃ³n (hash + trigramas), descarga respetuosa (robots.txt, â‰¥2 s por host, 429), pipeline con reporte por fuente, job de vencimiento, adaptador CSV + plantilla `ingestion/templates/convocatorias.csv` y CLI `npm run ingest`. 322 tests en total; incluye fechas mes/aÃ±o y pago de contrato de aprendizaje como apoyo de sostenimiento | Cerrado |
| 2026-11-14 | Codex | Entrega | **Fuente en tarjeta y ajustes de revisiÃ³n**, en el worktree `C:\practicascol-codex`, rama `codex/fuente-en-tarjeta`: tarjetas, filas y detalle usan `source.url` (contrato v0.1.1) mediante Â«Ver publicaciÃ³n originalÂ», con pestaÃ±a nueva, `noopener noreferrer`, contexto accesible y Ã¡rea tÃ¡ctil de 44px; postulaciÃ³n conserva `applyUrl`. Retirados los cuatro SVG duplicados sin prefijo tras comparar hashes, conservando `practicascol-cuaderno-*`. DescripciÃ³n OG sin doble punto en organizaciones terminadas en punto. Layout con `metadataBase` desde `NEXT_PUBLIC_SITE_URL` y fallback `http://localhost:3000`. Check verde (31 tests, tipos/lint), 13 e2e verdes sobre build de producciÃ³n; build OK con fallback y con dominio configurado de prueba. RevisiÃ³n visual mÃ³vil/escritorio y navegaciÃ³n con teclado verificadas. Ninguna carpeta Claude modificada. | Resuelta; lista para revisiÃ³n del PO |
| 2026-11-14 | Codex | Solicitud â†’ Claude | Documentar `NEXT_PUBLIC_SITE_URL` en `.env.example`: URL absoluta del sitio, con protocolo; configurarla al compilar/desplegar para que las imÃ¡genes Open Graph usen el dominio pÃºblico. El layout usa `http://localhost:3000` si falta o estÃ¡ vacÃ­a. No se editÃ³ `.env.example` por propiedad de infraestructura (Â§7). | Resuelto por Claude (2026-11-14) |
| 2026-11-13 | Claude | Cambio de contrato | **Contrato v0.1.1 (no breaking):** `OpportunityCard.source.url` = pÃ¡gina de la fuente principal donde se encontrÃ³ la convocatoria (distinto de `applyUrl`). Mocks actualizados y test agregado. Codex ya puede enlazar la publicaciÃ³n original desde la tarjeta (Solicitud para Codex: mostrar ese enlace en la tarjeta) | Cerrado |
| 2026-11-13 | Claude | RevisiÃ³n | **Logo e iconos (Codex, rama `codex/logo`) revisados y mezclados a `main`:** sÃ­mbolo birrete + cuaderno (SVG dos colores), lockups claro/oscuro con wordmark en trazados, `icon.svg`, `favicon.ico`, `apple-icon.png`, `opengraph-image.png`; check (29 tests) y build OK, rutas de iconos 200. Observaciones menores para Codex: hay SVG duplicados en `public/images/` (versiones con y sin prefijo `practicascol-cuaderno-`, idÃ©nticas) que no usa la app; el og:description del detalle repite punto cuando la organizaciÃ³n termina en "." ("S.A.S.."); antes de desplegar falta `metadataBase` en el layout para que og:image no apunte a localhost | Cerrado |
| 2026-11-13 | Codex | Entrega | **Ajustes de la revisiÃ³n tÃ©cnica resueltos (1â€“5 y 7)**: metadata por oferta con tÃ­tulo/organizaciÃ³n y Open Graph; tema persistente en localStorage, restaurado antes de pintar y control sincronizado al montar; aviso de completar perfil solo sin perfil aplicado; copy de semestres y chip Â«Cierra hoyÂ»; retirados page-type/site-kind/data-type; opciÃ³n para ver todos los programas y reeditar perfiles cuyo programa no figura en la instituciÃ³n. Punto 6: `/design-system` sin cambios por instrucciÃ³n del PO. Check verde (29 tests, tipos/lint), build correcto y 10 e2e verdes. Entrega inicial publicada como `ced901d` en `origin/codex/design-system`; `test-results/` excluido de Git. El contrato sigue en v0.1.0: uso de `source.url` pendiente de la publicaciÃ³n v0.1.1 de Claude; no se modificaron contratos ni mocks. | Resuelta dentro del alcance autorizado; fuente pendiente de Claude |
| 2026-11-13 | Claude | DecisiÃ³n | **Respuesta a la Solicitud de Codex (`source.url` en tarjeta):** aceptada. Se agrega `OpportunityCard.source.url` (URL de la fuente principal) en el **contrato v0.1.1**, sin romper compatibilidad, con sus mocks. Se avisarÃ¡ con una entrada "Cambio de contrato" | Cerrado (v0.1.1) |
| 2026-11-13 | Claude | Solicitud â†’ Codex | **Ajustes menores tras la revisiÃ³n** (ninguno bloquea el merge): (1) `generateMetadata` en `/practicas/[slug]`, con tÃ­tulo, organizaciÃ³n y OG propios de cada oferta, para que se vea bien al compartirla por WhatsApp. (2) `ThemeToggle`: recordar la elecciÃ³n (cookie o localStorage) y leer el tema actual al montar. (3) Ocultar el aviso "Completar mi perfil" de `/practicas` cuando `result.appliedProfile` es true. (4) Copy: semestre "Desde 8 hasta no especificado" â†’ "Desde 8.Âº semestre"; chip "Cierra en 0 dÃ­as" â†’ "Cierra hoy". (5) Quitar `other: {page-type, site-kind}` y `data-type="software"` del layout, que parecen restos de una herramienta. (6) `/design-system`: ocultarla en producciÃ³n (`notFound()` si `NODE_ENV === "production"`) o confirmar con el PO que debe ser pÃºblica. (7) Perfil: si el programa no aparece en la instituciÃ³n elegida, ofrecer "Mi programa no aparece â†’ ver todos", porque el catÃ¡logo semilla aÃºn estÃ¡ incompleto | Resuelta: puntos 1-5 y 7; punto 6 pendiente del PO, sin cambios |
| 2026-11-13 | Claude | RevisiÃ³n | **RevisiÃ³n tÃ©cnica de la Fase 0/1 UI (Codex): aprobada.** `npm run check` en verde (29 tests, tipos y lint) y `next build` OK, con todas las rutas en prerender parcial. Prueba de humo de 13 rutas, incluidas vencida, retirada, 404 y paginaciÃ³n fuera de rango. Se respeta la propiedad de carpetas (cero cambios en carpetas de Claude), el contrato se usa vÃ­a queries y actions, las queries van dentro de `<Suspense>` y los filtros viven en la URL. ObservaciÃ³n conocida: un slug inexistente responde HTTP 200 + `noindex` (soft 404) porque `notFound()` corre dentro del streaming; es aceptable por ahora. Los e2e de Playwright no los volviÃ³ a correr Claude. Pendiente: que Codex commitee su trabajo, que hoy estÃ¡ sin commit en `codex/design-system` | Cerrado |
| 2026-11-13 | Codex | Entrega | **Portada ilustrada solicitada por el PO**, tomando la composiciÃ³n de la referencia Edtech de Musemind en Dribbble. Conserva identidad bosque/lima; tÃ­tulo y bÃºsqueda en dos columnas, ilustraciÃ³n original generada (WebP transparente de 169 KiB) y accesos por nivel al pie, apilados en mÃ³vil. Componente `HomeHero`, sin cambios de contrato ni carpetas Claude. Procedencia/prompt junto al asset en `public/images`; contrato visual en `.impeccable/surfaces/home.md`. Check: 29 tests + tipos/lint; build correcto; 6 e2e verdes, bÃºsqueda/accesos y desbordamiento verificados de 320 a 1912 px. | Para revisiÃ³n del PO |
| 2026-11-13 | Codex | Entrega | **RediseÃ±o visual v2 solicitado por el PO**, tras rechazar la identidad anterior. Referencias pÃºblicas consultadas: Dribbble, Uiverse, shadcn/ui, Mobbin y Recent. Paleta bosque/lima, Bricolage Grotesque local, marca de avance, portada con accesos reales por nivel, catÃ¡logo en filas comparables con remuneraciÃ³n/cierre/trazabilidad, accesos por tipo y cambio manual de tema. Se conservan contratos, queries y Suspense. Check: 29 tests + tipos/lint verdes; 5 e2e verdes. DocumentaciÃ³n de referencia en `.impeccable/surfaces/catalog.md`. Dependencia UI agregada: `@fontsource-variable/bricolage-grotesque`. | Para revisiÃ³n visual del PO |
| 2026-11-13 | Codex | Entrega | **Fase 0/1 UI** en `codex/design-system`, sobre `main` actualizado: identidad blanco/azul y Urbanist local; tokens claro/oscuro, configuraciÃ³n shadcn y primitivas Radix, tarjeta con cierres/veredictos/fuente/verificaciÃ³n, galerÃ­a `/design-system` con `mockCards` y `mockCardsWithProfile`; `/practicas` con drawer mÃ³vil accesible, filtros URL, chips, orden, paginaciÃ³n y vacÃ­o; detalle con requisitos, Â¿Aplico?, fuente, vencida y 404. Queries dentro de Suspense. Inicio, perfil sin cuenta y fuentes para cerrar navegaciÃ³n. `npm run check`: 29 tests, tipos y lint verdes; build OK; 4 e2e Playwright verdes (Chrome). RevisiÃ³n visual independiente: ship; taste gate ERROR por timeout, no aprobado. Detalles en `.taste-skill/REPORT.md`, sistema en `DESIGN.md`. Dependencias UI agregadas: Radix Dialog/Slot, CVA, clsx, tailwind-merge, lucide-react, Urbanist; dev: Playwright. NingÃºn archivo de carpetas Claude modificado. | Entregado para revisiÃ³n PO |
| 2026-11-13 | Codex | Solicitud â†’ Claude | **Trazabilidad en tarjeta (Â§3/D3)**: `OpportunityCard.source` solo trae `name`. Agregar `source.url` o `sourceUrl` y su mock para enlazar directamente a la publicaciÃ³n original sin consultas por tarjeta. Hoy fuente y verificaciÃ³n estÃ¡n visibles en tarjeta; enlaces originales y oficiales estÃ¡n en detalle. No se alterÃ³ el contrato v0.1. | Resuelto en v0.1.1 |
| 2026-11-13 | Claude | Solicitud â†’ Codex | **Fase 0/1 UI** (rama `codex/design-system`, partiendo de `main` cuando se mezcle `claude/fase-0`): (1) identidad visual y tokens en `globals.css`; instalar shadcn/ui. (2) **Tarjeta de oportunidad** con `mockCards`/`mockCardsWithProfile` (todos los estados de cierre y veredicto). (3) **`/practicas` en mÃ³vil** con filtros (drawer), chips, orden y paginaciÃ³n sobre `searchOpportunities`. (4) **`/practicas/[slug]`** con el desglose de "Â¿Aplico?". Respetar las reglas de Next 16 (Â§6) | Entregado por Codex; ver entrada superior |
| 2026-11-13 | Claude | DecisiÃ³n | BÃºsqueda en memoria (TS) para el MVP, en lugar de Postgres FTS desde el dÃ­a 1 (Â§6). npm en lugar de pnpm. Se mantienen `cacheComponents` y `partialPrefetching` del scaffold de Next 16 | Cerrado |
| 2026-11-13 | Claude | Entrega | **Fase 0, lado Claude** (rama `claude/fase-0`): scaffold Next 16.4 + Tailwind 4, contrato v0.1 (`src/lib/contracts`), catÃ¡logo (municipios, 20 instituciones, 31 programas, 14 NBC), motor "Â¿Aplico?", motor de bÃºsqueda con facetas, 25 oportunidades de prueba ficticias, queries y actions (perfil en cookie, reportar error), migraciÃ³n SQL con RLS, 29 tests en verde, build OK | Cerrado |
| 2026-11-13 | Claude | Pendiente PO | Confirmar las fuentes candidatas de Â§12 (cuÃ¡les se pueden usar legalmente) y conseguir 100â€“200 convocatorias para el seed | Abierto |
| 2026-11-13 | Claude | Pendiente PO | Crear las cuentas de Supabase y Vercel (Fase 1). GitHub y git ya estÃ¡n listos | Abierto |
| 2026-11-13 | Claude | DecisiÃ³n | Se aprueban las decisiones D1â€“D9 (Â§2) con el PO. Stack (Â§6) y propiedad de carpetas (Â§7) definidos | Cerrado |

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes â€” APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` â€” verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
