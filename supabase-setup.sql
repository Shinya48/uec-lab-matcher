-- UEC 研究室マッチング診断：匿名回答共有テーブル
-- Supabase Dashboard > SQL Editor に貼り付けて実行してください。

create table if not exists public.lab_matcher_responses (
  response_key uuid primary key,
  event_code text not null,
  x smallint not null check (x between -100 and 100),
  y smallint not null check (y between -100 and 100),
  created_at timestamptz not null default now(),
  constraint event_code_format check (
    char_length(event_code) between 3 and 64
    and event_code ~ '^[a-z0-9][a-z0-9_-]*$'
  )
);

create index if not exists lab_matcher_responses_event_created_idx
  on public.lab_matcher_responses (event_code, created_at desc);

alter table public.lab_matcher_responses enable row level security;

-- ブラウザから必要な操作だけを許可します。
revoke all on table public.lab_matcher_responses from anon, authenticated;
grant select (response_key, event_code, x, y, created_at)
  on table public.lab_matcher_responses to anon;
grant insert (response_key, event_code, x, y)
  on table public.lab_matcher_responses to anon;

-- このイベントコードだけを公開します。
-- config.js の eventCode を変える場合は、下の2箇所も同じ値へ変更してください。
drop policy if exists "public can read open campus responses"
  on public.lab_matcher_responses;
create policy "public can read open campus responses"
  on public.lab_matcher_responses
  for select
  to anon
  using (event_code = 'uec-open-campus-2026');

drop policy if exists "public can submit open campus responses"
  on public.lab_matcher_responses;
create policy "public can submit open campus responses"
  on public.lab_matcher_responses
  for insert
  to anon
  with check (
    event_code = 'uec-open-campus-2026'
    and x between -100 and 100
    and y between -100 and 100
  );

-- UPDATE / DELETE の権限とポリシーは付与していません。
-- 来場者のブラウザから、既存回答の変更・削除はできません。
