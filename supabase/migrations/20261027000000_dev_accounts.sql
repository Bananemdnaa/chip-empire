-- Chip Empire: Dev-Konten zum Testen
-- Einmal im Supabase SQL-Editor ausführen (oder per `supabase db push`). Baut auf allen bisherigen Migrationen auf.
--
-- Ein Dev-Konto ist überall ausgeblendet: Ranglisten, Duell-Rangliste, Wochen-Saison (über hidden),
-- Spielersuche, offene Herausforderungen, Admin-Statistik, Online-Liste und „Neueste Spieler“.
-- Im Spiel hat es alles offen (alle Spiele, Varianten, Funktionen) und einen Reiter mit Dev-Werkzeugen.
-- Ein- und ausschalten kann nur der Owner, im Admin-Panel beim Spieler („Dev-Konto“).
-- Direkt per Name herausfordern geht weiterhin, damit man Duelle gegen das eigene Konto testen kann.

alter table public.profiles add column if not exists dev boolean not null default false;

create or replace function public.is_dev(u uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select coalesce((select dev from public.profiles where id = u), false)
$fn$;
revoke all on function public.is_dev(uuid) from public, anon, authenticated;

-- Für das Spiel: Ist das eigene Konto ein Dev-Konto?
create or replace function public.am_dev()
returns boolean language sql stable security definer set search_path = '' as $fn$
  select coalesce((select dev from public.profiles where id = auth.uid()), false)
$fn$;
revoke all on function public.am_dev() from public, anon;
grant execute on function public.am_dev() to authenticated;

create or replace function public.admin_set_dev(name text, make boolean)
returns void language plpgsql security definer set search_path = '' as $fn$
declare o uuid := public.uid_of(name);
begin
  perform public.require_owner();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  update public.profiles set dev = make, hidden = case when make then true else hidden end where id = o;
  perform public.admin_note(case when make then 'dev_on' else 'dev_off' end, lower(trim(name)), null);
end;
$fn$;
revoke all on function public.admin_set_dev(text, boolean) from public, anon;
grant execute on function public.admin_set_dev(text, boolean) to authenticated;

-- ---------- Spielersuche ohne Dev-Konten ----------
create or replace function public.player_search(q text)
returns table (username text, state text, rating integer, level integer, unlocked smallint)
language sql stable security definer set search_path = '' as $fn$
  select p.username,
    (select case when fr.status = 'accepted' then 'friend' when fr.requester = auth.uid() then 'outgoing' else 'incoming' end
      from public.friendships fr
      where (fr.requester = auth.uid() and fr.addressee = p.id) or (fr.requester = p.id and fr.addressee = auth.uid()) limit 1),
    coalesce(s.rating, 1000),
    (select max((sv.state ->> 'level')::int) from public.saves sv where sv.user_id = p.id),
    (select max(sv.unlocked) from public.saves sv where sv.user_id = p.id and sv.mode <> 'sandbox')
  from public.profiles p
  left join public.duel_stats s on s.user_id = p.id
  where char_length(trim(q)) >= 2
    and left(p.username, char_length(trim(q))) = lower(trim(q))
    and p.id <> auth.uid() and not p.dev
  order by p.username
  limit 8
$fn$;

-- ---------- Offene Herausforderungen ohne Dev-Konten ----------
drop function if exists public.duel_lobby();
create function public.duel_lobby()
returns table (id uuid, challenger text, rating integer, game text, created_at timestamptz)
language sql stable security definer set search_path = '' as $fn$
  select d.id, p.username, coalesce(s.rating, 1000), d.game, d.created_at
  from public.duels d
  join public.profiles p on p.id = d.a
  left join public.duel_stats s on s.user_id = d.a
  where d.status = 'invited' and d.b is null and d.a <> auth.uid() and d.a_seen > now() - interval '30 seconds' and not p.dev
  order by d.created_at desc
  limit 20
$fn$;
revoke all on function public.duel_lobby() from public, anon;
grant execute on function public.duel_lobby() to authenticated;

create or replace function public.duel_ping()
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare u uuid := public.me();
begin
  perform public.duel_sweep();
  return jsonb_build_object(
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'challenger', p.username, 'game', d.game,
        'rating', coalesce(s.rating, 1000), 'created_at', d.created_at) order by d.created_at desc), '[]'::jsonb)
      from public.duels d join public.profiles p on p.id = d.a left join public.duel_stats s on s.user_id = d.a
      where d.status = 'invited' and d.b = u and d.a_seen > now() - interval '30 seconds'),
    'lobby', (select count(*) from public.duels d join public.profiles p on p.id = d.a
      where d.status = 'invited' and d.b is null and d.a <> u and d.a_seen > now() - interval '30 seconds' and not p.dev),
    'active', (select jsonb_build_object('id', d.id, 'status', d.status, 'role', case when d.a = u then 'a' else 'b' end, 'game', d.game,
        'opponent', (select p.username from public.profiles p where p.id = case when d.a = u then d.b else d.a end),
        'done', case when d.a = u then d.a_score is not null else d.b_score is not null end)
      from public.duels d where d.status in ('invited', 'live') and (d.a = u or d.b = u) order by d.created_at desc limit 1));
