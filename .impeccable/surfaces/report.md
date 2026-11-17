# Reportar un problema

Modo: Operate. Ampliación del detalle existente, conservando la identidad bosque/lima.

- Entrada junto a fuente y verificación, tanto en convocatorias abiertas como vencidas.
- Diálogo Radix con motivo obligatorio y comentario opcional (500 caracteres). No solicita datos personales y pide omitirlos del texto libre.
- Usa `ISSUE_REASON_LABELS` y la acción `reportIssue`. No incorpora lógica de persistencia ni consultas nuevas.
- Motivo sospechoso: aviso «Una práctica nunca debe cobrar». Éxito: «Gracias, lo revisaremos».
- Errores asociados al campo, foco después de habilitarlo y comentario conservado para reintentar. Al corregir un campo desaparece su error. Errores generales y de conexión en región de alerta.
- Envío pendiente bloquea controles y duplicados, incluso al cerrar con Escape y reabrir. El cierre sigue disponible; el resultado se conserva al reabrir.
- Foco inicial en motivo, atrapado en el diálogo y restaurado al disparador al cerrar. Confirmación enfocada después del éxito.
- Superficie de máximo 520 px, márgenes de 16 px, alto limitado al viewport con scroll interno; acciones apiladas en móvil. Campos a 16 px y controles de al menos 44 px. Tema claro/oscuro con los tokens existentes.

Validación: e2e de teclado, 320/390/1440 px, comentario vacío y límite, doble envío, validación real de la acción, convocatoria ausente, desconexión y recuperación. Reportes enviados solo al repositorio de mocks durante las pruebas.
