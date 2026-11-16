# Automatizar la búsqueda de convocatorias: opciones reales

> Investigación de Claude, 2026-11-16. Complementa [`fuentes-candidatas.md`](fuentes-candidatas.md). Pendiente de decisión del PO.
> Regla D2: solo se automatiza lo que la fuente **permite** (API pública, feed o convenio). Nada de scraping de portales que lo prohíben.

## Resumen

| # | Vía | Estado | Qué cubre | Riesgo legal | Qué hace falta |
|---|-----|--------|-----------|--------------|----------------|
| A | **APIs públicas de sistemas de selección (ATS)** de las empresas | ✅ Disponible ya | Ofertas publicadas en Greenhouse, Lever, Ashby, SmartRecruiters y Recruitee, y en SuccessFactors cuando la empresa expone su feed XML | Bajo: son APIs documentadas, sin clave, pensadas para publicar empleos | Saber **qué empresas del Valle de Aburrá** usan cada ATS (lista curada) y construir los adaptadores |
| B | **API de agregadores para socios** (Jooble, Careerjet) | 🟡 Hay que pedir clave | Agregan ofertas de muchos portales, incluidos Computrabajo y elempleo | Bajo si se aceptan sus términos (que **no** se pudieron leer completos) | Tener el **sitio publicado** (Vercel) y que el PO llene el formulario de socio. Confirmar si cubren Colombia (`es_CO`) y qué condiciones ponen |
| C | **Servicio Público de Empleo / APE del SENA** | 🔴 Caído | Vacantes del Estado y contratos de aprendizaje | Bajo (oficial) | La plataforma SISE está **fuera de servicio desde el 1/11/2026** por falta de contrato, sin fecha de regreso. No hay API pública documentada; DataEmpleo solo publica estadísticas. Pedir acceso a la Unidad del SPE cuando se restablezca |
| D | **Programas públicos semestrales** (Alcaldía, Gobernación, Estado Joven) | ✋ Manual | Cientos de plazas, 2 veces al año | — | Carga manual en cada ciclo (pocas filas). En v2, "calendario de convocatorias" con aviso de apertura |
| E | **Convenios** (Magneto, universidades, empresas) | 💬 Requiere gestión | Magneto es el ATS de muchas empresas de Medellín (Alkomprar, Kalley, Comfama, Postobón, ISAGEN…) | Ninguno con convenio | Contacto comercial o institucional. Encaja en v2, junto con la publicación directa por empresas |
| F | **TheirStack** (vendedor de datos de empleo; incluye Computrabajo) | 🟠 Plan B | Ofertas de Computrabajo y otros portales, actualizadas a diario, con enlace original | **Medio**: recolecta por scraping y su contrato deja al cliente el riesgo de reclamos de terceros. Su cláusula de "no ser la fuente principal de valor" choca con un buscador de prácticas | Confirmación escrita de TheirStack para mostrar las ofertas en un sitio público, y aceptación del riesgo por el PO. Plan gratis: 200 ofertas/mes; pago desde US$59/mes por 1.500. **Nunca guardar** los datos de reclutadores (Ley 1581) |
| ✗ | Scraping de Computrabajo, Magneto, Indeed o Jooble web, o "scrapers" de terceros (Apify y similares) | ❌ Descartado | — | Alto: términos de uso, Cloudflare, `robots.txt` | — |

## Detalle

### A. APIs públicas de ATS (lo más rápido de implementar)
URLs públicas, sin clave:
- **Greenhouse:** `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`, todas las ofertas en una sola respuesta.
- **Lever:** `api.lever.co/v0/postings/{empresa}?mode=json`.
- **Ashby:** `api.ashbyhq.com/posting-api/job-board/{tablero}?includeCompensation=true`. Suele traer salario estructurado e `isRemote`.
- **SmartRecruiters:** `api.smartrecruiters.com/v1/companies/{empresa}/postings`, paginada (máx. 100). El detalle de cada oferta va en `/postings/{id}`.
- **Recruitee:** `{empresa}.recruitee.com/api/offers/`.
- **SAP SuccessFactors:** algunas empresas exponen un feed XML (`career_ns=job_listing_summary&resultType=XML`). SAP está retirando el formato RSS y la disponibilidad depende de cada empresa.

Con eso se construye **un adaptador por tipo de ATS**, que el motor de ingesta ya soporta, más una lista de empresas con su identificador. Limitación: muchas empresas grandes colombianas usan Magneto, SuccessFactors sin feed o un portal propio, así que la cobertura dependerá de la lista.

### B. Jooble y Careerjet
- **Jooble:** la clave se pide con un formulario dirigido a webmasters (nombre, cargo, correo, sitio web y teléfono). Es un `POST` con palabras clave, ubicación y radio, que devuelve título, ubicación, extracto, fecha y enlace. Costo y términos: no se pudieron confirmar en la página.
- **Careerjet:** clave por sitio publicador, con autenticación básica. Exige enviar `user_ip` y `user_agent`. Devuelve título, empresa, fecha, extracto, ubicación, salario y URL. Soporte de `es_CO`: por confirmar.
- **Uso esperado:** mostrar las ofertas con enlace al original, que es justo lo que hace PrácticasCol. Hay que leer sus términos antes de integrarlas.

