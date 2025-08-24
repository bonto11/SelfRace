-- Zapni RLS na profiles
alter table public.profiles enable row level security;

-- Vidíš len vlastný záznam
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (auth_uid = auth.uid());

-- Vytvoriť si môžeš len vlastný mapovací záznam
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check (auth_uid = auth.uid());

-- Aktualizáciu a mazanie bežne neudeľujeme (necháva sa len na service role).
-- Ak chceš aj update/delete pre seba, odkomentuj:

-- drop policy if exists profiles_update_own on public.profiles;
-- create policy profiles_update_own
-- on public.profiles
-- for update
-- using (auth_uid = auth.uid())
-- with check (auth_uid = auth.uid());

-- drop policy if exists profiles_delete_own on public.profiles;
-- create policy profiles_delete_own
-- on public.profiles
-- for delete
-- using (auth_uid = auth.uid());
