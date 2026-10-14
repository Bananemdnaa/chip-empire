-- Chip Empire: Admin-Panel zeigt, wer gerade online ist
-- Einmal im Supabase SQL-Editor ausführen (oder per `supabase db push`).
-- „Online“ heißt: Ein Spielstand des Kontos wurde in den letzten 3 Minuten gespeichert (das Spiel speichert beim Spielen laufend).

create or replace function public.admin_online()
returns table (username text, save_name text, mode text, game text, balance bigint, unlocked smallint, stars integer, seen timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
    select distinct on (s.user_id)
      p.username, s.name, s.mode, coalesce(s.state ->> 'game', ''), s.balance, s.unlocked,
      coalesce(public.jnum(s.state -> 'stars'), 0)::integer, s.updated_at
    from public.saves s
    join public.profiles p on p.id = s.user_id
    where s.updated_at > now() - interval '3 minutes'
    order by s.user_id, s.updated_at desc;
end;
$$;
revoke all on function public.admin_online() from public;
grant execute on function public.admin_online() to authenticated;
