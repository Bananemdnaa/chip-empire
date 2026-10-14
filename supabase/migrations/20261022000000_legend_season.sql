-- Chip Empire: Legenden-Sterne in der Karriere-Bestenliste und Wochen-Saison
-- Einmal im Supabase SQL-Editor ausführen (oder per `supabase db push`).
-- Sterne und Wochenstand liegen im Spielstand (state jsonb), es braucht keine neuen Spalten.

-- Zahl aus dem Spielstand lesen, ohne bei Unsinn abzubrechen
create or replace function public.jnum(v jsonb)
returns numeric language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric else null end;
$$;

-- ---------- Karriere-Bestenliste: zuerst Sterne, dann Chips ----------
drop function if exists public.leaderboard(integer, text);
create or replace function public.leaderboard(lim integer default 20, md text default 'career')
returns table (username text, save_name text, balance bigint, unlocked smallint, wagered bigint, play_ms bigint, updated_at timestamptz, stars integer)
language sql stable security definer set search_path = '' as $$
  select p.username, s.name, s.balance, s.unlocked, s.wagered, s.play_ms, s.updated_at,
    coalesce(public.jnum(s.state -> 'stars'), 0)::integer as stars
  from public.saves s
  join public.profiles p on p.id = s.user_id
  where s.mode = case when md in ('career', 'empire') then md else 'career' end
    and not p.hidden
  order by stars desc, s.balance desc
  limit least(greatest(lim, 1), 100);
$$;
revoke all on function public.leaderboard(integer, text) from public;
grant execute on function public.leaderboard(integer, text) to anon, authenticated;

-- ---------- Wochen-Saison ----------
-- Wochenstand einer Woche (Montag als 'JJJJ-MM-TT'): aktuelle Woche oder die gespeicherte Vorwoche
create or replace function public.season_rows(wk text)
returns table (user_id uuid, username text, save_name text, net bigint, best bigint, rounds integer, stars integer)
language sql stable security definer set search_path = '' as $$
  select x.user_id, x.username, x.name,
    public.jnum(x.se -> 'net')::bigint, coalesce(public.jnum(x.se -> 'best'), 0)::bigint,
    coalesce(public.jnum(x.se -> 'rounds'), 0)::integer, x.stars
  from (
    select s.user_id, p.username, s.name,
      coalesce(public.jnum(s.state -> 'stars'), 0)::integer as stars,
      case when s.state -> 'season' ->> 'key' = wk then s.state -> 'season'
           when s.state -> 'seasonPrev' ->> 'key' = wk then s.state -> 'seasonPrev' end as se
    from public.saves s
    join public.profiles p on p.id = s.user_id
    where s.mode = 'career' and not p.hidden and wk ~ '^\d{4}-\d{2}-\d{2}$'
  ) x
  where x.se is not null and public.jnum(x.se -> 'net') is not null and coalesce(public.jnum(x.se -> 'rounds'), 0) > 0;
$$;
revoke all on function public.season_rows(text) from public;

create or replace function public.season_board(lim integer default 20, wk text default null)
returns table (username text, save_name text, net bigint, best bigint, rounds integer, stars integer)
language sql stable security definer set search_path = '' as $$
  select r.username, r.save_name, r.net, r.best, r.rounds, r.stars
  from public.season_rows(wk) r
  order by r.net desc, r.best desc
  limit least(greatest(lim, 1), 100);
$$;
revoke all on function public.season_board(integer, text) from public;
grant execute on function public.season_board(integer, text) to anon, authenticated;

-- Bester Platz des eigenen Kontos in einer Woche (für die Belohnung), null ohne Platzierung oder ohne Gewinn
create or replace function public.season_rank(wk text)
returns integer
language sql stable security definer set search_path = '' as $$
  select min(b.rk)::integer
  from (
    select r.user_id, r.net, row_number() over (order by r.net desc, r.best desc) as rk
    from public.season_rows(wk) r
  ) b
  where b.user_id = (select auth.uid()) and b.net > 0;
$$;
revoke all on function public.season_rank(text) from public;
grant execute on function public.season_rank(text) to authenticated;
