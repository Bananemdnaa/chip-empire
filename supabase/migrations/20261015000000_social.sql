-- Chip Empire: Freunde, Spielerprofile und Crash-Duelle mit Wertung
-- Einmal im Supabase SQL-Editor ausführen (oder per `supabase db push`).
-- Nur Ergänzungen: Bestehende Tabellen und Funktionen bleiben unverändert.
-- Auf die neuen Tabellen gibt es keinen direkten Zugriff, alles läuft über die Funktionen unten.

-- ---------- Tabellen ----------
create table if not exists public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create index if not exists friendships_addressee_idx on public.friendships (addressee);
alter table public.friendships enable row level security;

create table if not exists public.duel_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rating integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0
);
create index if not exists duel_stats_rating_idx on public.duel_stats (rating desc);
alter table public.duel_stats enable row level security;

-- a fordert heraus und spielt zuerst, b spielt danach dieselben Absturzpunkte.
-- b ist leer bei einer offenen Herausforderung, die jeder annehmen kann.
create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references auth.users (id) on delete cascade,
  b uuid references auth.users (id) on delete cascade,
  status text not null default 'a_playing' check (status in ('a_playing', 'open', 'b_playing', 'done', 'declined', 'expired')),
  points numeric[] not null,
  a_log jsonb, b_log jsonb,
  a_score bigint, b_score bigint,
  a_delta integer, b_delta integer,
  a_started timestamptz not null default now(),
  b_started timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists duels_a_idx on public.duels (a, created_at desc);
create index if not exists duels_b_idx on public.duels (b, created_at desc);
create index if not exists duels_status_idx on public.duels (status, created_at desc);
alter table public.duels enable row level security;

