# Marca PrácticasCol

Adaptación de los SVG entregados por el Product Owner en `public/images/` (`practicascol-cuaderno-*` y duplicados sin prefijo). Esos originales se conservan sin cambios.

- `symbol.svg`: birrete y cuaderno abierto; geometría limpia de dos colores, `#204c3c` y `#d5f477`.
- `logo.svg`: lockup horizontal para fondos claros, 492 × 100.
- `logo-dark.svg`: lockup para fondos oscuros, con wordmark lima y contorno del símbolo para separarlo del fondo.

El wordmark dice exactamente **prácticascol.**, compuesto en Bricolage Grotesque (peso 800), convertido a trazados. Incluye la tilde y el punto. Los SVG no requieren fuentes, imágenes embebidas, scripts, filtros ni recursos externos. La licencia de Bricolage Grotesque se conserva en `FONT-LICENSE.txt`.

La cabecera y el footer usan los lockups con selección por `html[data-theme]`. El nombre accesible está en el enlace; las imágenes internas son decorativas para evitar anuncios duplicados.

## Iconos y metadatos

- `src/app/icon.svg`: variante simplificada del símbolo para tamaños pequeños.
- `src/app/favicon.ico`: el mismo símbolo a 16, 32 y 48 px; sustituye el favicon del scaffold.
- `src/app/apple-icon.png`: 180 × 180 px, opaco, con margen interior.
- `src/app/opengraph-image.png`: 1200 × 630 px, logo y textos de PrácticasCol sobre bosque.
- `src/app/opengraph-image.alt.txt`: descripción para compartir.

Regeneración: `node src/components/brand/generate-assets.mjs`, desde la raíz. Usa Sharp y el lector de fuentes incluidos en la instalación actual de Next; no se añade código de generación al bundle del navegador. El archivo fuente del wordmark proviene del paquete local `@fontsource-variable/bricolage-grotesque`. No se utilizó generación de imágenes con IA para esta adaptación vectorial.
