create table if not exists system_health_history (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default timezone('utc', now()),
  status text not null check (status in ('degraded','critical')),
  environment text not null,
  version text,
  summary_key text not null,
  summary_params jsonb not null default '{}'::jsonb,
  impacted jsonb not null default '[]'::jsonb,
  report jsonb not null
);

create index if not exists system_health_history_created_at_idx
  on system_health_history (created_at desc);