-- ---------- Hilfsfunktionen (nur intern) ----------
create or replace function public.uid_of(name text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.profiles where username = lower(trim(name));
$$;
revoke all on function public.uid_of(text) from public, anon, authenticated;

create or replace function public.me()
returns uuid language plpgsql stable set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Nicht eingeloggt'; end if;
  return u;
end;
$$;
revoke all on function public.me() from public, anon;

-- Regeln eines Duells: 10 Runden, Start mit 1.000 Duell-Chips, Mindesteinsatz 50 (oder der Rest).
-- Das Ergebnis wird aus dem Protokoll nachgerechnet, nicht vom Browser übernommen.
create or replace function public.duel_score(pts numeric[], lg jsonb)
returns bigint language plpgsql immutable set search_path = '' as $$
declare
  stack bigint := 1000; i integer := 0; e jsonb; bet bigint; c numeric;
begin
  if lg is null or jsonb_typeof(lg) <> 'array' or jsonb_array_length(lg) > array_length(pts, 1) then
    raise exception 'Ungültiges Duell-Protokoll';
  end if;
  for e in select value from jsonb_array_elements(lg) loop
    i := i + 1;
    if stack <= 0 then raise exception 'Ungültiges Duell-Protokoll'; end if;
    bet := (e ->> 'b')::bigint;
    c := coalesce((e ->> 'c')::numeric, 0);
    if bet is null or bet < least(50, stack) or bet > stack then raise exception 'Ungültiger Einsatz im Duell'; end if;
    if c <> 0 and (c < 1.01 or c <> round(c, 2)) then raise exception 'Ungültige Auszahlung im Duell'; end if;
    if c > 0 and c <= pts[i] then stack := stack - bet + floor(bet * c)::bigint;
    else stack := stack - bet;
    end if;
  end loop;
  if i < array_length(pts, 1) and stack > 0 then raise exception 'Das Duell ist noch nicht fertig gespielt'; end if;
  return stack;
end;
$$;
revoke all on function public.duel_score(numeric[], jsonb) from public, anon;

-- Elo-Wertung für ein fertiges Duell
create or replace function public.duel_rate(did uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.duels; ra integer; rb integer; ea numeric; sa numeric; da integer;
begin
  select * into d from public.duels where id = did;
  insert into public.duel_stats (user_id) values (d.a), (d.b) on conflict do nothing;
  select rating into ra from public.duel_stats where user_id = d.a;
  select rating into rb from public.duel_stats where user_id = d.b;
  ea := 1 / (1 + power(10, (rb - ra) / 400.0));
  sa := case when d.a_score > d.b_score then 1 when d.a_score < d.b_score then 0 else 0.5 end;
  da := round(32 * (sa - ea));
  update public.duel_stats set rating = greatest(100, rating + da),
    wins = wins + (sa = 1)::int, losses = losses + (sa = 0)::int, draws = draws + (sa = 0.5)::int where user_id = d.a;
  update public.duel_stats set rating = greatest(100, rating - da),
    wins = wins + (sa = 0)::int, losses = losses + (sa = 1)::int, draws = draws + (sa = 0.5)::int where user_id = d.b;
  update public.duels set status = 'done', finished_at = now(), a_delta = da, b_delta = -da where id = did;
end;
$$;
revoke all on function public.duel_rate(uuid) from public, anon, authenticated;

-- Abgebrochene Duelle zählen nach 30 Minuten als 0 Chips, unbeantwortete verfallen nach 7 Tagen
create or replace function public.duel_sweep()
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  update public.duels set a_score = 0, status = 'open'
    where status = 'a_playing' and a_started < now() - interval '30 minutes';
  for r in select id from public.duels where status = 'b_playing' and b_started < now() - interval '30 minutes' loop
    update public.duels set b_score = 0 where id = r.id;
    perform public.duel_rate(r.id);
  end loop;
  update public.duels set status = 'expired', finished_at = now()
    where status = 'open' and created_at < now() - interval '7 days';
end;
$$;
revoke all on function public.duel_sweep() from public, anon, authenticated;

create or replace function public.duel_points()
returns numeric[] language sql volatile set search_path = '' as $$
  -- Gleiche Verteilung wie im Crash-Spiel: 1 % Hausvorteil, Deckel bei 100.000×
  select array_agg(least(100000, greatest(1, round(floor(99 / (1 - random()))::numeric / 100, 2)))) from generate_series(1, 10);
$$;
revoke all on function public.duel_points() from public, anon, authenticated;

-- ---------- Duelle ----------
create or replace function public.duel_create(opp text default null)
returns table (id uuid, points numeric[])
language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); o uuid; n integer; nid uuid; np numeric[];
begin
  perform public.duel_sweep();
  if opp is not null and opp <> '' then
    o := public.uid_of(opp);
    if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
    if o = u then raise exception 'Du kannst dich nicht selbst herausfordern.'; end if;
  end if;
  select count(*) into n from public.duels d where d.a = u and d.status in ('a_playing', 'open');
  if n >= 5 then raise exception 'Du hast schon 5 offene Duelle. Warte, bis jemand sie spielt.'; end if;
  insert into public.duels as d (a, b, points) values (u, o, public.duel_points()) returning d.id, d.points into nid, np;
  return query select nid, np;
end;
$$;

create or replace function public.duel_accept(did uuid)
returns numeric[] language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); p numeric[];
begin
  perform public.duel_sweep();
  update public.duels set b = u, b_started = now(), status = 'b_playing'
    where id = did and status = 'open' and a <> u and (b is null or b = u)
    returning points into p;
  if p is null then raise exception 'Dieses Duell ist nicht mehr offen.'; end if;
  return p;
end;
$$;

