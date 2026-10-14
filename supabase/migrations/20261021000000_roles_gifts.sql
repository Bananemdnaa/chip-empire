-- Chip Empire: Rollen (Owner und Admin), Notizen, Sperrgrund, Duelle annullieren, Geschenke an alle
-- Einmal im Supabase SQL-Editor ausführen. Baut auf den Admin-Migrationen 20261018 bis 20261020 auf.
--
-- Owner wird automatisch, wer als Erstes in public.admins eingetragen wurde. Anders festlegen:
--   update public.admins set role = 'admin';
--   update public.admins set role = 'owner' where user_id = (select id from public.profiles where username = 'dein_name');

-- ---------- Rollen ----------
alter table public.admins add column if not exists role text not null default 'admin';
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('owner', 'admin'));
update public.admins set role = 'owner'
  where user_id = (select user_id from public.admins order by created_at, user_id limit 1)
    and not exists (select 1 from public.admins where role = 'owner');

create or replace function public.role_of(u uuid)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.admins where user_id = u;
$$;
revoke all on function public.role_of(uuid) from public, anon, authenticated;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.admins where user_id = auth.uid();
$$;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

create or replace function public.require_owner()
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if public.role_of(auth.uid()) is distinct from 'owner' then raise exception 'Das darf nur der Owner.'; end if;
  return auth.uid();
end;
$$;
revoke all on function public.require_owner() from public, anon, authenticated;

