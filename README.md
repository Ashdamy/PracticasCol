# PrácticasCol

Prácticas profesionales, pasantías, prácticas empresariales y contratos de aprendizaje del Valle de Aburrá, en un solo buscador.

> El contexto completo del proyecto (producto, decisiones, arquitectura, contrato y reparto de responsabilidades) está en **[AGENTS.md](AGENTS.md)**.

## Arranque

```bash
npm install
cp .env.example .env.local   # opcional: por defecto se usan datos de prueba
npm run dev                  # http://localhost:3000
```

| Script | Qué hace |
|--------|----------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run check` | Tipos + lint + tests |
| `npm test` | Tests unitarios (Vitest) |

Requiere Node 24 o superior. Mientras `USE_MOCKS=true` (el valor por defecto), la app usa datos ficticios de `src/lib/mocks` y no necesita base de datos.
