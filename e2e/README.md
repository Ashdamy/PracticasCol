# Pruebas de interfaz

Con `npm run dev` en un terminal, ejecutar `npx playwright test e2e/catalog.spec.ts --browser chromium --workers 1` en otro. Usa el Chrome instalado (`channel: chrome`), sin descargar Chromium. Para otro puerto: `PLAYWRIGHT_BASE_URL=http://localhost:3001`.

Suite completa: `npx playwright test e2e --browser chromium --workers 1`. Incluye portada y ajustes de revisión: metadatos por oferta (también para bots), tema persistente o almacenamiento bloqueado, aviso de perfil, programas fuera de la institución y copy de semestre/cierre. `test-results/` está excluido de Git.

Cubre filtros móviles y Escape, URL y chips, vacío, paginación, detalle y enlace oficial, perfil y borrado de cookie, oportunidad vencida, 404 y desbordamiento a 320, 390, 768, 1024 y 1440 px.
