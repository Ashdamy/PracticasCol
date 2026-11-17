-- Reportes de los estudiantes: cuándo se resolvió cada uno (lo llena `npm run admin -- resolver <id>`).
-- Idempotente. Los que ya estaban resueltos quedan con la fecha en null (no se conoce).
alter table issue_reports add column if not exists resolved_at timestamptz;
