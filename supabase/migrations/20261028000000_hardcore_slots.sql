-- Chip Empire: 5 Spielstände pro Konto und der Modus Hardcore mit eigener Rangliste
-- Einmal im Supabase SQL-Editor ausführen: den ganzen Inhalt einfügen und ohne Markierung auf „Run“.

-- ---------- Modus Hardcore ----------
alter table public.saves drop constraint if exists saves_mode_check;
alter table public.saves add constraint saves_mode_check check (mode in ('career', 'sandbox', 'empire', 'hardcore'));

-- ---------- Bis zu 5 Spielstände ----------
create or replace function public.saves_guard()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if tg_op = 'INSERT' and (select count(*) from public.saves where user_id = new.user_id) >= 5 then
    raise exception 'Maximal 5 Spielstände pro Konto';
  end if;
  if public.bad_name(new.name) then
    if tg_op = 'INSERT' and new.state is null then raise exception 'Dieser Name ist nicht erlaubt.'; end if;
    new.name := case when tg_op = 'UPDATE' and not public.bad_name(old.name) then old.name else 'Spielstand' end;
  end if;
  new.updated_at := now();
  return new;
end;
$fn$;

-- ---------- Ranglisten: Hardcore zählt mit dem höchsten je erreichten Kontostand (steht in balance) ----------
create or replace function public.leaderboard(lim integer default 20, md text default 'career')
returns table (username text, save_name text, balance bigint, unlocked smallint, wagered bigint, play_ms bigint, updated_at timestamptz, stars integer)
language sql stable security definer set search_path = '' as $fn$
  select b.username, b.save_name, b.balance, b.unlocked, b.wagered, b.play_ms, b.updated_at, b.stars
  from (
    select distinct on (s.user_id)
      p.username, s.name as save_name, s.balance, s.unlocked, s.wagered, s.play_ms, s.updated_at,
      coalesce(public.jnum(s.state -> 'stars'), 0)::integer as stars
    from public.saves s
    join public.profiles p on p.id = s.user_id
    where s.mode = case when md in ('career', 'empire', 'hardcore') then md else 'career' end
      and not p.hidden
    order by s.user_id, coalesce(public.jnum(s.state -> 'stars'), 0) desc, s.balance desc
  ) b
  order by b.stars desc, b.balance desc
  limit least(greatest(lim, 1), 100)
$fn$;
revoke all on function public.leaderboard(integer, text) from public;
grant execute on function public.leaderboard(integer, text) to anon, authenticated;