end;
$fn$;
revoke all on function public.duel_ping() from public, anon;
grant execute on function public.duel_ping() to authenticated;

-- ---------- Admin: Online-Liste ohne Dev-Konten ----------
create or replace function public.admin_online()
returns table (username text, save_name text, mode text, game text, balance bigint, unlocked smallint, stars integer, seen timestamptz)
language plpgsql stable security definer set search_path = '' as $fn$
begin
  perform public.require_admin();
  return query
    select distinct on (s.user_id)
      p.username, s.name, s.mode, coalesce(s.state ->> 'game', ''), s.balance, s.unlocked,
      coalesce(public.jnum(s.state -> 'stars'), 0)::integer, s.updated_at
    from public.saves s
    join public.profiles p on p.id = s.user_id
    where s.updated_at > now() - interval '3 minutes' and not p.dev
    order by s.user_id, s.updated_at desc;
end;
$fn$;

-- ---------- Admin: Statistik ohne Dev-Konten ----------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'players', (select count(*) from public.profiles where not dev),
    'new7', (select count(*) from public.profiles where created_at > now() - interval '7 days' and not dev),
    'online', (select count(distinct user_id) from public.saves where updated_at > now() - interval '3 minutes' and not public.is_dev(user_id)),
    'active1', (select count(distinct user_id) from public.saves where updated_at > now() - interval '1 day' and not public.is_dev(user_id)),
    'active7', (select count(distinct user_id) from public.saves where updated_at > now() - interval '7 days' and not public.is_dev(user_id)),
    'saves', (select count(*) from public.saves where not public.is_dev(user_id)),
    'modes', (select coalesce(jsonb_object_agg(m.mode, m.c), '{}'::jsonb) from (select mode, count(*) as c from public.saves where not public.is_dev(user_id) group by mode) m),
    'chips', (select coalesce(sum(coalesce((state ->> 'balance')::numeric, 0)), 0) from public.saves where mode <> 'sandbox' and not public.is_dev(user_id)),
    'duels', (select count(*) from public.duels where status = 'done' and not public.is_dev(a) and not public.is_dev(b)),
    'duels1', (select count(*) from public.duels where status = 'done' and finished_at > now() - interval '1 day' and not public.is_dev(a) and not public.is_dev(b)),
    'open_duels', (select count(*) from public.duels where status in ('open', 'a_playing', 'b_playing', 'invited', 'live') and not public.is_dev(a)),
    'friendships', (select count(*) from public.friendships where status = 'accepted' and not public.is_dev(requester) and not public.is_dev(addressee)),
    'hidden', (select count(*) from public.profiles where hidden and not dev),
    'banned', (select count(*) from auth.users where banned_until > now()),
    'admins', (select count(*) from public.admins a where not public.is_dev(a.user_id)),
    'team', (select coalesce(jsonb_agg(jsonb_build_object('username', p.username, 'role', a.role, 'since', a.created_at) order by a.role = 'owner' desc, p.username), '[]'::jsonb)
      from public.admins a join public.profiles p on p.id = a.user_id where not p.dev),
    'recent_duels', (select coalesce(jsonb_agg(r.j order by r.t desc), '[]'::jsonb) from (
        select d.finished_at as t, jsonb_build_object('a', pa.username, 'b', pb.username, 'game', d.game, 'as', d.a_score, 'bs', d.b_score, 't', d.finished_at) as j
        from public.duels d left join public.profiles pa on pa.id = d.a left join public.profiles pb on pb.id = d.b
        where d.status = 'done' and not public.is_dev(d.a) and not public.is_dev(d.b) order by d.finished_at desc limit 10) r),
    'recent_players', (select coalesce(jsonb_agg(r.j order by r.t desc), '[]'::jsonb) from (
        select p.created_at as t, jsonb_build_object('username', p.username, 'joined', p.created_at) as j
        from public.profiles p where not p.dev order by p.created_at desc limit 8) r)
  );
