-- Folia · almacenamiento en Supabase
-- Ejecuta este script en Supabase → SQL Editor. Cada usuario de Supabase Auth solo ve y modifica sus propios documentos.

create table if not exists public.folia_docs (
  owner      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  acct       text        not null default '',
  coll       text        not null default '',
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);

create index if not exists folia_docs_owner_acct_coll on public.folia_docs (owner, acct, coll);

create or replace function public.folia_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists folia_docs_touch on public.folia_docs;
create trigger folia_docs_touch before update on public.folia_docs
  for each row execute function public.folia_touch();

alter table public.folia_docs enable row level security;

drop policy if exists "folia: leer lo propio" on public.folia_docs;
drop policy if exists "folia: crear lo propio" on public.folia_docs;
drop policy if exists "folia: editar lo propio" on public.folia_docs;
drop policy if exists "folia: borrar lo propio" on public.folia_docs;

create policy "folia: leer lo propio"   on public.folia_docs for select to authenticated using (owner = auth.uid());
create policy "folia: crear lo propio"  on public.folia_docs for insert to authenticated with check (owner = auth.uid());
create policy "folia: editar lo propio" on public.folia_docs for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "folia: borrar lo propio" on public.folia_docs for delete to authenticated using (owner = auth.uid());
