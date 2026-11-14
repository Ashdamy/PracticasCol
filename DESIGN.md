---
name: PrácticasCol
description: Directorio de prácticas con tinta bosque, acentos lima y un próximo paso claro.
colors:
  background: "#f8faf7"
  foreground: "#192c25"
  card: "#ffffff"
  muted: "#edf0ea"
  muted-foreground: "#5b6860"
  primary: "#204c3c"
  primary-foreground: "#ffffff"
  border: "#dce3da"
  ring: "#387655"
  lime: "#d5f477"
  positive: "#265936"
  positive-bg: "#eaf4e8"
  warning: "#885219"
  warning-bg: "#fff4df"
  negative: "#923e3e"
  negative-bg: "#fff0ef"
  accent-surface: "#eef3e8"
  forest-panel: "#204c3c"
  panel-foreground: "#f2f7e9"
  panel-muted: "#c4d4c7"
  panel-border: "#52745e"
  dark-background: "#131e19"
  dark-foreground: "#eff4eb"
  dark-card: "#1b2821"
  dark-muted: "#24342b"
  dark-muted-foreground: "#b1c0b2"
  dark-primary: "#d5f477"
  dark-primary-foreground: "#203522"
  dark-border: "#35493b"
  dark-ring: "#d5f477"
  dark-positive: "#c2e8a0"
  dark-positive-bg: "#273e28"
  dark-warning: "#eac28b"
  dark-warning-bg: "#3b301f"
  dark-negative: "#f1b4b4"
  dark-negative-bg: "#382326"
  dark-accent-surface: "#283c2c"
typography:
  display:
    fontFamily: '"Bricolage Grotesque Variable", sans-serif'
    fontSize: "clamp(48px, 5.2vw, 76px)"
    fontWeight: 600
    lineHeight: 1.13
    letterSpacing: "-0.04em"
  headline:
    fontFamily: '"Bricolage Grotesque Variable", sans-serif'
    fontSize: "clamp(32px, 3.3vw, 46px)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  title:
    fontFamily: '"Bricolage Grotesque Variable", sans-serif'
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Urbanist Variable", sans-serif'
    fontSize: "16px"
    lineHeight: 1.5
  label:
    fontFamily: '"Urbanist Variable", sans-serif'
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.4
rounded:
  badge: "5px"
  field: "7px"
  button: "9px"
  initials: "12px"
  row: "14px"
  panel: "16px"
  mobile-starting-point: "20px"
  starting-point: "24px"
  pill: "30px"
spacing:
  compact: "8px"
  row-gap: "12px"
  mobile-edge: "16px"
  row: "24px"
  panel: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
    typography: "{typography.label}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
  button-official:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.dark-primary-foreground}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
  opportunity-row:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.row}"
    padding: "24px"
  search:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.row}"
    padding: "8px 9px 8px 20px"
  quick-filter:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  quick-filter-selected:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  starting-point:
    backgroundColor: "{colors.forest-panel}"
    textColor: "{colors.panel-foreground}"
    rounded: "{rounded.starting-point}"
    padding: "32px"
---

# Design System: PrácticasCol

## Overview

**Creative North Star: "El próximo paso"**

Una identidad cercana que da dirección: titulares Bricolage Grotesque, texto Urbanist, tinta bosque y una señal lima para avanzar. La flecha ascendente de la marca continúa en los enlaces de las convocatorias. El carácter aparece en la tipografía y en las superficies de orientación; los datos conservan un ritmo preciso para comparar.

Este sistema v2 registra el rediseño autorizado por el Product Owner y la implementación efectiva de globals.css, donde prevalecen las últimas reglas. Reemplaza la identidad azul anterior y el modo oscuro automático. El tema inicial es claro; el botón de la cabecera activa explícitamente el oscuro. El español colombiano, el perfil opcional, la trazabilidad y la incertidumbre honesta son compromisos duraderos de PRODUCT.md.

**Key Characteristics:**

- Tinta bosque, lienzo verde casi blanco y acentos lima.
- Títulos expresivos y datos compactos en filas comparables.
- Superficies planas con contornos finos y paneles de orientación verdes.
- Tema claro inicial, oscuro por elección y movimiento reducido respetado.

## Colors

La paleta combina verdes vegetales contenidos con una señal lima luminosa. El frontmatter contiene los valores normativos extraídos del código.

### Primary

