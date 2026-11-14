# Fuentes candidatas de convocatorias — Valle de Aburrá

> Investigación de Claude, 2026-11-14. **Pendiente de validación del PO** (§12 y §16 de AGENTS.md).
> Ninguna fuente se automatiza hasta revisar sus términos de uso. Mientras tanto, todo entra por **carga manual (CSV)** con enlace al original.

## Resumen

| # | Fuente | Tipo | Qué publica | Cómo cargarla hoy | ¿Automatizable? |
|---|--------|------|-------------|-------------------|-----------------|
| 1 | **Alcaldía de Medellín, Centro de Prácticas** | Pública | Convocatoria semestral, modalidades *Excelencia* y *Específica* | Manual: 1 fila por modalidad y semestre | Posible: robots.txt no bloquea `/es/secretaria-de-gestion-humana/...`. Falta revisar términos. Volumen bajo, no vale la pena |
| 2 | **Gobernación de Antioquia, Practicantes de Excelencia** (centrodepracticas.antioquia.gov.co) | Pública | Convocatoria semestral, más de 260 plazas | Manual | Sin revisar |
| 3 | **Estado Joven** (MinTrabajo, Función Pública y Servicio Público de Empleo) | Pública, nacional | Prácticas en entidades públicas, hasta 5 meses, presenciales, sin salud | Manual, filtrando Antioquia | Sin revisar |
| 4 | **Servicio Público de Empleo** (buscadordeempleo.gov.co) | Pública | Vacantes, incluidas plazas de Estado Joven | Manual | **Candidata prioritaria** a feed o API oficial. robots.txt no verificable (error de certificado) |
| 5 | **Agencia Pública de Empleo del SENA** (ape.sena.edu.co) | Pública | Contratos de aprendizaje y vacantes | Manual (la postulación exige registro del estudiante; nosotros solo enlazamos) | Sin revisar. No entrar a zonas con login |
| 6 | **Magneto365** | Privada | La plataforma más usada en Medellín: EAFIT, Comfama, Davivienda, Bold, TCC, Corona, Éxito, Alkosto… | **Solo manual + enlace** | robots.txt permite `/co/empleos` (prohíbe URLs con `?`), pero **no se revisaron sus términos y condiciones** → no automatizar |
| 7 | **Computrabajo** | Privada | Avisos de "aprendiz SENA" y prácticas en Antioquia | Solo manual + enlace | No (portal privado) |
| 8 | **Oficinas de prácticas de las universidades** (UdeA, EAFIT, UPB, ITM, Poli JIC, Pascual Bravo, TdeA…) | Institucional | Ofertas para sus estudiantes | Manual, solo lo que sea **público** | No: casi siempre requieren login de estudiante (prohibido por D2) |
| 9 | **Páginas de carreras de empresas** (Bancolombia, EPM, Grupo Éxito, Sura, Nutresa, Metro de Medellín…) | Privada | Prácticas y aprendices | Manual + enlace | Caso por caso. Algunas usan ATS con tableros públicos |

## Hallazgos clave

1. **Las convocatorias públicas grandes son estacionales.** La Alcaldía (2027-1) cerró el **30 de octubre de 2026** y la Gobernación (2027-1) el **20 de octubre de 2026**. Las del segundo semestre suelen abrir hacia abril o mayo (por confirmar cada año).
   → **Idea de producto (v2):** un "calendario de convocatorias recurrentes" con aviso de apertura. Para el estudiante vale tanto saber *cuándo abren* como ver las abiertas.
2. **Magneto365 concentra la mayoría de prácticas corporativas de Medellín.** Por D2 la usamos **solo con carga manual y enlace**, hasta revisar sus términos (https://www.magneto365.com/co/politicas).
3. **Las bolsas universitarias casi siempre están detrás de un login.** No se pueden recolectar automáticamente. Si una universidad quiere estar, la vía es un **convenio o feed** (fuera del MVP).
4. **Para automatizar primero, la mejor candidata es el Servicio Público de Empleo** (fuente oficial y nacional). Hay que confirmar si ofrece datos abiertos o API.

## Datos de las convocatorias públicas (para cargarlas como recurrentes)

| Programa | Requisitos | Apoyo económico | Último ciclo encontrado |
|----------|------------|-----------------|-------------------------|
| Alcaldía de Medellín, *Excelencia* | Técnico, tecnólogo o profesional de una IES del Valle de Aburrá; promedio ≥ 3,8; carta de la institución | 1 SMMLV (tiempo completo) | 2027-1, inscripciones hasta 30/10/2026 |
| Alcaldía de Medellín, *Específica* | Matriculado, sin promedio mínimo; afiliado a salud | Subsidio equivalente al auxilio de transporte | 2027-1 |
| Gobernación de Antioquia, *Practicantes de Excelencia* | Promedio ≥ 3,8; matriculado durante la práctica; no haber sido beneficiario antes | Por confirmar | 2027-1: inscripción 23/09–20/10/2026; práctica 01/02–30/06/2027 |
| Estado Joven | Jóvenes en formación; plazas presenciales | Por confirmar | Fechas inconsistentes en las fuentes; verificar en Función Pública |

## Próximos pasos sugeridos
1. **PO:** revisar los términos de Magneto365, del Servicio Público de Empleo y de la APE del SENA, y marcar en la tabla cuáles se pueden usar y cómo.
2. **PO:** cargar entre 100 y 200 convocatorias abiertas en `ingestion/templates/convocatorias.csv`, empezando por Magneto, Computrabajo, la APE y las páginas de empresas, y validarlas con `npm run ingest -- --csv <archivo> --dry-run`.
3. **Claude:** cuando el PO apruebe una fuente para automatizar, escribir su adaptador en `ingestion/adapters/`.

## Fuentes consultadas
- Alcaldía de Medellín, Centro de Prácticas: https://www.medellin.gov.co/es/secretaria-de-gestion-humana/centro-de-practicas/inscripcion-estudiantes-centro-de-practicas-de-la-alcaldia-de-medellin/
- RCN Radio, prácticas 2027-1 de la Alcaldía: https://newsroom.rcnradio.com/colombia/practicas-profesionales-en-la-alcaldia-de-medellin-asi-puedes-postularte
- Alcaldía de Medellín, 147 cupos (2026-1): https://www.medellin.gov.co/es/sala-de-prensa/noticias/la-alcaldia-de-medellin-abre-147-oportunidades-dirigidas-a-estudiantes-para-que-hagan-sus-practicas/
- Telemedellín, Practicantes de Excelencia 2027-1: https://telemedellin.tv/?p=197824
- Gobernación de Antioquia, Practicantes de Excelencia: https://antioquia.gov.co/index.php/articulos-general/practicantes-de-excelencia
- Función Pública, Estado Joven: https://www1.funcionpublica.gov.co/web/estado-joven
- El Colombiano, prácticas 2026 (empresas en Magneto): https://www.elcolombiano.com/empleos/contenidos/estudiantes-practicas-profesionales-2026-colombia-CJ29642176
- Magneto365, políticas: https://www.magneto365.com/co/politicas
- Computrabajo, aprendices SENA en Antioquia: https://co.computrabajo.com/trabajo-de-aprendiz-productivo-sena-en-antioquia
- Bancolombia, aprendices: https://www.bancolombia.com/acerca-de/sala-prensa/noticias/responsabilidad-social-ambiental/trabajo-para-aprendices-tecnicos-tecnologos
