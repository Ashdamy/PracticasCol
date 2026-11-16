-- PrácticasCol · esquema inicial (AGENTS.md §13)
-- Se aplica con `npx supabase db push`. El catálogo (municipios, instituciones, programas, NBC y fuentes)
-- va en la migración 20261116000000_catalog.sql, generada con `npm run db:catalog`.
-- Es idempotente donde es razonable (if not exists / drop … if exists), para poder re-ejecutarla sin daño.
-- El modelo en TypeScript está en src/server/domain/types.ts y el mapeo fila ↔ registro en
-- src/server/repo/supabase-mappers.ts.

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Enums del dominio (valores = src/lib/contracts/enums.ts)
-- ---------------------------------------------------------------------------
do $$ begin create type opportunity_type as enum ('practica_profesional','practica_empresarial','pasantia','contrato_aprendizaje','judicatura'); exception when duplicate_object then null; end $$;
do $$ begin create type education_level as enum ('tecnico_laboral','tecnico_profesional','tecnologo','universitario','posgrado'); exception when duplicate_object then null; end $$;
do $$ begin create type modality as enum ('presencial','hibrida','remota'); exception when duplicate_object then null; end $$;
do $$ begin create type sector as enum ('privado','publico','mixto','ong'); exception when duplicate_object then null; end $$;
do $$ begin create type compensation_type as enum ('salario','apoyo_sostenimiento','auxilio','sin_remuneracion','no_especificado'); exception when duplicate_object then null; end $$;
do $$ begin create type deadline_type as enum ('fecha','hasta_agotar_cupos','no_publicada'); exception when duplicate_object then null; end $$;
do $$ begin create type opportunity_status as enum ('borrador','en_revision','publicada','vencida','retirada'); exception when duplicate_object then null; end $$;
do $$ begin create type source_method as enum ('api','scraping','manual'); exception when duplicate_object then null; end $$;
do $$ begin create type issue_reason as enum ('vencida','enlace_roto','datos_incorrectos','sospechosa','otro'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------------
create table if not exists municipalities (
  slug        text primary key,
  name        text not null,
  dane_code   char(5) not null unique,
  metro       boolean not null default true
);

create table if not exists knowledge_areas (
  id    text primary key,           -- p. ej. 'nbc-ing-sistemas'
  name  text not null
);

create table if not exists institutions (
  id          text primary key,
  name        text not null,
  short_name  text not null,
  sector      text not null check (sector in ('publica','privada')),
  snies_code  text
);

create table if not exists programs (
  id                 text primary key,
  name               text not null,
  level              education_level not null,
  knowledge_area_id  text not null references knowledge_areas(id)
);

create table if not exists institution_programs (
  institution_id  text not null references institutions(id) on delete cascade,
  program_id      text not null references programs(id) on delete cascade,
  primary key (institution_id, program_id)
);

-- ---------------------------------------------------------------------------
-- Organizaciones y fuentes
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- Nombre comparable (sin tildes, puntuación ni "S.A.S."): lo calcula la ingesta con normalizeOrganization().
  normalized_name text not null,
  sector      sector not null default 'privado',
  logo_url    text,
  website     text,
  created_at  timestamptz not null default now()
);
create unique index if not exists organizations_normalized_name_key on organizations (normalized_name);

create table if not exists sources (
  id                 text primary key,           -- p. ej. 'src-spe'
  name               text not null,
  url                text not null,
  method             source_method not null,
  terms_reviewed     boolean not null default false,
  terms_reviewed_at  date,
  legal_notes        text,
  frequency          text,                        -- p. ej. 'diaria'
  enabled            boolean not null default true,
  last_run_at        timestamptz,
  last_run_status    text,
  last_run_count     integer
);

-- Datos crudos de ingesta (auditoría y re-procesamiento)
create table if not exists raw_items (
  id           bigserial primary key,
  source_id    text not null references sources(id),
  external_id  text,
  url          text not null,
  payload      jsonb not null,
  content_hash text not null,
  fetched_at   timestamptz not null default now(),
  unique (source_id, content_hash)
);

