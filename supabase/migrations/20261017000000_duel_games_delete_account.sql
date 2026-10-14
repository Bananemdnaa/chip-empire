-- Chip Empire: Konto löschen und Duelle mit Spielauswahl (Crash, Dragon Tower, Blackjack)
-- Einmal im Supabase SQL-Editor ausführen. Baut auf 20261015000000_social.sql und 20261016000000_friends.sql auf.

-- ---------- Konto löschen ----------
-- Löscht das eigene Konto. Profil, Spielstände, Freundschaften, Duelle und Wertung hängen per
-- "on delete cascade" am Konto und verschwinden mit.
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me();
begin
  delete from auth.users where id = u;
end;
$$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ---------- Duelle: Spiel und Aufbau ----------
alter table public.duels add column if not exists game text not null default 'crash';
alter table public.duels add column if not exists setup jsonb;
alter table public.duels drop constraint if exists duels_game_check;
alter table public.duels add constraint duels_game_check check (game in ('crash', 'tower', 'bj'));

-- Aufbau, den beide Spieler bekommen:
--   tower: 10 Türme mit je 9 Etagen, pro Etage das Drachenfeld (0 bis 2, 3 Felder)
--   bj:    gemischter Kartenschuh aus 4 Decks, Karten als Rang + Farbe (S, H, D, C), z. B. "10H"
create or replace function public.duel_setup(gm text)
returns jsonb language sql volatile set search_path = '' as $$
  select case gm
    when 'tower' then (
      select jsonb_agg(r order by i) from (
        select i, (select jsonb_agg(floor(random() * 3)::int) from generate_series(1, 9) where i > 0) as r
        from generate_series(1, 10) i) t)
    when 'bj' then (
      select jsonb_agg(c order by random()) from (
        select rk || st as c
        from unnest(array['A','2','3','4','5','6','7','8','9','10','J','Q','K']) rk,
             unnest(array['S','H','D','C']) st,
             generate_series(1, 4) dk) t)
    else null end;
$$;
revoke all on function public.duel_setup(text) from public, anon, authenticated;

-- Blackjack-Handwert mit weichen Assen
create or replace function public.bj_total(cards text[])
returns integer language plpgsql immutable set search_path = '' as $$
declare t integer := 0; a integer := 0; c text; r text;
begin
  foreach c in array cards loop
    if c is null then raise exception 'Der Kartenschuh ist leer'; end if;
    r := left(c, length(c) - 1);
    if r = 'A' then t := t + 11; a := a + 1;
    elsif r in ('K', 'Q', 'J', '10') then t := t + 10;
    else t := t + r::int;
    end if;
  end loop;
  while t > 21 and a > 0 loop t := t - 10; a := a - 1; end loop;
  return t;
end;
$$;
revoke all on function public.bj_total(text[]) from public, anon;

-- Dragon Tower: 10 Türme, Mindesteinsatz 50. p = gewählte Felder; endet mit Drache (verloren)
-- oder mit dem letzten sicheren Feld (ausgezahlt). Leere Liste: Runde aufgegeben.
-- Multiplikatoren wie im Spiel (3 Felder, 1 Drache, 97 %), fest hinterlegt, damit Browser und Server gleich rechnen.
create or replace function public.duel_score_tower(setup jsonb, lg jsonb)
returns bigint language plpgsql immutable set search_path = '' as $$
declare
  mults numeric[] := array[1.45, 2.18, 3.27, 4.91, 7.36, 11.04, 16.57, 24.86, 37.29];
  stack bigint := 1000; i integer := 0; e jsonb; bet bigint; picks jsonb; n integer; k integer; t integer; lost boolean;
begin
  if lg is null or jsonb_typeof(lg) <> 'array' or jsonb_array_length(lg) > jsonb_array_length(setup) then raise exception 'Ungültiges Duell-Protokoll'; end if;
  for e in select value from jsonb_array_elements(lg) loop
    if stack <= 0 then raise exception 'Ungültiges Duell-Protokoll'; end if;
    bet := (e ->> 'b')::bigint;
    if bet is null or bet < least(50, stack) or bet > stack then raise exception 'Ungültiger Einsatz im Duell'; end if;
    picks := coalesce(e -> 'p', '[]'::jsonb);
    n := jsonb_array_length(picks);
    if n > 9 then raise exception 'Ungültiger Zug im Duell'; end if;
    lost := n = 0;
    for k in 0 .. n - 1 loop
      if lost then raise exception 'Ungültiger Zug im Duell'; end if;
      t := (picks ->> k)::int;
      if t is null or t < 0 or t > 2 then raise exception 'Ungültiger Zug im Duell'; end if;
      if t = (setup -> i ->> k)::int then lost := true; end if;
    end loop;
    stack := stack - bet + case when lost then 0 else floor(bet * mults[n])::bigint end;
    i := i + 1;
  end loop;
  if i < jsonb_array_length(setup) and stack > 0 then raise exception 'Das Duell ist noch nicht fertig gespielt'; end if;
  return stack;