`primary` es el bosque de acciones, enlaces y foco contextual. En oscuro, ese rol pasa a lima para conservar contraste. `ring` mantiene el foco distinguible del borde normal.

### Secondary

`lime` marca la flecha de identidad, el fondo de la portada ilustrada y el botón oficial sobre verde. En la portada, «viene.» aparece en una cápsula bosque con texto lima; la sección conserva fondo lima y tinta bosque también en tema oscuro. Los paneles de postulación mantienen el bosque de la identidad también en oscuro; sus textos usan `panel-foreground` y `panel-muted`, con separadores `panel-border`.

### Neutral

`background` es el lienzo verde casi blanco; `card`, la superficie blanca de resultados y controles. `muted` separa bandas y pie. `foreground` sostiene titulares y remuneración; `muted-foreground`, los datos secundarios. `border` organiza sin añadir peso. Los tokens `dark-*` sustituyen los mismos roles bajo `data-theme="dark"`.

Los pares `positive`, `warning` y `negative` con sus fondos comunican elegibilidad y estados; el ámbar también identifica cierres próximos. `accent-surface` sostiene la elegibilidad neutral. Los estados llevan texto y los veredictos, icono.

**The Tema elegido Rule.** Sin preferencia guardada se usa claro. La elección explícita se guarda en `localStorage.pc_theme` y se restaura antes de pintar; el control lee el tema efectivo de `html[data-theme]` al montar y sincroniza cambios entre pestañas. Si el navegador bloquea el almacenamiento, el botón sigue funcionando durante la visita. No se hereda prefers-color-scheme.

## Typography

**Display Font:** Bricolage Grotesque Variable, con respaldo sans-serif.

**Body Font:** Urbanist Variable, con respaldo sans-serif. Ambas familias se importan localmente desde `@fontsource-variable` en el layout.

Bricolage aporta identidad a títulos, marca y enlaces de convocatoria. Urbanist mantiene legibles controles, metadatos y párrafos. Los títulos equilibran saltos de línea; el cuerpo conserva una lectura tranquila.

El rol `display` corresponde a la portada; `headline`, a la cabecera de catálogo; `title`, a las filas. En móvil la portada usa `clamp(38px, 10vw, 64px)` con interlineado (1.16); el catálogo usa (31px) y el título de fila, (20px). Los metadatos de fila son (12–13px) en escritorio y (11–12px) en móvil; el aviso de requisitos conserva (11px). El detalle limita lectura a (70ch) y usa interlineado (1.75).

**The Dos voces Rule.** Bricolage identifica y orienta; Urbanist explica y permite operar. No introducir otra familia para etiquetas o cifras. La compensación usa números tabulares.

## Layout

Contenedor centrado de máximo (1200px), descontando (80px) del viewport. A (1100px) o menos descuenta (48px); a (767px) o menos, (32px). La cabecera mide al menos (84px), o (72px) en móvil, donde oculta navegación central y conserva marca, tema y perfil.

El catálogo combina filtros de (208px), espacio de (32px) y una columna flexible de resultados. En escritorio compacto los filtros pasan a (188px) y el espacio a (24px). Las oportunidades son filas apiladas separadas (12px). El avatar ocupa una columna corta; el contenido distribuye organización y cierre, título, metadatos, veredicto y remuneración, fuente y verificación. En móvil el drawer reemplaza los filtros laterales; organización y cierre se apilan y la remuneración pasa debajo del veredicto. El buscador conserva entrada y botón en una línea con entrada flexible. La cabecera móvil del catálogo reduce el espacio vertical a (20px 18px). Conteo y orden permanecen en una fila y el texto auxiliar de resultados se oculta. La invitación al perfil dentro de resultados también se oculta en móvil para adelantar la primera oferta; Mi perfil sigue accesible en la cabecera.

La portada combina título a la izquierda y búsqueda a la derecha sobre una superficie lima; una ilustración original panorámica ocupa la parte inferior y los accesos por nivel forman una franja al pie. En móvil se apilan en orden: título, búsqueda, ilustración y accesos. La composición concreta vive en `.impeccable/surfaces/home.md` y se implementa en `src/components/home-hero.tsx` y `home-hero.css`. La imagen y su prompt/origen se guardan en `public/images/students-first-step.webp` y su sidecar JSON. El detalle usa contenido flexible y una columna de (350px), reducida a (320px) antes de apilarse en móvil. El perfil y las páginas de lectura mantienen ancho contenido.

