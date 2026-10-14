-- Chip Empire: Freundesystem verbessern (Spielersuche, eindeutige Rückmeldungen, Limit für offene Anfragen)
-- Einmal im Supabase SQL-Editor ausführen. Baut auf 20261015000000_social.sql auf.

-- Rückgabe: 'sent' (Anfrage verschickt), 'accepted' (die andere Person hatte schon angefragt, jetzt Freunde),
-- 'friends' (seid ihr schon), 'pending' (du hast schon angefragt)
create or replace function public.friend_request(name text)
returns text language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); o uuid := public.uid_of(name); st text; n integer;
begin
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
  if o = u then raise exception 'Das bist du selbst.'; end if;
  update public.friendships set status = 'accepted' where requester = o and addressee = u and status = 'pending';
  if found then return 'accepted'; end if;
  select f.status into st from public.friendships f where (f.requester = u and f.addressee = o) or (f.requester = o and f.addressee = u) limit 1;
  if st = 'accepted' then return 'friends'; end if;
  if st = 'pending' then return 'pending'; end if;
  select count(*) into n from public.friendships where requester = u or addressee = u;
  if n >= 100 then raise exception 'Du hast schon 100 Freunde und Anfragen.'; end if;
  select count(*) into n from public.friendships where requester = u and status = 'pending';
  if n >= 30 then raise exception 'Du hast schon 30 offene Anfragen. Warte, bis jemand antwortet.'; end if;
  insert into public.friendships (requester, addressee) values (u, o);
  return 'sent';
end;
$$;

-- Gibt zurück, ob es die Anfrage noch gab (sie kann inzwischen zurückgezogen worden sein)
drop function if exists public.friend_respond(text, boolean);
create function public.friend_respond(name text, ok boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare u uuid := public.me(); o uuid := public.uid_of(name);
begin
  if ok then update public.friendships set status = 'accepted' where requester = o and addressee = u and status = 'pending';
  else delete from public.friendships where requester = o and addressee = u and status = 'pending';
  end if;
  return found;
end;
$$;

-- Spieler nach Namensanfang suchen, mit Beziehung zu mir
create or replace function public.player_search(q text)
returns table (username text, state text, rating integer, level integer, unlocked smallint)
language sql stable security definer set search_path = '' as $$
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
    and p.id <> auth.uid()
  order by p.username
  limit 8;
$$;

revoke all on function public.friend_respond(text, boolean) from public, anon;
grant execute on function public.friend_respond(text, boolean) to authenticated;
revoke all on function public.player_search(text) from public, anon;
grant execute on function public.player_search(text) to authenticated;
