-- Chip Empire: Imperium-Modus erlauben und Bestenliste pro Modus
-- Einmal im Supabase SQL-Editor ausführen (oder per `supabase db push`).

alter table public.saves drop constraint if exists saves_mode_check;
alter table public.saves add constraint saves_mode_check check (mode in ('career', 'sandbox', 'empire'));

drop function if exists public.leaderboard(integer);
drop function if exists public.leaderboard(integer, text);
create or replace function public.leaderboard(lim integer default 20, md text default 'career')
returns table (username text, save_name text, balance bigint, unlocked smallint, wagered bigint, play_ms bigint, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.username, s.name, s.balance, s.unlocked, s.wagered, s.play_ms, s.updated_at
  from public.saves s
  join public.profiles p on p.id = s.user_id
  where s.mode = case when md in ('career', 'empire') then md else 'career' end
  order by s.balance desc
  limit least(greatest(lim, 1), 100);
$$;
revoke all on function public.leaderboard(integer, text) from public;
grant execute on function public.leaderboard(integer, text) to anon, authenticated;