## Elevation & Depth

Superficies planas: contornos, contraste tonal y espacios dan jerarquía. La implementación no usa sombras. Las filas ascienden (2px) y toman borde primario en hover; su flecha avanza (2px) hacia arriba y derecha. Los botones ascienden (1px) en hover y descienden (1px) al pulsar.

El drawer usa overlay en nivel (40) y panel en (50); el enlace para saltar al contenido ocupa (100). La entrada de elementos marcados desplaza (8px) durante (0.5s); el skeleton pulsa durante (1.5s). `prefers-reduced-motion: reduce` elimina animaciones y transiciones y desactiva desplazamiento suave.

**The Profundidad por contraste Rule.** Separar con tono y borde; reservar el movimiento breve para comunicar entrada, interacción o carga.

## Shapes

Filas y buscador comparten esquinas amplias pero contenidas (`row`); los paneles de detalle usan `panel`. La portada ilustrada es una superficie continua sin contenedor redondeado; usa una cápsula para destacar una palabra. El patrón `starting-point` se conserva como referencia del panel anterior y ya no se usa en la portada. Botones y campos usan radios pequeños; filtros rápidos y perfil usan cápsulas. La marca es una flecha dentro de un círculo lima. Los avatares muestran iniciales de la organización con fondos suaves por tipo de convocatoria.

## Components

### Buttons

Variantes primaria, contorno y transparente con altura mínima (46px). La acción oficial del panel verde usa lima. Hover reduce brillo en la primaria; active responde al pulso. Disabled usa opacidad (0.6) y cursor no disponible. Foco global: contorno (3px), separación (4px) y token `ring`.

### Cards / Containers

La fila de oportunidad es el patrón de resultados vigente. Padding (24px), (20px) en escritorio compacto y (18px 16px) en móvil. El título enlazado lleva flecha; la remuneración destaca junto al veredicto. El pie separado por borde mantiene fuente y fecha de verificación también en móvil. La oportunidad vencida conserva su aviso; las retiradas siguen el contrato.

El panel verde de acceso por formación ofrece enlaces reales con separadores horizontales; la flecha avanza (4px) en hover. El panel de postulación reutiliza ese contraste y lleva a la convocatoria oficial.

### Inputs / Fields

Campos con etiqueta, fondo `card`, borde `border` y altura mínima (44px). El buscador agrupa icono, entrada y botón; su `focus-within` usa contorno (2px) separado (3px). Los errores se explican con texto junto al campo. Conservar semántica nativa de selects, checkboxes y botones.

### Chips

Los filtros rápidos son cápsulas de contorno; el seleccionado invierte `foreground` y `background`. Altura mínima (40px) en escritorio y (44px) en móvil. Los filtros activos son enlaces con etiqueta accesible para quitar solo ese criterio y conservar el resto de la URL. Los badges informativos no simulan controles.

### Navigation

La marca lleva al inicio. Los enlaces de escritorio muestran un subrayado creciente en hover; perfil usa cápsula y tema, botón de icono. Su nombre accesible alterna «Activar tema oscuro» y «Activar tema claro». «Saltar al contenido» aparece al recibir foco.

### Filters / Drawer / Eligibility

Filtros con fieldsets, legends, checkboxes y conteos. El drawer móvil usa Dialog de Radix con título, descripción, cierre explícito, desplazamiento interno y ancho máximo (440px). Filas de selección móviles mínimas (44px). Aplicar lleva los filtros a la URL y comunica espera.

El veredicto lleva texto e icono, con «Confirma los requisitos en la convocatoria oficial» debajo. Fuente, verificación y advertencia de catálogo ficticio cuando hay mocks forman parte visible de la experiencia.

## Do's and Don'ts

### Do:

- **Do** reutilizar los roles semánticos y verificar los dos temas.
- **Do** mantener fuente, verificación y aviso de requisitos en cada oportunidad.
- **Do** usar Bricolage para orientación y Urbanist para lectura y controles.
- **Do** conservar foco visible, etiquetas y controles cómodos en móvil.
- **Do** respetar la preferencia de movimiento reducido.

### Don't:

- **Don't** recuperar el azul anterior ni activar el oscuro automáticamente.
- **Don't** convertir los resultados en una cuadrícula de tarjetas grandes.
- **Don't** comunicar elegibilidad únicamente con color ni presentarla como garantía.
- **Don't** añadir sombras o logotipos ficticios como parte de este sistema.
