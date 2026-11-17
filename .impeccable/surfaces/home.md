# Portada: primer paso

Modo: Persuade. Refinamiento de la identidad bosque/lima aprobada por el PO; alcance limitado a la sección de apertura de `/`.

THESIS: La búsqueda de prácticas se presenta como un primer paso compartido con otros estudiantes.

OWN-WORLD: Conserva Bricolage Grotesque, Urbanist y bosque/lima. La apertura lleva fondo lima y tinta bosque, incluso en tema oscuro, con búsqueda clara y palabra destacada sobre bosque.

STORY: Leer qué ofrece PrácticasCol, buscar sin registro o empezar por el nivel de formación. La ilustración es narrativa, no una prueba de colocaciones ni una foto de usuarios.

FIRST VIEWPORT: Título a la izquierda y descripción/búsqueda a la derecha; ilustración panorámica original debajo; accesos reales por nivel al pie. En móvil: título, búsqueda, ilustración y accesos apilados.

FORM: Extensión del sistema existente solicitada por el PO: «okey me gusta pero me gustaria que hicieras esta parte de la landing tomando en cuenta esta referencia». Referencia de composición: https://dribbble.com/shots/19052386-Edtech-Landing-Page-Design-for-Online-Learning-Brands. Consultada y descargada en `.impeccable/reference/monac.png` solo para estudio. Se toma la jerarquía título/búsqueda/escena; se mantiene la identidad previamente aprobada. No se copia la ilustración ni el contenido del referente.

## Imagen

`public/images/students-first-step.webp`: ilustración original generada con la herramienta integrada imagegen; estudiantes ficticios colaborando. Transparente, 1600 × 594 px, aproximadamente 169 KiB. El prompt completo se conserva en `students-first-step.webp.json` (sidecar del comando embed-prompt para WebP). Fuente PNG conservada por la herramienta en `.codex/generated_images/01a1d65e-d2cb-7a33-9410-1f241d462bbe/exec-2b30009c-6262-445d-8c00-ca5b42f83eeb.png`.

La imagen usa `next/image`, dimensiones intrínsecas, `sizes` responsive y `preload`. No añade JavaScript de animación ni dependencias. El componente es de servidor y reutiliza SearchBox.

## Oportunidades bajo la apertura

`getHomeData()` se consulta una sola vez dentro de Suspense. «Recién publicadas» conserva las seis ofertas de `recent` en su orden, aunque no tengan fecha de cierre. Tiene prioridad al eliminar duplicados por ID: el bloque de cierres muestra hasta cuatro ofertas de `closingSoon` que no estén en recientes y desaparece completo si no queda ninguna. La sección de recientes siempre está presente; si ambas listas están vacías, ofrece un estado vacío con enlace a `/practicas`. Reutiliza las filas, espaciado y temas existentes.
