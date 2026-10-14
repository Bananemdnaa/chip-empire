-- Chip Empire: Ranglisten mit einem Eintrag pro Konto, Wochenbelohnung nur einmal pro Konto
-- Einmal im Supabase SQL-Editor ausführen (oder per `supabase db push`).

-- ---------- Karriere und Imperium: pro Konto zählt der beste Spielstand ----------
-- Bester = meiste Legenden-Sterne, bei Gleichstand die meisten Chips (bzw. der höchste Imperiumswert)
create or replace function public.leaderboard(lim integer default 20, md text default 'career')
returns table (username text, save_name text, balance bigint, unlocked smallint, wagered bigint, play_ms bigint, updated_at timestamptz, stars integer)
language sql stable security definer set search_path = '' as $$
  select b.username, b.save_name, b.balance, b.unlocked, b.wagered, b.play_ms, b.updated_at, b.stars
  from (
    select distinct on (s.user_id)
      p.username, s.name as save_name, s.balance, s.unlocked, s.wagered, s.play_ms, s.updated_at,
      coalesce(public.jnum(s.state -> 'stars'), 0)::integer as stars
    from public.saves s
    join public.profiles p on p.id = s.user_id
    where s.mode = case when md in ('career', 'empire') then md else 'career' end
      and not p.hidden
    order by s.user_id, coalesce(public.jnum(s.state -> 'stars'), 0) desc, s.balance desc
  ) b
  order by b.stars desc, b.balance desc
  limit least(greatest(lim, 1), 100);
$$;
revoke all on function public.leaderboard(integer, text) from public;
grant execute on function public.leaderboard(integer, text) to anon, authenticated;

-- ---------- Wochenwertung: Gewinne aller Karriere-Spielstände eines Kontos zusammen ----------
-- So bringt es nichts, mehrere Spielstände zu spielen und nur den glücklichsten werten zu lassen
create or replace function public.season_board(lim integer default 20, wk text default null)
returns table (username text, save_name text, net bigint, best bigint, rounds integer, stars integer)
language sql stable security definer set search_path = '' as $$
  select max(r.username),
    case when count(*) > 1 then count(*) || ' Spielstände' else max(r.save_name) end,
    sum(r.net)::bigint, max(r.best)::bigint, sum(r.rounds)::integer, max(r.stars)
  from public.season_rows(wk) r
  group by r.user_id
  order by sum(r.net) desc, max(r.best) desc
  limit least(greatest(lim, 1), 100);
$$;
revoke all on function public.season_board(integer, text) from public;
grant execute on function public.season_board(integer, text) to anon, authenticated;

-- Platz des eigenen Kontos in einer Woche (null ohne Platzierung oder ohne Gewinn)
create or replace function public.season_rank(wk text)
returns integer
language sql stable security definer set search_path = '' as $$
  select b.rk::integer
  from (
    select r.user_id, sum(r.net) as net, row_number() over (order by sum(r.net) desc, max(r.best) desc) as rk
    from public.season_rows(wk) r
    group by r.user_id
  ) b
  where b.user_id = (select auth.uid()) and b.net > 0;
$$;
revoke all on function public.season_rank(text) from public;
grant execute on function public.season_rank(text) to authenticated;

-- ---------- Wochenbelohnung: nur einmal pro Konto und Woche ----------
create table if not exists public.season_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  wk text not null,
  rank integer,
  claimed_at timestamptz not null default now(),
  primary key (user_id, wk)
);
alter table public.season_claims enable row level security;
-- Keine Richtlinien: Zugriff nur über die Funktion unten

-- Gibt beim ersten Aufruf pro Konto und Woche den Platz zurück, danach immer null.
-- Nur abgeschlossene Wochen (nicht die laufende) können abgeholt werden.
create or replace function public.season_claim(wk text)
returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  rk integer;
  n integer;
begin
  if me is null or wk !~ '^\d{4}-\d{2}-\d{2}$' or wk::date + 7 > current_date + 1 then
    return null;
  end if;
  rk := public.season_rank(wk);
  insert into public.season_claims (user_id, wk, rank) values (me, wk, rk) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return null; end if;
  return rk;
end;
$$;
revoke all on function public.season_claim(text) from public;
grant execute on function public.season_claim(text) to authenticated;
