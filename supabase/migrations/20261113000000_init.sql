-- PrácticasCol · esquema inicial (AGENTS.md §13)
-- Se aplica en la Fase 1 con `supabase db push`. Mientras tanto la app usa mocks (USE_MOCKS=true).

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Enums del dominio (valores = src/lib/contracts/enums.ts)
-- ---------------------------------------------------------------------------
create type opportunity_type as enum ('practica_profesional','practica_empresarial','pasantia','contrato_aprendizaje','judicatura');
create type education_level  as enum ('tecnico_laboral','tecnico_profesional','tecnologo','universitario','posgrado');
create type modality         as enum ('presencial','hibrida','remota');
create type sector           as enum ('privado','publico','mixto','ong');
create type compensation_type as enum ('salario','apoyo_sostenimiento','auxilio','sin_remuneracion','no_especificado');
create type deadline_type    as enum ('fecha','hasta_agotar_cupos','no_publicada');
create type opportunity_status as enum ('borrador','en_revision','publicada','vencida','retirada');
create type source_method    as enum ('api','scraping','manual');
create type issue_reason     as enum ('vencida','enlace_roto','datos_incorrectos','sospechosa','otro');

-- ---------------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------------
create table municipalities (
  slug        text primary key,
  name        text not null,
  dane_code   char(5) not null unique,
  metro       boolean not null default true
);

create table knowledge_areas (
  id    text primary key,           -- p. ej. 'nbc-ing-sistemas'
  name  text not null
);

create table institutions (
  id          text primary key,
  name        text not null,
  short_name  text not null,
  sector      text not null check (sector in ('publica','privada')),
  snies_code  text
);

create table programs (
  id                 text primary key,
  name               text not null,
  level              education_level not null,
  knowledge_area_id  text not null references knowledge_areas(id)
);

create table institution_programs (
  institution_id  text not null references institutions(id) on delete cascade,
  program_id      text not null references programs(id) on delete cascade,
  primary key (institution_id, program_id)
);

-- ---------------------------------------------------------------------------
-- Organizaciones y fuentes
-- ---------------------------------------------------------------------------
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sector      sector not null default 'privado',
  logo_url    text,
  website     text,
  created_at  timestamptz not null default now()
);
create unique index organizations_name_key on organizations (lower(name));

create table sources (
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
create table raw_items (
  id           bigserial primary key,
  source_id    text not null references sources(id),
  external_id  text,
  url          text not null,
  payload      jsonb not null,
  content_hash text not null,
  fetched_at   timestamptz not null default now(),
  processed_at timestamptz,
  opportunity_id uuid,
  unique (source_id, content_hash)
);

-- ---------------------------------------------------------------------------
-- Oportunidades
-- ---------------------------------------------------------------------------
create table opportunities (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  title                  text not null,
  organization_id        uuid not null references organizations(id),
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
  apply_url              text not null,
  status                 opportunity_status not null default 'borrador',
  needs_review           boolean not null default false,
  dedupe_hash            text,
  first_seen_at          timestamptz not null default now(),
  published_at           timestamptz,
  last_verified_at       timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  search_vector          tsvector,
  constraint deadline_consistency check ((deadline_type = 'fecha') = (deadline_date is not null)),
  constraint duration_range check (duration_months_min is null or duration_months_max is null or duration_months_min <= duration_months_max),
  constraint semester_range check (semester_min is null or semester_max is null or semester_min <= semester_max)
);

create index opportunities_status_deadline_idx on opportunities (status, deadline_date);
create index opportunities_dedupe_idx on opportunities (dedupe_hash);
create index opportunities_search_idx on opportunities using gin (search_vector);
create index opportunities_title_trgm_idx on opportunities using gin (title gin_trgm_ops);
create index opportunities_levels_idx on opportunities using gin (levels);

create table opportunity_programs (
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  program_id     text not null references programs(id),
  primary key (opportunity_id, program_id)
);

create table opportunity_knowledge_areas (
  opportunity_id    uuid not null references opportunities(id) on delete cascade,
  knowledge_area_id text not null references knowledge_areas(id),
  primary key (opportunity_id, knowledge_area_id)
);

create table opportunity_institutions (
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  institution_id text not null references institutions(id),
  primary key (opportunity_id, institution_id)
);

create table opportunity_sources (
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  source_id      text not null references sources(id),
  url            text not null,
  is_primary     boolean not null default false,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  primary key (opportunity_id, source_id)
);

create table issue_reports (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  reason         issue_reason not null,
  comment        text check (char_length(comment) <= 500),
  resolved       boolean not null default false,
  created_at     timestamptz not null default now()
);

create table admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Búsqueda de texto (español, sin tildes) y updated_at
-- ---------------------------------------------------------------------------
create or replace function opportunities_before_write() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.search_vector :=
    setweight(to_tsvector('spanish', unaccent(coalesce(new.title, ''))), 'A') ||
    setweight(to_tsvector('spanish', unaccent(coalesce(array_to_string(new.other_requirements, ' '), ''))), 'C') ||
    setweight(to_tsvector('spanish', unaccent(coalesce(new.description, ''))), 'D');
  return new;
end $$;

create trigger opportunities_before_write
before insert or update on opportunities
for each row execute function opportunities_before_write();

-- Job diario (Fase 3): marcar vencidas
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

-- Catálogos: lectura pública
create policy read_all on municipalities for select using (true);
create policy read_all on knowledge_areas for select using (true);
create policy read_all on institutions for select using (true);
create policy read_all on programs for select using (true);
create policy read_all on institution_programs for select using (true);
create policy read_all on organizations for select using (true);
create policy read_enabled on sources for select using (enabled or is_admin());

-- Oportunidades: público ve publicadas y vencidas; admin ve todo
create policy read_public on opportunities for select
  using (status in ('publicada','vencida') or is_admin());
create policy read_public on opportunity_programs for select
  using (exists (select 1 from opportunities o where o.id = opportunity_id and (o.status in ('publicada','vencida') or is_admin())));
create policy read_public on opportunity_knowledge_areas for select
  using (exists (select 1 from opportunities o where o.id = opportunity_id and (o.status in ('publicada','vencida') or is_admin())));
create policy read_public on opportunity_institutions for select
  using (exists (select 1 from opportunities o where o.id = opportunity_id and (o.status in ('publicada','vencida') or is_admin())));
create policy read_public on opportunity_sources for select
  using (exists (select 1 from opportunities o where o.id = opportunity_id and (o.status in ('publicada','vencida') or is_admin())));

-- Escritura de admins (la ingesta usa service role, que omite RLS)
create policy admin_write on organizations for all using (is_admin()) with check (is_admin());
create policy admin_write on sources for all using (is_admin()) with check (is_admin());
create policy admin_write on opportunities for all using (is_admin()) with check (is_admin());
create policy admin_write on opportunity_programs for all using (is_admin()) with check (is_admin());
create policy admin_write on opportunity_knowledge_areas for all using (is_admin()) with check (is_admin());
create policy admin_write on opportunity_institutions for all using (is_admin()) with check (is_admin());
create policy admin_write on opportunity_sources for all using (is_admin()) with check (is_admin());
create policy admin_read on raw_items for select using (is_admin());

-- Reportes: cualquiera puede crear (vía server action); solo admin lee
create policy anyone_insert on issue_reports for insert with check (true);
create policy admin_read on issue_reports for select using (is_admin());
create policy admin_update on issue_reports for update using (is_admin());
create policy self_read on admin_users for select using (user_id = auth.uid());
