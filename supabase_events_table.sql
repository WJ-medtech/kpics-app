-- ============================================================
-- K-PICS イベントカレンダー用テーブル
-- Supabase の SQL Editor で実行してください
-- ============================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  event_time text,
  location text,
  description text,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

-- ログイン済みなら誰でも閲覧・追加・編集・削除できる（部員全員編集可）
create policy "events_select_authenticated" on public.events
  for select to authenticated using (true);

create policy "events_insert_authenticated" on public.events
  for insert to authenticated with check (true);

create policy "events_update_authenticated" on public.events
  for update to authenticated using (true);

create policy "events_delete_authenticated" on public.events
  for delete to authenticated using (true);

-- updated_at 自動更新
create or replace function public.handle_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at
  before update on public.events
  for each row execute function public.handle_events_updated_at();