create or replace function public.duel_decline(did uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.duels set status = 'declined', finished_at = now()
    where id = did and status = 'open' and b = public.me();
end;
$$;

-- Gibt das nachgerechnete Ergebnis zurück. Wer abbricht, schickt ein leeres Protokoll und bekommt 0.
create or replace function public.duel_submit(did uuid, lg jsonb, quit boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); d public.duels; s bigint;
begin
  select * into d from public.duels where id = did for update;
  if d.id is null then raise exception 'Duell nicht gefunden.'; end if;
  s := case when quit then 0 else public.duel_score(d.points, lg) end;
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

-- Alles rund um die eigenen Duelle. Das Ergebnis des Gegners gibt es erst, wenn beide gespielt haben.
create or replace function public.duel_list()
returns table (id uuid, role text, opponent text, status text, my_score bigint, their_score bigint, my_delta integer,
  my_log jsonb, their_log jsonb, points numeric[], created_at timestamptz, finished_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me();
begin
  perform public.duel_sweep();
  return query
  select d.id,
    case when d.a = u then 'a' else 'b' end,
    p.username,
    d.status,
    case when d.a = u then d.a_score else d.b_score end,
    case when d.status = 'done' then (case when d.a = u then d.b_score else d.a_score end) end,
    case when d.a = u then d.a_delta else d.b_delta end,
    case when d.status = 'done' then (case when d.a = u then d.a_log else d.b_log end) end,
    case when d.status = 'done' then (case when d.a = u then d.b_log else d.a_log end) end,
    case when d.status = 'done' then d.points end,
    d.created_at, d.finished_at
  from public.duels d
  left join public.profiles p on p.id = (case when d.a = u then d.b else d.a end)
  where (d.a = u or d.b = u)
    and (d.status in ('a_playing', 'open', 'b_playing') or d.created_at > now() - interval '14 days')
  order by coalesce(d.finished_at, d.created_at) desc
  limit 40;
end;
$$;

-- Offene Herausforderungen anderer Spieler, die man annehmen kann
create or replace function public.duel_lobby()
returns table (id uuid, challenger text, rating integer, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id, p.username, coalesce(s.rating, 1000), d.created_at
  from public.duels d
  join public.profiles p on p.id = d.a
  left join public.duel_stats s on s.user_id = d.a
  where d.status = 'open' and d.b is null and d.a <> auth.uid() and d.created_at > now() - interval '7 days'
  order by d.created_at desc
  limit 20;
$$;

create or replace function public.duel_board(lim integer default 20)
returns table (username text, rating integer, wins integer, losses integer, draws integer)
language sql stable security definer set search_path = '' as $$
  select p.username, s.rating, s.wins, s.losses, s.draws
  from public.duel_stats s join public.profiles p on p.id = s.user_id
  where s.wins + s.losses + s.draws > 0
  order by s.rating desc, s.wins desc
  limit least(greatest(lim, 1), 100);
$$;

-- ---------- Freunde ----------
create or replace function public.friend_request(name text)
returns text language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); o uuid := public.uid_of(name); n integer;
begin
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  if o = u then raise exception 'Das bist du selbst.'; end if;
  -- Hat die andere Person schon angefragt, gilt das als Annehmen
  update public.friendships set status = 'accepted' where requester = o and addressee = u and status = 'pending';
  if found then return 'accepted'; end if;
  if exists (select 1 from public.friendships where (requester = u and addressee = o) or (requester = o and addressee = u)) then
    return 'exists';
  end if;
  select count(*) into n from public.friendships where requester = u or addressee = u;
  if n >= 100 then raise exception 'Du hast schon 100 Freunde und Anfragen.'; end if;
  insert into public.friendships (requester, addressee) values (u, o);
  return 'sent';
end;
$$;

create or replace function public.friend_respond(name text, ok boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); o uuid := public.uid_of(name);
begin
  if ok then update public.friendships set status = 'accepted' where requester = o and addressee = u and status = 'pending';
  else delete from public.friendships where requester = o and addressee = u and status = 'pending';
  end if;
end;
$$;

create or replace function public.friend_remove(name text)
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); o uuid := public.uid_of(name);
begin
  delete from public.friendships where (requester = u and addressee = o) or (requester = o and addressee = u);
end;
$$;

create or replace function public.friend_list()
returns table (username text, state text, rating integer, level integer, unlocked smallint, last_active timestamptz)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as u),
  f as (
    select case when fr.requester = me.u then fr.addressee else fr.requester end as other,
      case when fr.status = 'accepted' then 'friend' when fr.requester = me.u then 'outgoing' else 'incoming' end as state
    from public.friendships fr, me
    where fr.requester = me.u or fr.addressee = me.u
  )
  select p.username, f.state, coalesce(s.rating, 1000),
    (select max((sv.state ->> 'level')::int) from public.saves sv where sv.user_id = f.other),
    (select max(sv.unlocked) from public.saves sv where sv.user_id = f.other and sv.mode <> 'sandbox'),
    (select max(sv.updated_at) from public.saves sv where sv.user_id = f.other)
  from f join public.profiles p on p.id = f.other
  left join public.duel_stats s on s.user_id = f.other
  order by f.state = 'incoming' desc, f.state = 'friend' desc, p.username;
