-- Chip Empire: mehr Admin-Funktionen (Übersicht, Sperren, Talentpunkte, Admin-Rechte, Nachricht an alle)
-- Einmal im Supabase SQL-Editor ausführen. Baut auf 20261018000000_admin.sql und 20261019000000_name_filter.sql auf.

-- ---------- Nachricht an alle ----------
create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) between 1 and 300),
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;

-- Für alle lesbar, auch ohne Konto
create or replace function public.announcement_current()
returns table (id bigint, text text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, a.text, a.created_at from public.announcements a where a.active order by a.created_at desc limit 1;
$$;
revoke all on function public.announcement_current() from public;
grant execute on function public.announcement_current() to anon, authenticated;

create or replace function public.admin_announce(msg text)
returns void language plpgsql security definer set search_path = '' as $$
declare m text := trim(coalesce(msg, ''));
begin
  perform public.require_admin();
  if char_length(m) < 1 or char_length(m) > 300 then raise exception 'Die Nachricht braucht 1 bis 300 Zeichen.'; end if;
  update public.announcements set active = false where active;
  insert into public.announcements (text, created_by) values (m, (select username from public.profiles where id = auth.uid()));
  perform public.admin_note('announce', null, m);
end;
$$;

create or replace function public.admin_clear_announcement()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.announcements set active = false where active;
  perform public.admin_note('announce_clear', null, null);
end;
$$;

-- ---------- Sperren ----------
-- Supabase lehnt Logins und das Erneuern der Sitzung ab, solange banned_until in der Zukunft liegt.
-- days leer: dauerhaft (100 Jahre). Gesperrte Spieler verschwinden zusätzlich aus den Ranglisten.
create or replace function public.admin_ban(name text, days integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.uid_of(name);
begin
  perform public.require_admin();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  if o = auth.uid() then raise exception 'Du kannst dich nicht selbst sperren.'; end if;
  if days is not null and (days < 1 or days > 3650) then raise exception 'Ungültige Dauer.'; end if;
  update auth.users set banned_until = now() + case when days is null then interval '100 years' else make_interval(days => days) end where id = o;
  update public.profiles set hidden = true where id = o;
  perform public.admin_note('ban', lower(trim(name)), case when days is null then 'dauerhaft' else days || ' Tage' end);
end;
$$;

create or replace function public.admin_unban(name text)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.uid_of(name);
begin
  perform public.require_admin();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  update auth.users set banned_until = null where id = o;
  perform public.admin_note('unban', lower(trim(name)), null);
end;
$$;

-- ---------- Talentpunkte ----------
create or replace function public.admin_add_tp(sid uuid, n integer)
returns void language plpgsql security definer set search_path = '' as $$
declare sv public.saves; who text; cur integer;
begin
  perform public.require_admin();
  if n is null or n = 0 or n < -50 or n > 50 then raise exception 'Bitte zwischen -50 und 50 Talentpunkte.'; end if;
  select * into sv from public.saves where id = sid for update;
  if sv.id is null then raise exception 'Spielstand nicht gefunden.'; end if;
  if sv.state is null then raise exception 'Dieser Spielstand wurde noch nie gespielt.'; end if;
  cur := coalesce((sv.state ->> 'bonusTp')::int, 0);
  update public.saves set state = jsonb_set(sv.state, '{bonusTp}', to_jsonb(greatest(0, cur + n))), rev = sv.rev + 1 where id = sid;
  select username into who from public.profiles where id = sv.user_id;
  perform public.admin_note('tp', who, sv.name || ': ' || case when n > 0 then '+' else '' end || n || ' Talentpunkte');
end;
$$;

-- ---------- Admin-Rechte ----------
create or replace function public.admin_set_admin(name text, make boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.uid_of(name);
begin
  perform public.require_admin();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  if make then
    insert into public.admins (user_id) values (o) on conflict do nothing;
  else
    if o = auth.uid() then raise exception 'Du kannst dir die Admin-Rechte nicht selbst entziehen.'; end if;
    delete from public.admins where user_id = o;
  end if;
  perform public.admin_note(case when make then 'admin_on' else 'admin_off' end, lower(trim(name)), null);
end;
$$;

-- ---------- Spielerliste mit Sperre und Talentpunkten ----------
create or replace function public.admin_players(q text default '', lim integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform public.require_admin();
  select coalesce(jsonb_agg(x.j order by x.last desc nulls last), '[]'::jsonb) into res from (
    select p.id,
      (select max(sv.updated_at) from public.saves sv where sv.user_id = p.id) as last,
      jsonb_build_object(
        'username', p.username, 'joined', p.created_at, 'hidden', p.hidden, 'me', p.id = auth.uid(),
        'admin', exists (select 1 from public.admins a where a.user_id = p.id),
        'banned_until', (select u.banned_until from auth.users u where u.id = p.id and u.banned_until > now()),
        'rating', coalesce(s.rating, 1000), 'wins', coalesce(s.wins, 0), 'losses', coalesce(s.losses, 0), 'draws', coalesce(s.draws, 0),
        'friends', (select count(*) from public.friendships f where f.status = 'accepted' and (f.requester = p.id or f.addressee = p.id)),
        'last', (select max(sv.updated_at) from public.saves sv where sv.user_id = p.id),
        'saves', coalesce((select jsonb_agg(jsonb_build_object(
            'id', sv.id, 'name', sv.name, 'mode', sv.mode, 'balance', sv.balance, 'chips', coalesce((sv.state ->> 'balance')::numeric, sv.balance),
            'unlocked', sv.unlocked, 'level', (sv.state ->> 'level')::int, 'tp', coalesce((sv.state ->> 'bonusTp')::int, 0),
            'wagered', sv.wagered, 'play_ms', sv.play_ms, 'updated_at', sv.updated_at)
            order by sv.updated_at desc)
          from public.saves sv where sv.user_id = p.id), '[]'::jsonb)) as j
    from public.profiles p
    left join public.duel_stats s on s.user_id = p.id
    where coalesce(trim(q), '') = '' or left(p.username, char_length(trim(q))) = lower(trim(q))
    order by last desc nulls last
    limit least(greatest(lim, 1), 100)) x;
  return res;
end;
$$;

-- ---------- Übersicht ----------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'players', (select count(*) from public.profiles),
    'new7', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'online', (select count(distinct user_id) from public.saves where updated_at > now() - interval '3 minutes'),
    'active1', (select count(distinct user_id) from public.saves where updated_at > now() - interval '1 day'),
    'active7', (select count(distinct user_id) from public.saves where updated_at > now() - interval '7 days'),
    'saves', (select count(*) from public.saves),
    'modes', (select coalesce(jsonb_object_agg(m.mode, m.c), '{}'::jsonb) from (select mode, count(*) as c from public.saves group by mode) m),
    'chips', (select coalesce(sum(coalesce((state ->> 'balance')::numeric, 0)), 0) from public.saves where mode <> 'sandbox'),
    'duels', (select count(*) from public.duels where status = 'done'),
    'duels1', (select count(*) from public.duels where status = 'done' and finished_at > now() - interval '1 day'),
    'open_duels', (select count(*) from public.duels where status in ('open', 'a_playing', 'b_playing')),
    'friendships', (select count(*) from public.friendships where status = 'accepted'),
    'hidden', (select count(*) from public.profiles where hidden),
    'banned', (select count(*) from auth.users where banned_until > now()),
    'admins', (select count(*) from public.admins),
    'recent_duels', (select coalesce(jsonb_agg(r.j order by r.t desc), '[]'::jsonb) from (
        select d.finished_at as t, jsonb_build_object('a', pa.username, 'b', pb.username, 'game', d.game, 'as', d.a_score, 'bs', d.b_score, 't', d.finished_at) as j
        from public.duels d left join public.profiles pa on pa.id = d.a left join public.profiles pb on pb.id = d.b
        where d.status = 'done' order by d.finished_at desc limit 10) r),
    'recent_players', (select coalesce(jsonb_agg(r.j order by r.t desc), '[]'::jsonb) from (
        select p.created_at as t, jsonb_build_object('username', p.username, 'joined', p.created_at) as j
        from public.profiles p order by p.created_at desc limit 8) r)
  );
end;
$$;

-- ---------- Rechte ----------
revoke all on function public.admin_announce(text) from public, anon;
grant execute on function public.admin_announce(text) to authenticated;
revoke all on function public.admin_clear_announcement() from public, anon;
grant execute on function public.admin_clear_announcement() to authenticated;
revoke all on function public.admin_ban(text, integer) from public, anon;
grant execute on function public.admin_ban(text, integer) to authenticated;
revoke all on function public.admin_unban(text) from public, anon;
grant execute on function public.admin_unban(text) to authenticated;
revoke all on function public.admin_add_tp(uuid, integer) from public, anon;
grant execute on function public.admin_add_tp(uuid, integer) to authenticated;
revoke all on function public.admin_set_admin(text, boolean) from public, anon;
grant execute on function public.admin_set_admin(text, boolean) to authenticated;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
