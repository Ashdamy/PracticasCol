# Cómo llenar `convocatorias.csv`

Cada **fila es una convocatoria** y cada **columna un dato**. Escribe los datos como aparecen en la página de la convocatoria: el sistema entiende formatos variados ("$1.750.000", "1,5 millones", "15 de diciembre", "a partir de 8vo semestre"…). **Si un dato no aparece, deja la celda vacía.**

## Abrir y guardar
- **Excel:** abre el archivo con doble clic; cada dato queda en su columna. Al guardar, usa **Archivo → Guardar como → "CSV UTF-8 (delimitado por comas)"**, aunque Excel use `;`: el sistema acepta los dos separadores.
- **Google Sheets:** *Archivo → Importar → Subir*, con separador "Detectar automáticamente". Para guardar: *Archivo → Descargar → Valores separados por comas (.csv)*.
- Borra las 2 filas que empiezan por **"EJEMPLO (borrar)"** antes de cargar las reales.

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
npm run ingest -- --csv ruta\a\tu-archivo.csv --dry-run
```

Te muestra qué entendió de cada fila y cuáles necesitan revisión (fechas no reconocidas, convocatorias vencidas, duplicadas…). `--dry-run` no guarda nada.
