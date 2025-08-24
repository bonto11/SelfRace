-- 1) PROFILES – väzobná tabuľka medzi auth UID (UUID zo Supabase Auth) a interným users.id (INT)
create table if not exists public.profiles (
  auth_uid uuid primary key,
  user_id  integer not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_profiles_user_id on public.profiles(user_id);