$$;

-- ---------- Profil ----------
-- Öffentliche Kennzahlen eines Spielers; der Spielstand selbst bleibt privat
create or replace function public.player_profile(name text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); o uuid := public.uid_of(name); res jsonb;
begin
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  select jsonb_build_object(
    'username', p.username,
    'joined', p.created_at,
    'me', o = u,
    'rating', coalesce(s.rating, 1000),
    'wins', coalesce(s.wins, 0), 'losses', coalesce(s.losses, 0), 'draws', coalesce(s.draws, 0),
    'friend', (select case when fr.status = 'accepted' then 'friend' when fr.requester = u then 'outgoing' else 'incoming' end
      from public.friendships fr where (fr.requester = u and fr.addressee = o) or (fr.requester = o and fr.addressee = u) limit 1),
    'vs', (select jsonb_build_object(
        'wins', count(*) filter (where (d.a = u and d.a_score > d.b_score) or (d.b = u and d.b_score > d.a_score)),
        'losses', count(*) filter (where (d.a = u and d.a_score < d.b_score) or (d.b = u and d.b_score < d.a_score)),
        'draws', count(*) filter (where d.a_score = d.b_score))
      from public.duels d where d.status = 'done' and ((d.a = u and d.b = o) or (d.a = o and d.b = u))),
    'saves', coalesce((select jsonb_agg(jsonb_build_object(
        'name', sv.name, 'mode', sv.mode, 'balance', sv.balance, 'unlocked', sv.unlocked, 'play_ms', sv.play_ms,
        'level', (sv.state ->> 'level')::int, 'biggest', (sv.state ->> 'biggest')::numeric, 'rounds', (sv.state ->> 'rounds')::int,
        'updated_at', sv.updated_at) order by sv.balance desc)
      from public.saves sv where sv.user_id = o), '[]'::jsonb)
  ) into res
  from public.profiles p left join public.duel_stats s on s.user_id = p.id
  where p.id = o;
  return res;
end;
$$;

-- ---------- Rechte ----------
revoke all on function public.duel_create(text) from public, anon;
revoke all on function public.duel_accept(uuid) from public, anon;
revoke all on function public.duel_decline(uuid) from public, anon;
revoke all on function public.duel_submit(uuid, jsonb, boolean) from public, anon;
revoke all on function public.duel_list() from public, anon;
revoke all on function public.duel_lobby() from public, anon;
revoke all on function public.friend_request(text) from public, anon;
revoke all on function public.friend_respond(text, boolean) from public, anon;
revoke all on function public.friend_remove(text) from public, anon;
revoke all on function public.friend_list() from public, anon;
grant execute on function public.me() to authenticated;
grant execute on function public.duel_score(numeric[], jsonb) to authenticated;
grant execute on function public.duel_create(text) to authenticated;
grant execute on function public.duel_accept(uuid) to authenticated;
grant execute on function public.duel_decline(uuid) to authenticated;
grant execute on function public.duel_submit(uuid, jsonb, boolean) to authenticated;
grant execute on function public.duel_list() to authenticated;
grant execute on function public.duel_lobby() to authenticated;
grant execute on function public.friend_request(text) to authenticated;
grant execute on function public.friend_respond(text, boolean) to authenticated;
grant execute on function public.friend_remove(text) to authenticated;
grant execute on function public.friend_list() to authenticated;
revoke all on function public.duel_board(integer) from public;
grant execute on function public.duel_board(integer) to anon, authenticated;
revoke all on function public.player_profile(text) from public;
grant execute on function public.player_profile(text) to anon, authenticated;
