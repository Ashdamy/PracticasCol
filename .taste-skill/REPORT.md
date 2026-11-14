# Verificación del diseño

GATE: ERROR (timeout del navegador; no se pudieron completar copy-lint, consistency ni layout-check). El gate no se repitió, según la instrucción de la skill.

Las primeras capturas contra el servidor en recarga quedaron inválidas y se reemplazaron. Capturas actuales en `.impeccable/review/`: catálogo escritorio 1440, catálogo móvil 390 y detalle móvil 390; se abrieron para inspección. El sistema del navegador usa tema oscuro. No hay captura visual independiente del tema claro.

Modo Operate. Paleta del dealer `white-link-blue`, Urbanist local. El encargo delega identidad y exige datos por petición, por lo que se mantienen Next/Suspense y layouts de búsqueda; no se aplican export estático, héroes a pantalla completa, fotos, shaders ni secciones de marketing. Ninguna exención técnica oculta al checker.

Voz: español colombiano, tuteo directo; cifras y estados provienen del contrato. Las organizaciones del catálogo son ficticias y se identifican como demostración. Sin estadísticas inventadas, nombres nuevos, fotografías de terceros, formularios de contacto de ejemplo ni activos pendientes del cliente.

Detector impeccable: `[]`, sin hallazgos. E2E valida filtros móviles y cierre con Escape, URL y chips, vacío, paginación, navegación al detalle, enlace oficial, perfil/cookie, vencida, 404 y overflow entre 320 y 1440. Esto no sustituye una auditoría WCAG completa ni una medición de Core Web Vitals con 4G.

Revisión independiente final: **ship**, sin correcciones materiales solicitadas. Revisó catálogo 1440/390 y detalle 390. Drawer, chips y veredictos con perfil cuentan con evidencia de código/e2e, sin captura visual específica.

Rendimiento medido de nuevo sobre `next start`, después del fallo por JavaScript de desarrollo: **0 FAIL, 2 WARN** (una advertencia por tamaño de JS parseado en cada ancho). Transferencia total 282–285 KiB; JS comprimido 196 KiB, parseado 640 KiB; fuente 27,4 KiB; CLS 0–0,001. Medición local sin limitación de red; no representa 4G ni métricas de campo.

Estado final: `npm run check` verde (tipos, lint, 29 pruebas), `npm run build` verde y 4 e2e verdes. Servidor de producción disponible en `http://localhost:3000`; para volver a desarrollo, detenerlo y ejecutar `npm run dev`.
