-- Formulario «Publica tu práctica» (contrato v0.1.3).
-- La convocatoria va a `opportunities` en revisión; los datos de contacto de quien la envió van aparte, en una
-- tabla que el público NUNCA puede leer (Ley 1581 de 2012): solo el administrador, para verificar la oferta.

-- Fuente de las convocatorias enviadas por el formulario.
insert into sources (id, name, url, method, terms_reviewed, legal_notes, frequency, enabled)
values (
  'src-publicacion-directa',
  'Publicada por la organización',
  '/publicar',
  'manual',
  true,
  'La organización declara que la oferta es real, gratuita para el estudiante y que tiene autorización para publicarla.',
  'continua',
  true
)
on conflict (id) do nothing;

create table if not exists opportunity_submissions (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references opportunities(id) on delete cascade,
  contact_name    text not null check (char_length(contact_name) between 2 and 100),
  contact_email   text not null check (char_length(contact_email) <= 200),
  contact_role    text not null default '' check (char_length(contact_role) <= 100),
  -- HMAC de la IP (nunca la IP): solo para limitar envíos repetidos.
  ip_hash         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists opportunity_submissions_opportunity_idx on opportunity_submissions (opportunity_id);
create index if not exists opportunity_submissions_ip_idx on opportunity_submissions (ip_hash, created_at desc);
create index if not exists opportunity_submissions_email_idx on opportunity_submissions (lower(contact_email), created_at desc);

-- Sin políticas para anon/authenticated: la server action escribe con la clave secreta (service role, omite RLS).
alter table opportunity_submissions enable row level security;
drop policy if exists admin_read on opportunity_submissions;
create policy admin_read on opportunity_submissions for select using (is_admin());
