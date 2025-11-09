alter table system_health_updates
  add column if not exists status text not null default 'identified';

alter table system_health_updates
  add constraint system_health_updates_status_check
  check (status in ('identified','monitoring','resolved'));

