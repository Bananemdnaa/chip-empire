-- Chip Empire: Live-Duelle. Beide spielen gleichzeitig, sehen den Stand des anderen und das Ergebnis sofort.
-- Einmal im Supabase SQL-Editor ausführen (oder per `supabase db push`). Baut auf 20261015, 20261017 und 20261021 auf.
--
-- Ablauf: a lädt ein (status 'invited', a wartet im Warteraum und meldet sich alle paar Sekunden),
-- b nimmt an (status 'live', Start nach kurzem Countdown), beide melden laufend ihren Zwischenstand,
-- wer fertig ist, schickt sein Protokoll. Sind beide fertig, wird sofort gewertet.
-- Wer länger als 2 Minuten nichts von sich hören lässt, verliert mit 0 Chips. Einladungen verfallen,
-- sobald der Einladende den Warteraum länger als 30 Sekunden verlassen hat.
-- Alte Duelle (nacheinander spielen) laufen mit den bisherigen Funktionen zu Ende.

alter table public.duels add column if not exists mode text not null default 'async';
alter table public.duels add column if not exists a_seen timestamptz;
alter table public.duels add column if not exists b_seen timestamptz;
alter table public.duels add column if not exists live_at timestamptz;
alter table public.duels add column if not exists a_prog jsonb;
alter table public.duels add column if not exists b_prog jsonb;
alter table public.duels drop constraint if exists duels_status_check;
alter table public.duels add constraint duels_status_check
  check (status in ('invited', 'live', 'a_playing', 'open', 'b_playing', 'done', 'declined', 'expired', 'void'));
create index if not exists duels_live_idx on public.duels (status) where status in ('invited', 'live');

-- ---------- Aufräumen ----------
create or replace function public.duel_sweep()
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  -- alte Duelle wie bisher
  update public.duels set a_score = 0, status = 'open'
    where status = 'a_playing' and a_started < now() - interval '30 minutes';
  for r in select id from public.duels where status = 'b_playing' and b_started < now() - interval '30 minutes' loop
    update public.duels set b_score = 0 where id = r.id;
    perform public.duel_rate(r.id);
  end loop;
  update public.duels set status = 'expired', finished_at = now()
    where status = 'open' and created_at < now() - interval '7 days';
  -- Einladungen, deren Absender nicht mehr wartet
  update public.duels set status = 'expired', finished_at = now()
    where status = 'invited' and coalesce(a_seen, created_at) < now() - interval '30 seconds';
  -- Live: wer 2 Minuten weg ist oder nach 30 Minuten nicht fertig, bekommt 0
  update public.duels set a_score = 0, a_log = '[]'::jsonb
    where status = 'live' and a_score is null
      and (greatest(a_seen, live_at) < now() - interval '2 minutes' or live_at < now() - interval '30 minutes');
  update public.duels set b_score = 0, b_log = '[]'::jsonb
    where status = 'live' and b_score is null
      and (greatest(b_seen, live_at) < now() - interval '2 minutes' or live_at < now() - interval '30 minutes');
  for r in select id from public.duels where status = 'live' and a_score is not null and b_score is not null loop
    perform public.duel_rate(r.id);
  end loop;
end;
$$;
revoke all on function public.duel_sweep() from public, anon, authenticated;

