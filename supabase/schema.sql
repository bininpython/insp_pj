create table public.inspection_staff (
  id text primary key check (length(id) between 3 and 100),
  registration text unique check (registration is null or length(registration) between 1 and 30),
  name text not null check (length(trim(name)) between 2 and 160),
  shift text null check (shift is null or shift in ('TN','TM','TT')),
  rest_group smallint null check (rest_group is null or rest_group between 1 and 4),
  role text not null default 'Inspetor' check (length(role) <= 70),
  status text not null default 'Ativo' check (status in ('Ativo','Afastado','Inativo')),
  team_code text not null default '',
  team_name text not null default '',
  leader text not null default '',
  valid_from text not null default '',
  notes text not null default '' check (length(notes) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inspection_staff enable row level security;
revoke all on table public.inspection_staff from anon, authenticated, public;
grant select, insert, update, delete on table public.inspection_staff to service_role;
create policy "Inspection staff service role access" on public.inspection_staff
  for all to service_role using (true) with check (true);
