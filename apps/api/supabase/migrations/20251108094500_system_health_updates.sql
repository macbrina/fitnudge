create table if not exists system_health_updates (
  id uuid primary key default uuid_generate_v4(),
  history_id uuid not null references system_health_history(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  title text not null,
  description text not null,
  status text not null default 'identified' check (status in ('identified','monitoring','resolved'))
);

create index if not exists system_health_updates_history_id_idx
  on system_health_updates (history_id, created_at);

