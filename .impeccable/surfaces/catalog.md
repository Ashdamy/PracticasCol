# Catálogo y detalle

Modo: Operate; inicio con intención de descubrimiento. Rediseño autorizado por el PO tras rechazar la identidad anterior por genérica. Conservar lógica, contratos, Suspense y flujos.

## Direction contract

THESIS: El primer empleo como punto de partida: una entrada con personalidad y un directorio que deja comparar oportunidades sin recorrer tarjetas enormes.

OWN-WORLD: Títulos Bricolage Grotesque, cuerpo Urbanist, fondo verde casi blanco, tinta bosque y acento lima. La marca del PO combina birrete y cuaderno abierto, con wordmark prácticascol. en Bricolage Grotesque trazado. Tema claro inicial y selector de oscuro.

STORY: Encontrar por lo que estudias, comparar compensación y cierre, entender requisitos y salir a la fuente oficial. Perfil académico siempre opcional.

FIRST VIEWPORT: Inicio en dos partes: título grande y búsqueda a la izquierda; panel verde con accesos reales por nivel a la derecha. Catálogo con encabezado compacto, buscador, accesos por tipo, filtros a la izquierda y resultados en filas. En móvil las filas apilan remuneración, veredicto y trazabilidad, con drawer accesible.

FORM: Directorio de convocatorias, tipografía expresiva y controles familiares. seed: none (pinned). El PO pidió tomar referencias de Dribbble, Uiverse, shadcn, Mobbin y Recent, manteniendo la idea de PrácticasCol. No se copia material de terceros.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Referencias consultadas

- https://dribbble.com/search/chatgpt-web — jerarquía de apertura y combinación de identidad con demostración; shot Claro de Afterglow inspeccionado como imagen.
- https://uiverse.io/ — respuestas de controles a hover/press; sin incorporar código de terceros.
- https://ui.shadcn.com/ — agrupación de datos, campos y controles contenidos; captura full-light inspeccionada.
- https://mobbin.com/ — navegación y enfoque en tareas; página pública, sin contenido privado.
- https://recent.design/ — contraste de escala, identidad y composición; referencia pública inspeccionada.

Las imágenes descargadas en .impeccable/reference son estudio y nunca se sirven desde public. Sin fotos, gráficos o claims inventados en el producto.

## Logos de organizaciones · 2026-11-19

Tarjeta, fila y detalle comparten `OrganizationLogo`: cuadrado reservado de 46 px (35 px en móvil), imagen completa con `object-fit: contain` y 5 px de aire. Fondo blanco también en oscuro para conservar los colores de la marca. El nombre sigue al lado; imagen decorativa con alt vacío. Carga directa diferida desde la URL del contrato, sin optimizador ni supresión de Referer. Si falta o falla, conserva las iniciales y los tonos actuales sin cambio de tamaño; una URL diferente vuelve a intentarse.

Revisión: capturas de tarjeta/fila en 390 y 1440 px, claro/oscuro, y detalle móvil con respaldo. Sin desbordamiento en 320, 390 y 1440 px. Check (522 tests), 22 e2e y build verdes. Las pruebas de logos usan fixtures interceptadas, sin descargar ni almacenar marcas de Brandfetch. Resultado: listo para revisión del PO.
