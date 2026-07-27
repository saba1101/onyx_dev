create table if not exists public.clients (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  company_name     text not null,
  contact_name     text,
  email            text,
  phone            text,
  website          text,
  social_url       text,
  maps_url         text,
  address          text,
  service_offered  text,
  payment_amount   numeric,
  status           text not null default 'not_contacted',
  conversation     text,
  last_contact_at  date,
  follow_up_at     date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists clients_user_id_status_idx on public.clients (user_id, status);

alter table public.clients enable row level security;

create policy "clients_select_own" on public.clients
  for select using (auth.uid() = user_id);

create policy "clients_insert_own" on public.clients
  for insert with check (auth.uid() = user_id);

create policy "clients_update_own" on public.clients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "clients_delete_own" on public.clients
  for delete using (auth.uid() = user_id);
