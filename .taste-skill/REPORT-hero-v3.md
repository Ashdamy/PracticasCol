# Portada ilustrada

GATE: ERROR previo de la sesión; no se repite ni se declara aprobación del gate.

Alcance: refinamiento del hero de `/` dentro de la identidad aprobada. Referencia solicitada: https://dribbble.com/shots/19052386-Edtech-Landing-Page-Design-for-Online-Learning-Brands. Composición adaptada, sin reutilizar ilustraciones, texto ni código del referente.

- Tipos, lint y 29 tests unitarios verdes; build Next 16 correcto, Suspense conservado.
- 6 e2e verdes: incluye portada con imagen cargada, búsqueda, enlaces por nivel, tema oscuro y ausencia de desbordamiento de 320 a 1912 px.
- Capturas de la portada inspeccionadas en 390, 820, 1440 y 1912 px; `.impeccable/review/hero-v3-*.png`.
- Detector de layout: `[]`.
- Revisión independiente: sin correcciones visuales materiales; pidió sincronizar las descripciones de portada en DESIGN.md, ya actualizadas. No es una auditoría WCAG completa.
- Raster original generado con imagegen integrado: `public/images/students-first-step.webp`, prompt completo en el sidecar JSON. `embed-prompt --scan public/images`: 1 raster, 0 missing. No representa estudiantes reales ni resultados comerciales.
- Sin nuevas dependencias. La superficie ilustrada conserva fondo lima y tinta bosque en ambos temas; controles con foco visible y movimiento reducido respetado.
- Sin medición nueva de rendimiento en red 4G; peso local del WebP: 172444 bytes, dimensiones intrínsecas y `sizes` en next/image.
