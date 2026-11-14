# Cómo llenar la plantilla de convocatorias

La vía recomendada es **`convocatorias.xlsx`** (Excel). Se abre igual en cualquier computador, sin importar si tu Excel separa por coma o por punto y coma.

Cada **fila es una convocatoria** y cada **columna un dato**. Escribe los datos como aparecen en la página de la convocatoria: el sistema entiende formatos variados ("$1.750.000", "1,5 millones", "15 de diciembre", "a partir de 8vo semestre"…). **Si un dato no aparece, deja la celda vacía.**

## Con Excel (recomendado)
1. Haz una copia de `convocatorias.xlsx` y ábrela con doble clic. Se abre en la hoja **Convocatorias**; la hoja **Instrucciones** trae esta misma guía.
2. Borra las 2 filas grises que empiezan por **"EJEMPLO (borrar)"**.
3. Llena una fila por convocatoria. Ayudas que trae la plantilla:
   - La fila de títulos queda fija al bajar y tiene filtros.
   - En `tipo`, `nivel`, `municipio` y `modalidad` hay una **lista desplegable** (la flecha a la derecha de la celda). También puedes escribir: en `nivel` van varios separados por coma, y si `tipo` o `modalidad` no están en la lista, Excel pregunta y te deja continuar.
   - Al pasar el cursor por cada título aparece una **nota** con qué va ahí y ejemplos.
   - Las celdas están en formato de texto: lo que escribes queda tal cual (Excel no te cambia fechas ni montos).
4. No cambies los nombres de la fila 1 ni el nombre de la hoja **Convocatorias**.
5. Guarda normal (**Ctrl + G** o *Archivo → Guardar*), como libro de Excel **.xlsx**. No hace falta convertir a CSV.

También sirve en Google Sheets: sube el .xlsx, edítalo y descárgalo con *Archivo → Descargar → Microsoft Excel (.xlsx)*.

## Alternativa: CSV
Si prefieres no usar Excel, está `convocatorias.csv` (separado por comas, UTF-8).
- **Google Sheets:** *Archivo → Importar → Subir*. Para guardar: *Archivo → Descargar → Valores separados por comas (.csv)*.
- **Excel:** solo se ve bien con doble clic si tu Excel separa por coma. Si todo te queda en la columna A, usa mejor el .xlsx. Al guardar: *Guardar como → "CSV UTF-8 (delimitado por comas)"*.
- Al leerlo, el sistema acepta coma o punto y coma como separador.

## Columnas

| Columna | Qué poner | Ejemplos |
|---------|-----------|----------|
| `titulo` | Nombre del cargo o de la práctica | Practicante de Mercadeo |
| `organizacion` | Empresa o entidad que ofrece | Alcaldía de Medellín |
| `tipo` | Tipo de oportunidad | Práctica profesional · Práctica empresarial · Pasantía · Contrato de aprendizaje · Judicatura |
| `nivel` | Nivel de formación que piden (puede ser más de uno) | Universitario · Tecnólogo · Técnico profesional · Técnico laboral · Posgrado |
| `municipio` | Dónde se hace | Medellín · Itagüí · Envigado · Remoto |
| `modalidad` | Forma de trabajo | Presencial · Híbrida · Remota |
| `pago` | Cuánto o qué tipo de pago | $1.750.000 · Apoyo de sostenimiento · 1 SMMLV · No remunerada |
| `duracion` | Cuánto dura | 6 meses · 4 a 6 meses · un semestre |
| `fecha_limite` | Último día para postularse | 30 de noviembre de 2026 · 30/11/2026 · Hasta agotar cupos |
| `fecha_inicio` | Cuándo empieza (opcional) | 1 de febrero de 2027 · enero 2027 |
| `descripcion` | **Resumen tuyo** de 2 o 3 frases. No copies el texto completo de la fuente | Apoyo al equipo de mercadeo digital en campañas y análisis de métricas. |
| `programas` | Carreras que piden; escribe "y afines" si lo dice | Mercadeo, Administración y afines · Cualquier carrera |
| `semestre` | Semestre mínimo o rango | A partir de 7° semestre · Entre 6 y 9 semestre · Egresados |
| `requisitos` | Otros requisitos, separados por `;` | Inglés B1; Excel intermedio |
| `instituciones` | Solo si es **exclusiva** de ciertas instituciones; si no, vacío | UdeA, EAFIT |
| `enlace_postulacion` | Enlace donde el estudiante se postula | https://… |
| `enlace_fuente` | Página donde encontraste la convocatoria (puede ser el mismo enlace) | https://… |

## Revisar el archivo
En la terminal, desde la carpeta del proyecto:

```powershell
npm run ingest -- --xlsx ruta\a\tu-archivo.xlsx --dry-run
```

Con CSV es igual, cambiando `--xlsx` por `--csv`. Si no quieres pensar en cuál usar, `--archivo ruta\a\tu-archivo.xlsx` elige según la extensión.

Te muestra qué entendió de cada fila y cuáles necesitan revisión (fechas no reconocidas, convocatorias vencidas, duplicadas…). `--dry-run` no guarda nada.

## Regenerar las plantillas
`convocatorias.xlsx` y `convocatorias.csv` se generan con `npm run template:xlsx` (script `build-template.ts`). Si cambian las columnas o los ejemplos, se edita el script y se vuelve a generar; no se editan a mano.