-- ---------- Einladen ----------
create or replace function public.duel_invite(opp text default null, gm text default 'crash')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); o uuid; r jsonb;
begin
  perform public.duel_sweep();
  if gm is null or gm not in ('crash', 'tower', 'bj') then raise exception 'Dieses Spiel gibt es für Duelle nicht.'; end if;
  if opp is not null and trim(opp) <> '' then
    o := public.uid_of(opp);
    if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
    if o = u then raise exception 'Du kannst dich nicht selbst herausfordern.'; end if;
    if exists (select 1 from public.duels d where d.status = 'live' and (d.a = o or d.b = o)) then
      raise exception 'Dieser Spieler ist gerade in einem anderen Duell.';
    end if;
  end if;
  if exists (select 1 from public.duels d where d.status in ('invited', 'live') and (d.a = u or d.b = u)) then
    raise exception 'Du bist schon in einem Duell oder wartest auf einen Gegner.';
  end if;
  insert into public.duels as d (a, b, game, points, setup, status, mode, a_seen)
    values (u, o, gm, case when gm = 'crash' then public.duel_points() else '{}'::numeric[] end, public.duel_setup(gm), 'invited', 'live', now())
    returning jsonb_build_object('id', d.id, 'game', d.game, 'points', d.points, 'setup', d.setup) into r;
  return r;
end;
$$;

