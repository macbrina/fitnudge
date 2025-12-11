create table if not exists suggested_goals (
  id uuid primary key default gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  goals jsonb,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists suggested_goals_user_id_key
  on suggested_goals (user_id);

create index if not exists suggested_goals_status_idx
  on suggested_goals (status);

alter table suggested_goals enable row level security;

create policy suggested_goals_owner_select
  on suggested_goals
  for select
  using (auth.uid() = user_id);

create policy suggested_goals_owner_insert
  on suggested_goals
  for insert
  with check (auth.uid() = user_id);

create policy suggested_goals_owner_update
  on suggested_goals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy suggested_goals_owner_delete
  on suggested_goals
  for delete
  using (auth.uid() = user_id);

