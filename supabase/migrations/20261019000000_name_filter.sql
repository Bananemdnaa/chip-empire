-- Chip Empire: Namensfilter und Umbenennen von Spielständen im Admin-Panel
-- Einmal im Supabase SQL-Editor ausführen. Baut auf 20261018000000_admin.sql auf.
-- Die Wortliste steht auch in js/store.js (Store.badName). Bei Änderungen beide Stellen anpassen.

-- ---------- Filter ----------
-- Vereinheitlicht Schreibweisen (Kleinbuchstaben, Umlaute, 0→o, 1→i, 4→a, @→a …, nur Buchstaben) und
-- sucht jedes Wort mit beliebig verdoppelten Buchstaben, z. B. "N1gg4a" oder "h i t l e r".
create or replace function public.bad_name(n text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  s text; w text;
  words text[] := array[
    'nigger', 'nigga', 'neger', 'kanake', 'kanacke', 'zigeuner', 'schwuchtel', 'faggot', 'tranny', 'chink', 'wetback',
    'retard', 'spast', 'missgeburt', 'judensau', 'hitler', 'siegheil', 'nazi',
    'hurensohn', 'hure', 'whore', 'nutte', 'fotze', 'cunt', 'wichser', 'arschloch', 'schlampe', 'bitch', 'slut',
    'fuck', 'fick', 'porno', 'penis'];
begin
  s := lower(coalesce(n, ''));
  s := replace(s, 'ß', 'ss');
  s := translate(s, 'äöü0134578@$!|', 'aouoieastbasii');
  s := regexp_replace(s, '[^a-z]', '', 'g');
  foreach w in array words loop
    if s ~ regexp_replace(w, '(.)', '\1+', 'g') then return true; end if;
  end loop;
  return false;
end;
$$;
grant execute on function public.bad_name(text) to anon, authenticated;

-- Spielstände: neue mit unzulässigem Namen ablehnen; bei Änderungen still auf einen erlaubten Namen ausweichen,
-- damit ein laufendes Spiel weiter speichern kann
create or replace function public.saves_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.saves where user_id = new.user_id) >= 3 then
    raise exception 'Maximal 3 Spielstände pro Konto';
  end if;
  if public.bad_name(new.name) then
    if tg_op = 'INSERT' and new.state is null then raise exception 'Dieser Name ist nicht erlaubt.'; end if;
    new.name := case when tg_op = 'UPDATE' and not public.bad_name(old.name) then old.name else 'Spielstand' end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Benutzernamen: unzulässige gar nicht erst anlegen
create or replace function public.profiles_name_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.bad_name(new.username) then raise exception 'Dieser Benutzername ist nicht erlaubt.'; end if;
  return new;
end;
$$;
drop trigger if exists profiles_name_guard on public.profiles;
create trigger profiles_name_guard
  before insert or update of username on public.profiles
  for each row execute function public.profiles_name_guard();

-- ---------- Bestehende Namen bereinigen ----------
update public.saves set name = 'Spielstand' where public.bad_name(name);
update public.profiles set hidden = true where public.bad_name(username);

-- ---------- Admin: Spielstand umbenennen ----------
-- Die Revision steigt, damit ein offenes Spiel den neuen Namen lädt, statt den alten zurückzuschreiben
create or replace function public.admin_rename_save(sid uuid, new_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare sv public.saves; who text; nn text := regexp_replace(trim(coalesce(new_name, '')), '\s+', ' ', 'g');
begin
  perform public.require_admin();
  if char_length(nn) < 1 or char_length(nn) > 20 then raise exception 'Der Name braucht 1 bis 20 Zeichen.'; end if;
  if public.bad_name(nn) then raise exception 'Dieser Name ist nicht erlaubt.'; end if;
  select * into sv from public.saves where id = sid for update;
  if sv.id is null then raise exception 'Spielstand nicht gefunden.'; end if;
  update public.saves set name = nn, rev = sv.rev + 1 where id = sid;
  select username into who from public.profiles where id = sv.user_id;
  perform public.admin_note('rename_save', who, sv.name || ' → ' || nn);
end;
$$;
revoke all on function public.admin_rename_save(uuid, text) from public, anon;
grant execute on function public.admin_rename_save(uuid, text) to authenticated;
