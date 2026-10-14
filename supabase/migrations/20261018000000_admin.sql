-- Chip Empire: Admin-Panel
-- Einmal im Supabase SQL-Editor ausführen. Baut auf den bisherigen Migrationen auf.
-- Jede Admin-Funktion prüft auf dem Server, ob der Aufrufer in public.admins steht.
--
-- Admin eintragen (Benutzernamen anpassen und einmal ausführen):
--   insert into public.admins (user_id) select id from public.profiles where username = 'dein_name' on conflict do nothing;

-- ---------- Tabellen ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- Wer aus den Ranglisten genommen wurde
alter table public.profiles add column if not exists hidden boolean not null default false;

-- Protokoll aller Admin-Aktionen
create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  admin uuid references auth.users (id) on delete set null,
  admin_name text,
  action text not null,
  target text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists admin_log_time_idx on public.admin_log (created_at desc);
alter table public.admin_log enable row level security;

-- ---------- Hilfsfunktionen ----------
create or replace function public.am_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.require_admin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null or not exists (select 1 from public.admins where user_id = u) then
    raise exception 'Keine Admin-Rechte.';
  end if;
  return u;
end;
$$;
revoke all on function public.require_admin() from public, anon, authenticated;

create or replace function public.admin_note(act text, tgt text, det text)
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_log (admin, admin_name, action, target, detail)
  select auth.uid(), (select username from public.profiles where id = auth.uid()), act, tgt, det;
$$;
revoke all on function public.admin_note(text, text, text) from public, anon, authenticated;

-- ---------- Spieler ansehen ----------
-- Spieler nach Namensanfang (leer: zuletzt aktive), mit Spielständen, Wertung und Status
create or replace function public.admin_players(q text default '', lim integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform public.require_admin();
  select coalesce(jsonb_agg(x.j order by x.last desc nulls last), '[]'::jsonb) into res from (
    select p.id,
      (select max(sv.updated_at) from public.saves sv where sv.user_id = p.id) as last,
      jsonb_build_object(
        'username', p.username, 'joined', p.created_at, 'hidden', p.hidden,
        'admin', exists (select 1 from public.admins a where a.user_id = p.id),
        'rating', coalesce(s.rating, 1000), 'wins', coalesce(s.wins, 0), 'losses', coalesce(s.losses, 0), 'draws', coalesce(s.draws, 0),
        'last', (select max(sv.updated_at) from public.saves sv where sv.user_id = p.id),
        'saves', coalesce((select jsonb_agg(jsonb_build_object(
            'id', sv.id, 'name', sv.name, 'mode', sv.mode, 'balance', sv.balance, 'chips', coalesce((sv.state ->> 'balance')::numeric, sv.balance),
            'unlocked', sv.unlocked, 'level', (sv.state ->> 'level')::int, 'wagered', sv.wagered, 'play_ms', sv.play_ms, 'updated_at', sv.updated_at)
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

-- ---------- Aktionen ----------
-- Chips eines Spielstands setzen. Die Revision steigt, damit ein offenes Spiel des Spielers den neuen Stand lädt,
-- statt ihn mit seinem alten zu überschreiben.
create or replace function public.admin_set_chips(sid uuid, amount bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare sv public.saves; who text;
begin
  perform public.require_admin();
  if amount is null or amount < 0 or amount > 1000000000000 then raise exception 'Ungültiger Betrag.'; end if;
  select * into sv from public.saves where id = sid for update;
  if sv.id is null then raise exception 'Spielstand nicht gefunden.'; end if;
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
  select username into who from public.profiles where id = sv.user_id;
  delete from public.saves where id = sid;
  perform public.admin_note('delete_save', who, sv.name || ' (' || sv.mode || ', ' || sv.balance || ')');
end;
$$;

create or replace function public.admin_set_hidden(name text, hide boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.uid_of(name);
begin
  perform public.require_admin();
  if o is null then raise exception 'Diesen Spieler gibt es nicht.'; end if;
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
  select rating into old from public.duel_stats where user_id = o;
  delete from public.duel_stats where user_id = o;
  perform public.admin_note('reset_rating', lower(trim(name)), coalesce(old, 1000) || ' → 1000');
end;
$$;

create or replace function public.admin_log_list(lim integer default 40)
returns table (admin_name text, action text, target text, detail text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select l.admin_name, l.action, l.target, l.detail, l.created_at
    from public.admin_log l order by l.created_at desc limit least(greatest(lim, 1), 200);
end;
$$;

-- ---------- Ranglisten ohne ausgeblendete Spieler ----------
create or replace function public.leaderboard(lim integer default 20, md text default 'career')
returns table (username text, save_name text, balance bigint, unlocked smallint, wagered bigint, play_ms bigint, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.username, s.name, s.balance, s.unlocked, s.wagered, s.play_ms, s.updated_at
  from public.saves s
  join public.profiles p on p.id = s.user_id
  where s.mode = case when md in ('career', 'empire') then md else 'career' end
    and not p.hidden
  order by s.balance desc
  limit least(greatest(lim, 1), 100);
$$;

create or replace function public.duel_board(lim integer default 20)
returns table (username text, rating integer, wins integer, losses integer, draws integer)
language sql stable security definer set search_path = '' as $$
  select p.username, s.rating, s.wins, s.losses, s.draws
  from public.duel_stats s join public.profiles p on p.id = s.user_id
  where s.wins + s.losses + s.draws > 0 and not p.hidden
  order by s.rating desc, s.wins desc
  limit least(greatest(lim, 1), 100);
$$;

-- ---------- Rechte ----------
revoke all on function public.am_admin() from public, anon;
grant execute on function public.am_admin() to authenticated;
revoke all on function public.admin_players(text, integer) from public, anon;
grant execute on function public.admin_players(text, integer) to authenticated;
revoke all on function public.admin_set_chips(uuid, bigint) from public, anon;
grant execute on function public.admin_set_chips(uuid, bigint) to authenticated;
revoke all on function public.admin_delete_save(uuid) from public, anon;
grant execute on function public.admin_delete_save(uuid) to authenticated;
revoke all on function public.admin_set_hidden(text, boolean) from public, anon;
grant execute on function public.admin_set_hidden(text, boolean) to authenticated;
revoke all on function public.admin_reset_rating(text) from public, anon;
grant execute on function public.admin_reset_rating(text) to authenticated;
revoke all on function public.admin_log_list(integer) from public, anon;
grant execute on function public.admin_log_list(integer) to authenticated;