end;
$$;
revoke all on function public.duel_score_tower(jsonb, jsonb) from public, anon;

-- Blackjack: 8 Hände, Mindesteinsatz 50. a = Aktionen der Hand: H ziehen, S halten, D verdoppeln (nur als erste Aktion).
-- Regeln wie im Spiel: Dealer steht auf soft 17, Blackjack zahlt 3:2, kein Teilen, keine Versicherung.
create or replace function public.duel_score_bj(shoe jsonb, lg jsonb)
returns bigint language plpgsql immutable set search_path = '' as $$
declare
  stack bigint := 1000; i integer := 0; pos integer := 0; e jsonb; bet bigint; stake bigint; ret bigint;
  acts text; ch text; k integer; done boolean; p text[]; d text[]; pv integer; dv integer; pbj boolean; dbj boolean;
begin
  if lg is null or jsonb_typeof(lg) <> 'array' or jsonb_array_length(lg) > 8 then raise exception 'Ungültiges Duell-Protokoll'; end if;
  for e in select value from jsonb_array_elements(lg) loop
    if stack <= 0 then raise exception 'Ungültiges Duell-Protokoll'; end if;
    bet := (e ->> 'b')::bigint;
    if bet is null or bet < least(50, stack) or bet > stack then raise exception 'Ungültiger Einsatz im Duell'; end if;
    acts := coalesce(e ->> 'a', '');
    p := array[shoe ->> pos, shoe ->> (pos + 2)];
    d := array[shoe ->> (pos + 1), shoe ->> (pos + 3)];
    pos := pos + 4;
    pbj := public.bj_total(p) = 21; dbj := public.bj_total(d) = 21;
    stake := bet;
    if pbj or dbj then
      if acts <> '' then raise exception 'Ungültiger Zug im Duell'; end if;
      ret := case when pbj and dbj then bet when pbj then floor(bet * 2.5)::bigint else 0 end;
    else
      done := false;
      for k in 1 .. length(acts) loop
        if done then raise exception 'Ungültiger Zug im Duell'; end if;
        ch := substr(acts, k, 1);
        if ch = 'H' then
          p := p || (shoe ->> pos); pos := pos + 1;
          if public.bj_total(p) >= 21 then done := true; end if;
        elsif ch = 'S' then done := true;
        elsif ch = 'D' then
          if k <> 1 or stack < bet * 2 then raise exception 'Ungültiger Zug im Duell'; end if;
          stake := bet * 2;
          p := p || (shoe ->> pos); pos := pos + 1;
          done := true;
        else raise exception 'Ungültiger Zug im Duell';
        end if;
      end loop;
      if not done then raise exception 'Das Duell ist noch nicht fertig gespielt'; end if;
      pv := public.bj_total(p);
      if pv > 21 then ret := 0;
      else
        while public.bj_total(d) < 17 loop d := d || (shoe ->> pos); pos := pos + 1; end loop;
        dv := public.bj_total(d);
        ret := case when dv > 21 or pv > dv then stake * 2 when pv = dv then stake else 0 end;
      end if;
    end if;
    stack := stack - stake + ret;
    i := i + 1;
  end loop;
  if i < 8 and stack > 0 then raise exception 'Das Duell ist noch nicht fertig gespielt'; end if;
  return stack;
end;
$$;
revoke all on function public.duel_score_bj(jsonb, jsonb) from public, anon;

create or replace function public.duel_result(gm text, pts numeric[], setup jsonb, lg jsonb)
returns bigint language sql immutable set search_path = '' as $$
  select case gm
    when 'tower' then public.duel_score_tower(setup, lg)
    when 'bj' then public.duel_score_bj(setup, lg)
    else public.duel_score(pts, lg) end;
$$;
revoke all on function public.duel_result(text, numeric[], jsonb, jsonb) from public, anon;

-- Neues Duell mit Spielwahl; ersetzt die Version ohne Spiel
drop function if exists public.duel_create(text);
create or replace function public.duel_create(opp text default null, gm text default 'crash')
returns table (id uuid, points numeric[], setup jsonb)
language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); o uuid; n integer; nid uuid; np numeric[]; ns jsonb;
begin
  perform public.duel_sweep();
  if gm is null or gm not in ('crash', 'tower', 'bj') then raise exception 'Dieses Spiel gibt es für Duelle nicht.'; end if;
  if opp is not null and opp <> '' then
    o := public.uid_of(opp);
    if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
    if o = u then raise exception 'Du kannst dich nicht selbst herausfordern.'; end if;
  end if;
  select count(*) into n from public.duels d where d.a = u and d.status in ('a_playing', 'open');
  if n >= 5 then raise exception 'Du hast schon 5 offene Duelle. Warte, bis jemand sie spielt.'; end if;
  insert into public.duels as d (a, b, game, points, setup)
    values (u, o, gm, case when gm = 'crash' then public.duel_points() else '{}'::numeric[] end, public.duel_setup(gm))
    returning d.id, d.points, d.setup into nid, np, ns;
  return query select nid, np, ns;
