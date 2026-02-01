-- Android Mode B: server-driven NextUp notification (FCM)

create table if not exists nextup_fcm_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  platform text not null default 'android',
  fcm_token text not null,
  timezone text not null default 'UTC',
  last_day_key text,
  last_payload_hash text,
  locked_day_key text,
  locked_task_id uuid,
  updated_at timestamptz not null default now(),
  unique (user_id, device_id, platform)
);

alter table nextup_fcm_devices enable row level security;

-- Users can manage their own device tokens
create policy "nextup_fcm_devices_select_own" on nextup_fcm_devices
  for select using (auth.uid() = user_id);

create policy "nextup_fcm_devices_insert_own" on nextup_fcm_devices
  for insert with check (auth.uid() = user_id);

create policy "nextup_fcm_devices_update_own" on nextup_fcm_devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_nextup_fcm_devices_updated_at on nextup_fcm_devices;
create trigger trg_nextup_fcm_devices_updated_at
before update on nextup_fcm_devices
for each row execute function set_updated_at();