-- Einladender bricht ab (Warteraum geschlossen)
create or replace function public.duel_cancel(did uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.duels where id = did and a = public.me() and status = 'invited';
$$;

-- Annehmen: Live-Einladung startet nach 5 Sekunden für beide; alte offene Duelle wie bisher
create or replace function public.duel_join(did uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); r jsonb;
begin
  perform public.duel_sweep();
  if exists (select 1 from public.duels d where d.status in ('invited', 'live') and (d.a = u or d.b = u) and d.id <> did) then
    raise exception 'Beende erst dein anderes Duell.';
  end if;
  update public.duels d set b = u, b_seen = now(), a_seen = coalesce(d.a_seen, now()), status = 'live', live_at = now() + interval '5 seconds', b_started = now()
    where d.id = did and d.status = 'invited' and d.a <> u and (d.b is null or d.b = u)
    returning jsonb_build_object('game', d.game, 'points', d.points, 'setup', d.setup, 'mode', 'live', 'start_in', 5,
      'opponent', (select p.username from public.profiles p where p.id = d.a)) into r;
  if r is not null then return r; end if;
  update public.duels d set b = u, b_started = now(), status = 'b_playing'
    where d.id = did and d.status = 'open' and d.a <> u and (d.b is null or d.b = u)
    returning jsonb_build_object('game', d.game, 'points', d.points, 'setup', d.setup, 'mode', 'async') into r;
  if r is null then raise exception 'Diese Herausforderung ist nicht mehr offen.'; end if;
  return r;
end;
$$;

create or replace function public.duel_decline(did uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.duels set status = 'declined', finished_at = now()
    where id = did and status in ('open', 'invited') and b = public.me();
end;
$$;

-- ---------- Live-Stand: melden und abfragen ----------
-- prog: Chips nach jeder fertigen Runde, z. B. [1100, 950, 1400]. Nur zur Anzeige, gewertet wird das Protokoll.
-- Den Stand des Gegners zeigt der Browser nur bis zu der Runde, die man selbst schon gespielt hat.
create or replace function public.duel_live(did uuid, prog jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); d public.duels; isa boolean;
begin
  perform public.duel_sweep();
  select * into d from public.duels where id = did;
  if d.id is null or (d.a <> u and d.b is distinct from u) then raise exception 'Duell nicht gefunden.'; end if;
  isa := d.a = u;
  if d.status in ('invited', 'live') then
    if prog is not null and (jsonb_typeof(prog) <> 'array' or jsonb_array_length(prog) > 12) then raise exception 'Ungültiger Zwischenstand'; end if;
    if isa then update public.duels set a_seen = now(), a_prog = case when prog is not null and a_score is null then prog else a_prog end where id = did;
    else update public.duels set b_seen = now(), b_prog = case when prog is not null and b_score is null then prog else b_prog end where id = did;
    end if;
    select * into d from public.duels where id = did;
  end if;
  return jsonb_build_object(
    'status', d.status, 'role', case when isa then 'a' else 'b' end, 'game', d.game,
    'opponent', (select p.username from public.profiles p where p.id = case when isa then d.b else d.a end),
    'opp_rating', (select coalesce(s.rating, 1000) from public.duel_stats s where s.user_id = case when isa then d.b else d.a end),
    'start_in', case when d.live_at is null then null else extract(epoch from d.live_at - now()) end,
    'points', case when d.status = 'live' or isa then d.points end,
    'setup', case when d.status = 'live' or isa then d.setup end,
    'opp_prog', case when isa then d.b_prog else d.a_prog end,
    'opp_done', case when isa then d.b_score is not null else d.a_score is not null end,
    'opp_away', extract(epoch from now() - coalesce(case when isa then d.b_seen else d.a_seen end, now())),
    'my_score', case when isa then d.a_score else d.b_score end,
    'their_score', case when d.status = 'done' then (case when isa then d.b_score else d.a_score end) end,
    'my_delta', case when isa then d.a_delta else d.b_delta end,
    'their_log', case when d.status = 'done' then (case when isa then d.b_log else d.a_log end) end);
end;
$$;

-- ---------- Ergebnis abgeben ----------
create or replace function public.duel_submit(did uuid, lg jsonb, quit boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); d public.duels; s bigint;
begin
  select * into d from public.duels where id = did for update;
  if d.id is null then raise exception 'Duell nicht gefunden.'; end if;
  s := case when quit then 0 else public.duel_result(d.game, d.points, d.setup, lg) end;
  if d.status = 'live' and d.a = u and d.a_score is null then
    update public.duels set a_log = case when quit then '[]'::jsonb else lg end, a_score = s, a_seen = now() where id = did;
  elsif d.status = 'live' and d.b = u and d.b_score is null then
    update public.duels set b_log = case when quit then '[]'::jsonb else lg end, b_score = s, b_seen = now() where id = did;
  elsif d.a = u and d.status = 'a_playing' then
    update public.duels set a_log = lg, a_score = s, status = 'open' where id = did;
  elsif d.b = u and d.status = 'b_playing' then
    update public.duels set b_log = lg, b_score = s where id = did;
    perform public.duel_rate(did);
    return s;
  else
    raise exception 'Für dieses Duell kannst du gerade kein Ergebnis abgeben.';
  end if;
  select * into d from public.duels where id = did;
  if d.status = 'live' and d.a_score is not null and d.b_score is not null then perform public.duel_rate(did); end if;
  return s;
end;
$$;

-- ---------- Übersicht ----------
drop function if exists public.duel_list();
create function public.duel_list()
returns table (id uuid, role text, opponent text, status text, game text, my_score bigint, their_score bigint, my_delta integer,
  my_log jsonb, their_log jsonb, points numeric[], setup jsonb, created_at timestamptz, finished_at timestamptz, mode text)
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
    d.created_at, d.finished_at, d.mode
  from public.duels d
  left join public.profiles p on p.id = (case when d.a = u then d.b else d.a end)
  where (d.a = u or d.b = u)
    and (d.status in ('invited', 'live', 'a_playing', 'open', 'b_playing') or d.created_at > now() - interval '14 days')
  order by coalesce(d.finished_at, d.created_at) desc
  limit 40;
end;
$$;

-- Offene Herausforderungen: nur Live-Einladungen an alle, deren Absender gerade wartet
drop function if exists public.duel_lobby();
create function public.duel_lobby()
returns table (id uuid, challenger text, rating integer, game text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id, p.username, coalesce(s.rating, 1000), d.game, d.created_at
  from public.duels d
  join public.profiles p on p.id = d.a
  left join public.duel_stats s on s.user_id = d.a
  where d.status = 'invited' and d.b is null and d.a <> auth.uid() and d.a_seen > now() - interval '30 seconds'
  order by d.created_at desc
  limit 20;
$$;

-- Kurzer Blick alle paar Sekunden: Einladungen an mich, offene Herausforderungen, mein laufendes Duell
create or replace function public.duel_ping()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me();
begin
  perform public.duel_sweep();
  return jsonb_build_object(
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'challenger', p.username, 'game', d.game,
        'rating', coalesce(s.rating, 1000), 'created_at', d.created_at) order by d.created_at desc), '[]'::jsonb)
      from public.duels d join public.profiles p on p.id = d.a left join public.duel_stats s on s.user_id = d.a
      where d.status = 'invited' and d.b = u and d.a_seen > now() - interval '30 seconds'),
    'lobby', (select count(*) from public.duels d where d.status = 'invited' and d.b is null and d.a <> u and d.a_seen > now() - interval '30 seconds'),
    'active', (select jsonb_build_object('id', d.id, 'status', d.status, 'role', case when d.a = u then 'a' else 'b' end, 'game', d.game,
        'opponent', (select p.username from public.profiles p where p.id = case when d.a = u then d.b else d.a end),
        'done', case when d.a = u then d.a_score is not null else d.b_score is not null end)
      from public.duels d where d.status in ('invited', 'live') and (d.a = u or d.b = u) order by d.created_at desc limit 1));