end;
$$;

-- Annehmen mit Spiel und Aufbau
create or replace function public.duel_join(did uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); r jsonb;
begin
  perform public.duel_sweep();
  update public.duels set b = u, b_started = now(), status = 'b_playing'
    where id = did and status = 'open' and a <> u and (b is null or b = u)
    returning jsonb_build_object('game', game, 'points', points, 'setup', setup) into r;
  if r is null then raise exception 'Dieses Duell ist nicht mehr offen.'; end if;
  return r;
end;
$$;

-- Ältere Browser-Versionen kennen nur Crash
create or replace function public.duel_accept(did uuid)
returns numeric[] language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); p numeric[];
begin
  if exists (select 1 from public.duels where id = did and game <> 'crash') then
    raise exception 'Lade die Seite neu, um dieses Duell zu spielen.';
  end if;
  perform public.duel_sweep();
  update public.duels set b = u, b_started = now(), status = 'b_playing'
    where id = did and status = 'open' and a <> u and (b is null or b = u)
    returning points into p;
  if p is null then raise exception 'Dieses Duell ist nicht mehr offen.'; end if;
  return p;
end;
$$;

create or replace function public.duel_submit(did uuid, lg jsonb, quit boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); d public.duels; s bigint;
begin
  select * into d from public.duels where id = did for update;
  if d.id is null then raise exception 'Duell nicht gefunden.'; end if;
  s := case when quit then 0 else public.duel_result(d.game, d.points, d.setup, lg) end;
  if d.a = u and d.status = 'a_playing' then
    update public.duels set a_log = lg, a_score = s, status = 'open' where id = did;
  elsif d.b = u and d.status = 'b_playing' then
    update public.duels set b_log = lg, b_score = s where id = did;
    perform public.duel_rate(did);
  else
    raise exception 'Für dieses Duell kannst du gerade kein Ergebnis abgeben.';
  end if;
  return s;
end;
$$;

drop function if exists public.duel_list();
create function public.duel_list()
returns table (id uuid, role text, opponent text, status text, game text, my_score bigint, their_score bigint, my_delta integer,
  my_log jsonb, their_log jsonb, points numeric[], setup jsonb, created_at timestamptz, finished_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me();
begin
  perform public.duel_sweep();
  return query
  select d.id,
    case when d.a = u then 'a' else 'b' end,
    p.username,
    d.status,
    d.game,
    case when d.a = u then d.a_score else d.b_score end,
    case when d.status = 'done' then (case when d.a = u then d.b_score else d.a_score end) end,
    case when d.a = u then d.a_delta else d.b_delta end,
    case when d.status = 'done' then (case when d.a = u then d.a_log else d.b_log end) end,
    case when d.status = 'done' then (case when d.a = u then d.b_log else d.a_log end) end,
    case when d.status = 'done' then d.points end,
    case when d.status = 'done' then d.setup end,
    d.created_at, d.finished_at
  from public.duels d
  left join public.profiles p on p.id = (case when d.a = u then d.b else d.a end)
  where (d.a = u or d.b = u)
    and (d.status in ('a_playing', 'open', 'b_playing') or d.created_at > now() - interval '14 days')
  order by coalesce(d.finished_at, d.created_at) desc
  limit 40;
end;
$$;

drop function if exists public.duel_lobby();
create function public.duel_lobby()
returns table (id uuid, challenger text, rating integer, game text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id, p.username, coalesce(s.rating, 1000), d.game, d.created_at
  from public.duels d
  join public.profiles p on p.id = d.a
  left join public.duel_stats s on s.user_id = d.a
  where d.status = 'open' and d.b is null and d.a <> auth.uid() and d.created_at > now() - interval '7 days'
  order by d.created_at desc
  limit 20;
$$;

revoke all on function public.duel_create(text, text) from public, anon;
grant execute on function public.duel_create(text, text) to authenticated;
revoke all on function public.duel_join(uuid) from public, anon;
grant execute on function public.duel_join(uuid) to authenticated;
revoke all on function public.duel_list() from public, anon;
grant execute on function public.duel_list() to authenticated;
revoke all on function public.duel_lobby() from public, anon;
grant execute on function public.duel_lobby() to authenticated;