### C. Servicio Público de Empleo (SPE) y APE del SENA
- El SISE, la plataforma de toda la red de prestadores (incluido el SENA), **está caído desde el 1 de noviembre de 2026**. El contrato con el operador tecnológico venció el 31 de octubre y no hay fecha de reactivación.
- El Decreto 1823 de 2020 obliga a la interoperabilidad entre prestadores y SISE, pero **no hay una API pública para terceros**.
- **Acción:** seguir la reactivación y, cuando vuelva, pedir acceso a datos a la Unidad Administrativa Especial del SPE.

### Resultado del sondeo de ATS (2026-11-16)
Se consultaron las APIs públicas de unas 100 empresas candidatas con presencia en Colombia.

| Empresa | ATS | Ofertas en Colombia | Prácticas hoy | `robots.txt` del ATS | Decisión |
|---------|-----|---------------------|---------------|----------------------|----------|
| Power Digital Marketing | Greenhouse (`powerdigitalmarketing`) | ~256 (Colombia/LatAm, remotas o Medellín) | ~20 | Permite `/v1/boards` | ✅ Conectar |
| Clara · Cobre · Wizeline | Greenhouse | 33 · 14 · 5 | 0 | Permite | ✅ Vigilar (filtro de prácticas) |
| La Haus · Yuno | Lever | 2 · 3 | 0 | Permite (crawl-delay 1 s) | ✅ Vigilar |
| Addi · Nubank · Belvo · Simetrik | Ashby | 28 · 13 · 3 · 2 | 0 | Responde 401 (nuestra regla lo trata como no permitido) | ⏸️ Decidir excepción documentada si algún día publican prácticas |
| **Evolution** | SmartRecruiters | 30 (Medellín, Bogotá) | **13 en Medellín** | **`Disallow: /` para bots genéricos** | ❌ No automatizar. Seguir por Jooble (socio) o de forma manual |
| Avery Dennison · Endava | SmartRecruiters | 12 (Envigado, Guayabal) · 1 | 1 · 0 | `Disallow: /` | ❌ No automatizar |

Nota de transparencia: el sondeo exploratorio consultó la API de SmartRecruiters (unas 50 peticiones) antes de revisar su `robots.txt`. No se repetirá ni se construirá un conector automático para ese ATS.

## Estimación honesta de cobertura automática
- **Solo con A** (ATS públicos): **20–30 %** de las ofertas útiles del Valle de Aburrá. Hay pocas empresas locales en esos ATS; suelen ser multinacionales y tecnológicas.
- **A + B** (si Jooble o Careerjet aprueban la clave): podría pasar del **60 %**, porque agregan Computrabajo, elempleo y otros portales de forma permitida.
- **Lo demás**, que es Magneto, bolsas universitarias y programas públicos, seguiría siendo manual o vía convenio.

## Plan propuesto
1. **Claude (Opus):** identificar qué empresas del Valle de Aburrá con programas de práctica usan Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee o un feed de SuccessFactors.
2. **Claude (Fable):** construir los adaptadores genéricos de ATS sobre el motor de ingesta, con tests y sin red real en las pruebas.
3. **PO:** cuando el sitio esté publicado en Vercel, pedir las claves de Jooble y Careerjet con sus datos de contacto. Claude construye esos adaptadores tras leer los términos.
4. **PO:** contactar a Magneto (v2) para explorar un convenio.

## Fuentes consultadas
- Servicio Público de Empleo suspende su plataforma (El Espectador): https://www.elespectador.com/economia/servicio-publico-de-empleo-suspende-su-plataforma-y-no-tiene-fecha-de-reactivacion/
- Infobae, 5/11/2026: https://www.infobae.com/colombia/2026/11/05/servicio-publico-de-empleo-suspendio-su-plataforma-el-ministerio-del-trabajo-alerto-por-los-recursos-para-renovar-el-contrato-de-su-operacion/
- Decreto 1823 de 2020: https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=154447
- DataEmpleo (SPE): https://www.serviciodeempleo.gov.co/blog/2024/05/27/dataempleo-la-innovadora-herramienta-del-spe-para-monitorear-el-empleo-en-colombia/
- Jooble REST API: https://jooble.org/api/about · https://jooblehelpcenter.freshdesk.com/en/support/solutions/articles/60001448238-rest-api-documentation
- Careerjet API: https://www.careerjet.im/partners/api
- Comparativa de APIs de ATS: https://dev.to/chaazee/comparing-the-job-posting-apis-of-greenhouse-lever-ashby-smartrecruiters-and-recruitee-2026-4b60
- TheirStack (Computrabajo, precios y términos): https://theirstack.com/es/job-posting-api/data-source/computrabajo · https://theirstack.com/en/docs/pricing/credits · https://theirstack.com/en/docs/legal/terms-and-conditions
- SAP SuccessFactors, feed XML y retiro de RSS: https://userapps.support.sap.com/sap/support/knowledge/en/2428902 · https://userapps.support.sap.com/sap/support/knowledge/en/3743225