-- Una fila por fuente y corrida de la ingesta, con su reporte (IngestionReport).
create table if not exists ingestion_runs (
  id          bigserial primary key,
  source_id   text not null references sources(id),
  started_at  timestamptz not null default now(),
  report      jsonb not null
);
create index if not exists ingestion_runs_source_idx on ingestion_runs (source_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Oportunidades
-- ---------------------------------------------------------------------------
create table if not exists opportunities (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  title                  text not null,
  -- Puede faltar mientras está en revisión (la fuente no dijo quién la ofrece); para publicar es obligatoria.
  organization_id        uuid references organizations(id),
  type                   opportunity_type not null,
  levels                 education_level[] not null default '{}',
  municipality_slug      text references municipalities(slug),
  modality               modality not null default 'presencial',
  compensation_type      compensation_type not null default 'no_especificado',
  compensation_amount_cop integer check (compensation_amount_cop is null or compensation_amount_cop >= 0),
  duration_months_min    smallint check (duration_months_min between 1 and 36),
  duration_months_max    smallint check (duration_months_max between 1 and 36),
  deadline_type          deadline_type not null default 'no_publicada',
  deadline_date          date,
  start_date             date,
  description            text not null default '',
  -- requisitos
  open_to_all_programs   boolean not null default false,
  accepts_related_programs boolean not null default false,
  semester_min           smallint check (semester_min between 1 and 12),
  semester_max           smallint check (semester_max between 1 and 12),
  accepts_graduates      boolean,
  restricted_to_institutions boolean not null default false,  -- true → ver opportunity_institutions
  other_requirements     text[] not null default '{}',
  -- trazabilidad
  apply_url              text not null default '',  -- vacío solo mientras está en revisión
  status                 opportunity_status not null default 'borrador',
  needs_review           boolean not null default false,
  review_notes           text[] not null default '{}',  -- observaciones de la ingesta para quien revisa
  dedupe_hash            text,
  first_seen_at          timestamptz not null default now(),
  published_at           timestamptz,
  last_verified_at       timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  search_vector          tsvector,
  constraint deadline_consistency check ((deadline_type = 'fecha') = (deadline_date is not null)),
  constraint duration_range check (duration_months_min is null or duration_months_max is null or duration_months_min <= duration_months_max),
  constraint semester_range check (semester_min is null or semester_max is null or semester_min <= semester_max),
  -- Lo que ve el público siempre tiene organización y enlace oficial.
  constraint public_is_complete check (status not in ('publicada','vencida') or (organization_id is not null and apply_url <> ''))
);

create index if not exists opportunities_status_deadline_idx on opportunities (status, deadline_date);
create index if not exists opportunities_dedupe_idx on opportunities (dedupe_hash);
create index if not exists opportunities_search_idx on opportunities using gin (search_vector);
create index if not exists opportunities_title_trgm_idx on opportunities using gin (title gin_trgm_ops);
create index if not exists opportunities_levels_idx on opportunities using gin (levels);

create table if not exists opportunity_programs (
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  program_id     text not null references programs(id),
  primary key (opportunity_id, program_id)
);

create table if not exists opportunity_knowledge_areas (
  opportunity_id    uuid not null references opportunities(id) on delete cascade,
  knowledge_area_id text not null references knowledge_areas(id),
  primary key (opportunity_id, knowledge_area_id)
);

create table if not exists opportunity_institutions (
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  institution_id text not null references institutions(id),
  primary key (opportunity_id, institution_id)
);

create table if not exists opportunity_sources (
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  source_id      text not null references sources(id),
  url            text not null,
  position       smallint not null default 0,   -- 0 = fuente principal
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  -- La misma fuente puede listar la convocatoria en más de una página.
  primary key (opportunity_id, source_id, url)
);

create table if not exists issue_reports (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  reason         issue_reason not null,
  comment        text check (char_length(comment) <= 500),
  resolved       boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Búsqueda de texto (español, sin tildes) y updated_at
-- ---------------------------------------------------------------------------
create or replace function opportunities_before_write() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  new.updated_at := now();
  new.search_vector :=
    setweight(to_tsvector('spanish', unaccent(coalesce(new.title, ''))), 'A') ||
    setweight(to_tsvector('spanish', unaccent(coalesce(array_to_string(new.other_requirements, ' '), ''))), 'C') ||
    setweight(to_tsvector('spanish', unaccent(coalesce(new.description, ''))), 'D');
  return new;
end $$;

drop trigger if exists opportunities_before_write on opportunities;
create trigger opportunities_before_write
before insert or update on opportunities
for each row execute function opportunities_before_write();

-- Job diario (Fase 3): marcar vencidas. Mientras tanto: `npm run admin -- vencer`.
create or replace function expire_opportunities() returns integer
language sql as $$
  with updated as (
    update opportunities set status = 'vencida'
    where status = 'publicada'
      and deadline_type = 'fecha'
      and deadline_date < (now() at time zone 'America/Bogota')::date
    returning 1
  ) select count(*)::integer from updated;
$$;

-- ---------------------------------------------------------------------------
-- RLS: lectura pública de catálogos y de lo publicado; escritura solo admins / service role
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

alter table municipalities enable row level security;
alter table knowledge_areas enable row level security;
alter table institutions enable row level security;
alter table programs enable row level security;
alter table institution_programs enable row level security;
alter table organizations enable row level security;
alter table sources enable row level security;
alter table raw_items enable row level security;
alter table opportunities enable row level security;
alter table opportunity_programs enable row level security;
alter table opportunity_knowledge_areas enable row level security;
alter table opportunity_institutions enable row level security;
alter table opportunity_sources enable row level security;
alter table issue_reports enable row level security;
alter table admin_users enable row level security;
alter table ingestion_runs enable row level security;

-- Catálogos: lectura pública
drop policy if exists read_all on municipalities;
create policy read_all on municipalities for select using (true);
drop policy if exists read_all on knowledge_areas;
create policy read_all on knowledge_areas for select using (true);
drop policy if exists read_all on institutions;
create policy read_all on institutions for select using (true);
drop policy if exists read_all on programs;
create policy read_all on programs for select using (true);
drop policy if exists read_all on institution_programs;
create policy read_all on institution_programs for select using (true);
drop policy if exists read_all on organizations;
create policy read_all on organizations for select using (true);
drop policy if exists read_enabled on sources;
create policy read_enabled on sources for select using (enabled or is_admin());

-- Oportunidades: público ve publicadas y vencidas; admin ve todo
drop policy if exists read_public on opportunities;
create policy read_public on opportunities for select
  using (status in ('publicada','vencida') or is_admin());
drop policy if exists read_public on opportunity_programs;
create policy read_public on opportunity_programs for select
  using (exists (select 1 from opportunities o where o.id = opportunity_id and (o.status in ('publicada','vencida') or is_admin())));
drop policy if exists read_public on opportunity_knowledge_areas;
create policy read_public on opportunity_knowledge_areas for select
  using (exists (select 1 from opportunities o where o.id = opportunity_id and (o.status in ('publicada','vencida') or is_admin())));
drop policy if exists read_public on opportunity_institutions;
create policy read_public on opportunity_institutions for select
  using (exists (select 1 from opportunities o where o.id = opportunity_id and (o.status in ('publicada','vencida') or is_admin())));
drop policy if exists read_public on opportunity_sources;
create policy read_public on opportunity_sources for select
  using (exists (select 1 from opportunities o where o.id = opportunity_id and (o.status in ('publicada','vencida') or is_admin())));

-- Escritura de admins (la ingesta usa service role, que omite RLS)
drop policy if exists admin_write on organizations;
create policy admin_write on organizations for all using (is_admin()) with check (is_admin());
drop policy if exists admin_write on sources;
create policy admin_write on sources for all using (is_admin()) with check (is_admin());
drop policy if exists admin_write on opportunities;
create policy admin_write on opportunities for all using (is_admin()) with check (is_admin());
drop policy if exists admin_write on opportunity_programs;
create policy admin_write on opportunity_programs for all using (is_admin()) with check (is_admin());
drop policy if exists admin_write on opportunity_knowledge_areas;
create policy admin_write on opportunity_knowledge_areas for all using (is_admin()) with check (is_admin());
drop policy if exists admin_write on opportunity_institutions;
create policy admin_write on opportunity_institutions for all using (is_admin()) with check (is_admin());
drop policy if exists admin_write on opportunity_sources;
create policy admin_write on opportunity_sources for all using (is_admin()) with check (is_admin());
drop policy if exists admin_read on raw_items;
create policy admin_read on raw_items for select using (is_admin());
drop policy if exists admin_read on ingestion_runs;
create policy admin_read on ingestion_runs for select using (is_admin());

-- Reportes: los crea la server action `reportIssue` con la clave secreta (service role, omite RLS).
-- No hay política de inserción pública: así nadie puede llenar la tabla saltándose la validación del servidor.
drop policy if exists anyone_insert on issue_reports;
drop policy if exists admin_read on issue_reports;
create policy admin_read on issue_reports for select using (is_admin());
drop policy if exists admin_update on issue_reports;
create policy admin_update on issue_reports for update using (is_admin());
drop policy if exists self_read on admin_users;
create policy self_read on admin_users for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Permisos (explícitos: no dependen de los privilegios por defecto del proyecto)
-- RLS sigue mandando: estos grants solo dicen qué rol puede intentar cada operación.
-- ---------------------------------------------------------------------------
revoke execute on function expire_opportunities() from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function expire_opportunities() to service_role;

grant select on municipalities, knowledge_areas, institutions, programs, institution_programs,
  organizations, sources, opportunities, opportunity_programs, opportunity_knowledge_areas,
  opportunity_institutions, opportunity_sources to anon, authenticated;

-- Administradores (rol authenticated + fila en admin_users; lo exigen las políticas admin_*).
grant insert, update, delete on organizations, sources, opportunities, opportunity_programs,
  opportunity_knowledge_areas, opportunity_institutions, opportunity_sources to authenticated;
grant select on raw_items, ingestion_runs, issue_reports, admin_users to authenticated;
grant update on issue_reports to authenticated;