end;
$$;

-- ---------- Admin: Live-Duelle annullieren ----------
create or replace function public.admin_void_duel(did uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.duels; sa numeric;
begin
  perform public.require_admin();
  select * into d from public.duels where id = did for update;
  if d.id is null then raise exception 'Duell nicht gefunden.'; end if;
  if d.status = 'done' then
    sa := case when d.a_score > d.b_score then 1 when d.a_score < d.b_score then 0 else 0.5 end;
    update public.duel_stats set rating = rating - coalesce(d.a_delta, 0),
      wins = greatest(0, wins - (sa = 1)::int), losses = greatest(0, losses - (sa = 0)::int), draws = greatest(0, draws - (sa = 0.5)::int)
      where user_id = d.a;
    update public.duel_stats set rating = rating - coalesce(d.b_delta, 0),
      wins = greatest(0, wins - (sa = 0)::int), losses = greatest(0, losses - (sa = 1)::int), draws = greatest(0, draws - (sa = 0.5)::int)
      where user_id = d.b;
  elsif d.status not in ('a_playing', 'open', 'b_playing', 'invited', 'live') then
    raise exception 'Dieses Duell ist schon abgeschlossen.';
  end if;
  update public.duels set status = 'void', finished_at = coalesce(d.finished_at, now()) where id = did;
  perform public.admin_note('void_duel',
    (select username from public.profiles where id = d.a) || ' gegen ' || coalesce((select username from public.profiles where id = d.b), 'offen'),
    d.game || ', ' || coalesce(d.a_score::text, '–') || ' : ' || coalesce(d.b_score::text, '–'));
end;
$$;

-- ---------- Rechte ----------
revoke all on function public.duel_invite(text, text) from public, anon;
grant execute on function public.duel_invite(text, text) to authenticated;
revoke all on function public.duel_cancel(uuid) from public, anon;
grant execute on function public.duel_cancel(uuid) to authenticated;
revoke all on function public.duel_join(uuid) from public, anon;
grant execute on function public.duel_join(uuid) to authenticated;
revoke all on function public.duel_decline(uuid) from public, anon;
grant execute on function public.duel_decline(uuid) to authenticated;
revoke all on function public.duel_live(uuid, jsonb) from public, anon;
grant execute on function public.duel_live(uuid, jsonb) to authenticated;
revoke all on function public.duel_submit(uuid, jsonb, boolean) from public, anon;
grant execute on function public.duel_submit(uuid, jsonb, boolean) to authenticated;
revoke all on function public.duel_list() from public, anon;
grant execute on function public.duel_list() to authenticated;
revoke all on function public.duel_lobby() from public, anon;
grant execute on function public.duel_lobby() to authenticated;
revoke all on function public.duel_ping() from public, anon;
grant execute on function public.duel_ping() to authenticated;
revoke all on function public.admin_void_duel(uuid) from public, anon;
grant execute on function public.admin_void_duel(uuid) to authenticated;