-- Darf der Aufrufer diesen Spieler bearbeiten? Owner: alle. Admins: normale Spieler und sich selbst.
create or replace function public.check_target(o uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if public.role_of(o) is null or o = auth.uid() or public.role_of(auth.uid()) = 'owner' then return; end if;
  raise exception 'Admins und den Owner kann nur der Owner bearbeiten.';
end;
$$;
revoke all on function public.check_target(uuid) from public, anon, authenticated;

-- ---------- Private Notizen und Sperrgrund ----------
create table if not exists public.admin_notes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  ban_reason text,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.admin_notes enable row level security;

create or replace function public.admin_set_note(name text, txt text)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.uid_of(name); t text := nullif(trim(coalesce(txt, '')), '');
begin
  perform public.require_admin();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  if char_length(t) > 500 then raise exception 'Notizen haben höchstens 500 Zeichen.'; end if;
  insert into public.admin_notes (user_id, note, updated_by, updated_at)
    values (o, t, (select username from public.profiles where id = auth.uid()), now())
    on conflict (user_id) do update set note = excluded.note, updated_by = excluded.updated_by, updated_at = now();
  perform public.admin_note('note', lower(trim(name)), t);
end;
$$;

-- ---------- Bestehende Aktionen mit Rollenprüfung ----------
create or replace function public.admin_set_chips(sid uuid, amount bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare sv public.saves; who text;
begin
  perform public.require_admin();
  if amount is null or amount < 0 or amount > 1000000000000 then raise exception 'Ungültiger Betrag.'; end if;
  select * into sv from public.saves where id = sid for update;
  if sv.id is null then raise exception 'Spielstand nicht gefunden.'; end if;
  perform public.check_target(sv.user_id);
  if sv.state is null then raise exception 'Dieser Spielstand wurde noch nie gespielt.'; end if;
  update public.saves set
    state = jsonb_set(jsonb_set(sv.state, '{balance}', to_jsonb(amount)), '{escrow}', '0'::jsonb),
    balance = case when sv.mode = 'empire' then amount + coalesce((sv.state ->> 'bizSpent')::numeric, 0)::bigint else amount end,
    rev = sv.rev + 1
  where id = sid;
  select username into who from public.profiles where id = sv.user_id;
  perform public.admin_note('chips', who, sv.name || ': ' || coalesce((sv.state ->> 'balance')::numeric, 0)::bigint || ' → ' || amount);
end;
$$;

create or replace function public.admin_delete_save(sid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare sv public.saves; who text;
begin
  perform public.require_admin();
  select * into sv from public.saves where id = sid;
  if sv.id is null then raise exception 'Spielstand nicht gefunden.'; end if;
  perform public.check_target(sv.user_id);
  select username into who from public.profiles where id = sv.user_id;
  delete from public.saves where id = sid;
  perform public.admin_note('delete_save', who, sv.name || ' (' || sv.mode || ', ' || sv.balance || ')');
end;
$$;

create or replace function public.admin_rename_save(sid uuid, new_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare sv public.saves; who text; nn text := regexp_replace(trim(coalesce(new_name, '')), '\s+', ' ', 'g');
begin
  perform public.require_admin();
  if char_length(nn) < 1 or char_length(nn) > 20 then raise exception 'Der Name braucht 1 bis 20 Zeichen.'; end if;
  if public.bad_name(nn) then raise exception 'Dieser Name ist nicht erlaubt.'; end if;
  select * into sv from public.saves where id = sid for update;
  if sv.id is null then raise exception 'Spielstand nicht gefunden.'; end if;
  perform public.check_target(sv.user_id);
  update public.saves set name = nn, rev = sv.rev + 1 where id = sid;
  select username into who from public.profiles where id = sv.user_id;
  perform public.admin_note('rename_save', who, sv.name || ' → ' || nn);
end;
$$;

create or replace function public.admin_add_tp(sid uuid, n integer)
returns void language plpgsql security definer set search_path = '' as $$
declare sv public.saves; who text; cur integer;
begin
  perform public.require_admin();
  if n is null or n = 0 or n < -50 or n > 50 then raise exception 'Bitte zwischen -50 und 50 Talentpunkte.'; end if;
  select * into sv from public.saves where id = sid for update;
  if sv.id is null then raise exception 'Spielstand nicht gefunden.'; end if;
  perform public.check_target(sv.user_id);
  if sv.state is null then raise exception 'Dieser Spielstand wurde noch nie gespielt.'; end if;
  cur := coalesce((sv.state ->> 'bonusTp')::int, 0);
  update public.saves set state = jsonb_set(sv.state, '{bonusTp}', to_jsonb(greatest(0, cur + n))), rev = sv.rev + 1 where id = sid;
  select username into who from public.profiles where id = sv.user_id;
  perform public.admin_note('tp', who, sv.name || ': ' || case when n > 0 then '+' else '' end || n || ' Talentpunkte');
end;
$$;

create or replace function public.admin_set_hidden(name text, hide boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.uid_of(name);
begin
  perform public.require_admin();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  perform public.check_target(o);
  update public.profiles set hidden = hide where id = o;
  perform public.admin_note(case when hide then 'hide' else 'show' end, lower(trim(name)), null);
end;
$$;

create or replace function public.admin_reset_rating(name text)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.uid_of(name); old integer;
begin
  perform public.require_admin();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  perform public.check_target(o);
  select rating into old from public.duel_stats where user_id = o;
  delete from public.duel_stats where user_id = o;
  perform public.admin_note('reset_rating', lower(trim(name)), coalesce(old, 1000) || ' → 1000');
end;
$$;

drop function if exists public.admin_ban(text, integer);
create or replace function public.admin_ban(name text, days integer default null, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.uid_of(name); r text := nullif(trim(coalesce(reason, '')), '');
begin
  perform public.require_admin();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  if o = auth.uid() then raise exception 'Du kannst dich nicht selbst sperren.'; end if;
  if public.role_of(o) = 'owner' then raise exception 'Der Owner kann nicht gesperrt werden.'; end if;
  perform public.check_target(o);
  if days is not null and (days < 1 or days > 3650) then raise exception 'Ungültige Dauer.'; end if;
  if char_length(r) > 200 then raise exception 'Der Grund hat höchstens 200 Zeichen.'; end if;
  update auth.users set banned_until = now() + case when days is null then interval '100 years' else make_interval(days => days) end where id = o;
  update public.profiles set hidden = true where id = o;
  insert into public.admin_notes (user_id, ban_reason, updated_by, updated_at)
    values (o, r, (select username from public.profiles where id = auth.uid()), now())
    on conflict (user_id) do update set ban_reason = excluded.ban_reason, updated_by = excluded.updated_by, updated_at = now();
  perform public.admin_note('ban', lower(trim(name)), case when days is null then 'dauerhaft' else days || ' Tage' end || coalesce(': ' || r, ''));
end;
$$;

create or replace function public.admin_unban(name text)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.uid_of(name);
begin
  perform public.require_admin();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  perform public.check_target(o);
  update auth.users set banned_until = null where id = o;
  update public.admin_notes set ban_reason = null where user_id = o;
  perform public.admin_note('unban', lower(trim(name)), null);
end;
$$;

-- Nur der Owner ernennt und entlässt Admins; die Owner-Rolle selbst ändert man nur per SQL
create or replace function public.admin_set_admin(name text, make boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.uid_of(name);
begin
  perform public.require_owner();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  if public.role_of(o) = 'owner' then raise exception 'Die Owner-Rolle lässt sich hier nicht ändern.'; end if;
  if make then insert into public.admins (user_id, role) values (o, 'admin') on conflict do nothing;
  else delete from public.admins where user_id = o;
  end if;
  perform public.admin_note(case when make then 'admin_on' else 'admin_off' end, lower(trim(name)), null);
end;
$$;

-- ---------- Spielerliste mit Rolle, Notiz und Sperrgrund ----------
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
        'role', public.role_of(p.id), 'admin', public.role_of(p.id) is not null,
        'note', n.note, 'ban_reason', n.ban_reason, 'note_by', n.updated_by,
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
    left join public.admin_notes n on n.user_id = p.id
    where coalesce(trim(q), '') = '' or left(p.username, char_length(trim(q))) = lower(trim(q))
    order by last desc nulls last
    limit least(greatest(lim, 1), 100)) x;
  return res;
end;
$$;

-- ---------- Duelle ansehen und annullieren ----------
alter table public.duels drop constraint if exists duels_status_check;
alter table public.duels add constraint duels_status_check check (status in ('a_playing', 'open', 'b_playing', 'done', 'declined', 'expired', 'void'));

create or replace function public.admin_duels(q text default '', lim integer default 40)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb; o uuid := case when coalesce(trim(q), '') = '' then null else public.uid_of(q) end;
begin
  perform public.require_admin();
  if coalesce(trim(q), '') <> '' and o is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(x.j order by x.t desc), '[]'::jsonb) into res from (
    select coalesce(d.finished_at, d.created_at) as t, jsonb_build_object(
      'id', d.id, 'game', d.game, 'status', d.status, 'a', pa.username, 'b', pb.username, 'as', d.a_score, 'bs', d.b_score,
      'ad', d.a_delta, 'bd', d.b_delta, 'created_at', d.created_at, 'finished_at', d.finished_at) as j
    from public.duels d left join public.profiles pa on pa.id = d.a left join public.profiles pb on pb.id = d.b
    where o is null or d.a = o or d.b = o
    order by coalesce(d.finished_at, d.created_at) desc
    limit least(greatest(lim, 1), 100)) x;
  return res;
end;
$$;

-- Wertungsänderung und Sieg/Niederlage für beide zurücknehmen, Duell als annulliert markieren
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
  elsif d.status not in ('a_playing', 'open', 'b_playing') then
    raise exception 'Dieses Duell ist schon abgeschlossen.';
  end if;
  update public.duels set status = 'void', finished_at = coalesce(d.finished_at, now()) where id = did;
  perform public.admin_note('void_duel',
    (select username from public.profiles where id = d.a) || ' gegen ' || coalesce((select username from public.profiles where id = d.b), 'offen'),
    d.game || ', ' || coalesce(d.a_score::text, '–') || ' : ' || coalesce(d.b_score::text, '–'));
end;
$$;

-- ---------- Geschenke an alle ----------
create table if not exists public.gifts (
  id bigint generated always as identity primary key,
  chips bigint not null default 0 check (chips between 0 and 1000000000),
  tp integer not null default 0 check (tp between 0 and 10),
  message text check (char_length(message) <= 200),
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.gifts enable row level security;
create table if not exists public.gift_claims (
  gift_id bigint not null references public.gifts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (gift_id, user_id)
);
alter table public.gift_claims enable row level security;

-- Holt alle noch nicht abgeholten Geschenke und markiert sie als abgeholt (einmal pro Konto)
create or replace function public.gift_claim()
returns table (id bigint, chips bigint, tp integer, message text)
language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me();
begin
  return query
    with g as (
      select gf.id, gf.chips, gf.tp, gf.message from public.gifts gf
      where gf.active and gf.expires_at > now()
        and not exists (select 1 from public.gift_claims c where c.gift_id = gf.id and c.user_id = u)),
    ins as (insert into public.gift_claims (gift_id, user_id) select g.id, u from g on conflict do nothing returning gift_claims.gift_id)
    select g.id, g.chips, g.tp, g.message from g join ins on ins.gift_id = g.id;
end;
$$;
revoke all on function public.gift_claim() from public, anon;
grant execute on function public.gift_claim() to authenticated;

create or replace function public.admin_gift_create(chips bigint, tp integer, msg text, days integer)
returns void language plpgsql security definer set search_path = '' as $$
declare m text := nullif(trim(coalesce(msg, '')), '');
begin
  perform public.require_admin();
  if coalesce(chips, 0) < 0 or coalesce(chips, 0) > 1000000000 then raise exception 'Chips zwischen 0 und 1 Mrd.'; end if;
  if coalesce(tp, 0) < 0 or coalesce(tp, 0) > 10 then raise exception 'Talentpunkte zwischen 0 und 10.'; end if;
  if coalesce(chips, 0) = 0 and coalesce(tp, 0) = 0 then raise exception 'Ein Geschenk braucht Chips oder Talentpunkte.'; end if;
  if days is null or days < 1 or days > 60 then raise exception 'Gültig für 1 bis 60 Tage.'; end if;
  if char_length(m) > 200 then raise exception 'Die Nachricht hat höchstens 200 Zeichen.'; end if;
  insert into public.gifts (chips, tp, message, created_by, expires_at)
    values (coalesce(chips, 0), coalesce(tp, 0), m, (select username from public.profiles where id = auth.uid()), now() + make_interval(days => days));
  perform public.admin_note('gift', null, coalesce(chips, 0) || ' Chips, ' || coalesce(tp, 0) || ' TP, ' || days || ' Tage' || coalesce(': ' || m, ''));
end;
$$;

create or replace function public.admin_gifts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform public.require_admin();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', g.id, 'chips', g.chips, 'tp', g.tp, 'message', g.message, 'active', g.active and g.expires_at > now(),
      'created_by', g.created_by, 'created_at', g.created_at, 'expires_at', g.expires_at,
      'claims', (select count(*) from public.gift_claims c where c.gift_id = g.id)) order by g.created_at desc), '[]'::jsonb)
    into res from (select * from public.gifts order by created_at desc limit 30) g;
  return res;
end;
$$;

create or replace function public.admin_gift_stop(gid bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.gifts set active = false where id = gid;
  perform public.admin_note('gift_stop', null, '#' || gid);
end;
$$;

-- ---------- Übersicht mit Team ----------
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
    'team', (select coalesce(jsonb_agg(jsonb_build_object('username', p.username, 'role', a.role, 'since', a.created_at) order by a.role = 'owner' desc, p.username), '[]'::jsonb)
      from public.admins a join public.profiles p on p.id = a.user_id),
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
revoke all on function public.admin_set_note(text, text) from public, anon;
grant execute on function public.admin_set_note(text, text) to authenticated;
revoke all on function public.admin_ban(text, integer, text) from public, anon;
grant execute on function public.admin_ban(text, integer, text) to authenticated;
revoke all on function public.admin_duels(text, integer) from public, anon;
grant execute on function public.admin_duels(text, integer) to authenticated;
revoke all on function public.admin_void_duel(uuid) from public, anon;
grant execute on function public.admin_void_duel(uuid) to authenticated;
revoke all on function public.admin_gift_create(bigint, integer, text, integer) from public, anon;
grant execute on function public.admin_gift_create(bigint, integer, text, integer) to authenticated;
revoke all on function public.admin_gifts() from public, anon;
grant execute on function public.admin_gifts() to authenticated;
revoke all on function public.admin_gift_stop(bigint) from public, anon;
grant execute on function public.admin_gift_stop(bigint) to authenticated;
