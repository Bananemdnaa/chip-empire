-- Chip Empire: Profile, Spielstände in der Cloud und Bestenliste
-- Einmal im Supabase SQL-Editor ausführen (oder per `supabase db push`).

-- ---------- Profile (Benutzername pro Konto) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_-]{3,16}$'),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "Profile sind öffentlich lesbar" on public.profiles;
create policy "Profile sind öffentlich lesbar" on public.profiles
  for select using (true);

-- Profil automatisch beim Registrieren anlegen (Benutzername kommt aus den Metadaten)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Spielstände ----------
create table if not exists public.saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  mode text not null check (mode in ('career', 'sandbox')),
  state jsonb,
  rev integer not null default 1,
  balance bigint not null default 0,
  unlocked smallint not null default 0,
  wagered bigint not null default 0,
  play_ms bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saves_user_idx on public.saves (user_id);
create index if not exists saves_board_idx on public.saves (mode, balance desc);
alter table public.saves enable row level security;

drop policy if exists "Eigene Spielstände lesen" on public.saves;
create policy "Eigene Spielstände lesen" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Eigene Spielstände anlegen" on public.saves;
create policy "Eigene Spielstände anlegen" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Eigene Spielstände ändern" on public.saves;
create policy "Eigene Spielstände ändern" on public.saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Eigene Spielstände löschen" on public.saves;
create policy "Eigene Spielstände löschen" on public.saves
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Höchstens 3 Spielstände pro Konto, updated_at automatisch setzen
create or replace function public.saves_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.saves where user_id = new.user_id) >= 3 then
    raise exception 'Maximal 3 Spielstände pro Konto';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists saves_guard on public.saves;
create trigger saves_guard
  before insert or update on public.saves
  for each row execute function public.saves_guard();

-- ---------- Bestenliste (nur Karriere, für alle lesbar, ohne Spielstand-Details) ----------
create or replace function public.leaderboard(lim integer default 20)
returns table (username text, save_name text, balance bigint, unlocked smallint, wagered bigint, play_ms bigint, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.username, s.name, s.balance, s.unlocked, s.wagered, s.play_ms, s.updated_at
  from public.saves s
  join public.profiles p on p.id = s.user_id
  where s.mode = 'career'
  order by s.balance desc
  limit least(greatest(lim, 1), 100);
$$;
revoke all on function public.leaderboard(integer) from public;
grant execute on function public.leaderboard(integer) to anon, authenticated;
