-- Chip Empire: Benutzername ändern, Legenden-Ränge im Profil, neue Admin-Werkzeuge
-- Einmal im Supabase SQL-Editor ausführen (oder per `supabase db push`). Baut auf 20261013 bis 20261024 auf.
-- Ergänzt nur: Spieler mit noch offenem altem Tab spielen ohne Fehler weiter.

-- ---------- Benutzername ändern ----------
-- Login läuft über <name>@bananemdnaa.github.io, deshalb ändern sich Profil, Login-Adresse und Metadaten zusammen.
alter table public.profiles add column if not exists name_changed_at timestamptz;

create or replace function public.rename_user_internal(o uuid, new_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare nn text := lower(trim(coalesce(new_name, ''))); mail text;
begin
  if nn !~ '^[a-z0-9_-]{3,16}$' then raise exception 'Benutzername: 3 bis 16 Zeichen, nur a–z, 0–9, _ und -.'; end if;
  if public.bad_name(nn) then raise exception 'Dieser Benutzername ist nicht erlaubt.'; end if;
  if exists (select 1 from public.profiles where username = nn and id <> o) then raise exception 'Diesen Benutzernamen gibt es schon.'; end if;
  mail := nn || '@bananemdnaa.github.io';
  update public.profiles set username = nn, name_changed_at = now() where id = o;
  update auth.users set email = mail,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', nn)
    where id = o;
  update auth.identities set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', mail)
    where user_id = o and provider = 'email';
  return nn;
end;
$$;
revoke all on function public.rename_user_internal(uuid, text) from public, anon, authenticated;

-- Eigener Name: höchstens einmal alle 7 Tage
create or replace function public.change_username(new_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); last timestamptz; old text;
begin
  select name_changed_at, username into last, old from public.profiles where id = u;
  if lower(trim(coalesce(new_name, ''))) = old then raise exception 'Das ist schon dein Name.'; end if;
  if last is not null and last > now() - interval '7 days' then
    raise exception 'Du kannst deinen Namen erst wieder ab % ändern.', to_char(last + interval '7 days', 'DD.MM.YYYY');
  end if;
  return public.rename_user_internal(u, new_name);
end;
$$;
revoke all on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

create or replace function public.name_change_info()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('changed_at', name_changed_at, 'next', name_changed_at + interval '7 days')
  from public.profiles where id = auth.uid();
$$;
revoke all on function public.name_change_info() from public, anon;
grant execute on function public.name_change_info() to authenticated;

-- Admin: Spieler umbenennen (z. B. bei unpassendem Namen), ohne Wartezeit
create or replace function public.admin_rename_user(name text, new_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.uid_of(name); nn text;
begin
  perform public.require_admin();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  perform public.check_target(o);
  nn := public.rename_user_internal(o, new_name);
  perform public.admin_note('rename_user', nn, lower(trim(name)) || ' → ' || nn);
end;
$$;
revoke all on function public.admin_rename_user(text, text) from public, anon;
grant execute on function public.admin_rename_user(text, text) to authenticated;

-- ---------- Admin: Legenden-Sterne setzen ----------
create or replace function public.admin_set_stars(sid uuid, n integer)
returns void language plpgsql security definer set search_path = '' as $$
declare sv public.saves; who text;
begin
  perform public.require_admin();
  if n is null or n < 0 or n > 99 then raise exception 'Sterne zwischen 0 und 99.'; end if;
  select * into sv from public.saves where id = sid for update;
  if sv.id is null then raise exception 'Spielstand nicht gefunden.'; end if;
  perform public.check_target(sv.user_id);
  if sv.state is null then raise exception 'Dieser Spielstand wurde noch nie gespielt.'; end if;
  if sv.mode <> 'career' then raise exception 'Legenden-Sterne gibt es nur in der Karriere.'; end if;
  update public.saves set state = jsonb_set(sv.state, '{stars}', to_jsonb(n)), rev = sv.rev + 1 where id = sid;
  select username into who from public.profiles where id = sv.user_id;
  perform public.admin_note('stars', who, sv.name || ': ' || coalesce(public.jnum(sv.state -> 'stars'), 0)::integer || ' → ' || n || ' Sterne');
end;
$$;
revoke all on function public.admin_set_stars(uuid, integer) from public, anon;
grant execute on function public.admin_set_stars(uuid, integer) to authenticated;

-- ---------- Geschenke an einzelne Spieler ----------
alter table public.gifts add column if not exists target_user uuid references auth.users (id) on delete cascade;

create or replace function public.gift_claim()
returns table (id bigint, chips bigint, tp integer, message text)
language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me();
begin
  return query
    with g as (
      select gf.id, gf.chips, gf.tp, gf.message from public.gifts gf
      where gf.active and gf.expires_at > now() and (gf.target_user is null or gf.target_user = u)
        and not exists (select 1 from public.gift_claims c where c.gift_id = gf.id and c.user_id = u)),
    ins as (insert into public.gift_claims (gift_id, user_id) select g.id, u from g on conflict do nothing returning gift_claims.gift_id)
    select g.id, g.chips, g.tp, g.message from g join ins on ins.gift_id = g.id;
end;
$$;
revoke all on function public.gift_claim() from public, anon;
grant execute on function public.gift_claim() to authenticated;

create or replace function public.admin_gift_player(name text, chips bigint, tp integer, msg text)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.uid_of(name); m text := nullif(trim(coalesce(msg, '')), '');
begin
  perform public.require_admin();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  perform public.check_target(o);
  if coalesce(chips, 0) < 0 or coalesce(chips, 0) > 1000000000 then raise exception 'Chips zwischen 0 und 1 Mrd.'; end if;
  if coalesce(tp, 0) < 0 or coalesce(tp, 0) > 10 then raise exception 'Talentpunkte zwischen 0 und 10.'; end if;
  if coalesce(chips, 0) = 0 and coalesce(tp, 0) = 0 then raise exception 'Ein Geschenk braucht Chips oder Talentpunkte.'; end if;
  if char_length(m) > 200 then raise exception 'Die Nachricht hat höchstens 200 Zeichen.'; end if;
  insert into public.gifts (chips, tp, message, created_by, expires_at, target_user)
    values (coalesce(chips, 0), coalesce(tp, 0), m, (select username from public.profiles where id = auth.uid()), now() + interval '30 days', o);
  perform public.admin_note('gift_player', lower(trim(name)), coalesce(chips, 0) || ' Chips, ' || coalesce(tp, 0) || ' TP' || coalesce(': ' || m, ''));
end;
$$;
revoke all on function public.admin_gift_player(text, bigint, integer, text) from public, anon;
grant execute on function public.admin_gift_player(text, bigint, integer, text) to authenticated;

create or replace function public.admin_gifts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform public.require_admin();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', g.id, 'chips', g.chips, 'tp', g.tp, 'message', g.message, 'active', g.active and g.expires_at > now(),
      'created_by', g.created_by, 'created_at', g.created_at, 'expires_at', g.expires_at,
      'target', (select p.username from public.profiles p where p.id = g.target_user),
      'claims', (select count(*) from public.gift_claims c where c.gift_id = g.id)) order by g.created_at desc), '[]'::jsonb)
    into res from (select * from public.gifts order by created_at desc limit 30) g;
  return res;
end;
$$;

-- ---------- Spielerliste: Sterne und Namensänderung ----------
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
$$;

-- ---------- Profil: Legenden-Sterne je Spielstand ----------
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
        'stars', coalesce(public.jnum(sv.state -> 'stars'), 0)::integer,
        'updated_at', sv.updated_at) order by sv.balance desc)
      from public.saves sv where sv.user_id = o), '[]'::jsonb)
  ) into res
  from public.profiles p left join public.duel_stats s on s.user_id = p.id
  where p.id = o;
  return res;
end;
$$;
revoke all on function public.player_profile(text) from public;
grant execute on function public.player_profile(text) to anon, authenticated;