end;
$fn$;

-- ---------- Admin: Spielerliste mit Dev-Kennzeichen ----------
create or replace function public.admin_players(q text default '', lim integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare res jsonb;
begin
  perform public.require_admin();
  select coalesce(jsonb_agg(x.j order by x.last desc nulls last), '[]'::jsonb) into res from (
    select p.id,
      (select max(sv.updated_at) from public.saves sv where sv.user_id = p.id) as last,
      jsonb_build_object(
        'username', p.username, 'joined', p.created_at, 'hidden', p.hidden, 'me', p.id = auth.uid(), 'dev', p.dev,
        'role', public.role_of(p.id), 'admin', public.role_of(p.id) is not null, 'renamed', p.name_changed_at,
        'note', n.note, 'ban_reason', n.ban_reason, 'note_by', n.updated_by,
        'banned_until', (select u.banned_until from auth.users u where u.id = p.id and u.banned_until > now()),
        'rating', coalesce(s.rating, 1000), 'wins', coalesce(s.wins, 0), 'losses', coalesce(s.losses, 0), 'draws', coalesce(s.draws, 0),
        'friends', (select count(*) from public.friendships f where f.status = 'accepted' and (f.requester = p.id or f.addressee = p.id)),
        'last', (select max(sv.updated_at) from public.saves sv where sv.user_id = p.id),
        'saves', coalesce((select jsonb_agg(jsonb_build_object(
            'id', sv.id, 'name', sv.name, 'mode', sv.mode, 'balance', sv.balance, 'chips', coalesce((sv.state ->> 'balance')::numeric, sv.balance),
            'unlocked', sv.unlocked, 'level', (sv.state ->> 'level')::int, 'tp', coalesce((sv.state ->> 'bonusTp')::int, 0),
            'stars', coalesce(public.jnum(sv.state -> 'stars'), 0)::integer,
            'wagered', sv.wagered, 'play_ms', sv.play_ms, 'updated_at', sv.updated_at)
            order by sv.updated_at desc)
          from public.saves sv where sv.user_id = p.id), '[]'::jsonb)) as j
    from public.profiles p
    left join public.duel_stats s on s.user_id = p.id
    left join public.admin_notes n on n.user_id = p.id
    where coalesce(trim(q), '') = '' or left(p.username, char_length(trim(q))) = lower(trim(q))
    order by last desc nulls last
    limit least(greatest(lim, 1), 100)) x;
  return res;
end;
$fn$;

-- ---------- Admin: Talentpunkte in einem Schritt (bis 1.000 statt 50 pro Aufruf) ----------
create or replace function public.admin_add_tp(sid uuid, n integer)
returns void language plpgsql security definer set search_path = '' as $fn$
declare sv public.saves; who text; cur integer;
begin
  perform public.require_admin();
  if n is null or n = 0 or n < -1000 or n > 1000 then raise exception 'Bitte zwischen -1.000 und 1.000 Talentpunkte.'; end if;
  select * into sv from public.saves where id = sid for update;
  if sv.id is null then raise exception 'Spielstand nicht gefunden.'; end if;
  perform public.check_target(sv.user_id);
  if sv.state is null then raise exception 'Dieser Spielstand wurde noch nie gespielt.'; end if;
  cur := coalesce((sv.state ->> 'bonusTp')::int, 0);
  update public.saves set state = jsonb_set(sv.state, '{bonusTp}', to_jsonb(greatest(0, cur + n))), rev = sv.rev + 1 where id = sid;
  select username into who from public.profiles where id = sv.user_id;
  perform public.admin_note('tp', who, sv.name || ': ' || cur || ' → ' || greatest(0, cur + n) || ' Bonus-Talentpunkte');
end;
$fn$;

-- ---------- Dev-Konten bleiben aus den Ranglisten ----------
create or replace function public.admin_set_hidden(name text, hide boolean)
returns void language plpgsql security definer set search_path = '' as $fn$
declare o uuid := public.uid_of(name);
begin
  perform public.require_admin();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  perform public.check_target(o);
  if not hide and public.is_dev(o) then raise exception 'Dev-Konten bleiben ausgeblendet. Erst das Dev-Konto aufheben.'; end if;
  update public.profiles set hidden = hide where id = o;
  perform public.admin_note(case when hide then 'hide' else 'show' end, lower(trim(name)), null);
end;
$fn$;
