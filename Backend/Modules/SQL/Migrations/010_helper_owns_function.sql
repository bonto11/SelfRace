-- Pomocná funkcia, aby boli politiky pre ostatné tabuľky jednoduché
create or replace function public.owns_user_id(u_id integer)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = u_id
      and p.auth_uid = auth.uid()
  );
$$;
