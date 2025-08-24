-- Helper procedúra pre DRY vytváranie politík
do $$
declare
  t text;
begin
  foreach t in array array[
    'activities_summary',
    'activities_splits',
    'activities_laps',
    'activity_details',
    'activities_raw'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);

    -- SELECT
    execute format($f$
      drop policy if exists %I_sel on public.%I;
      create policy %I_sel on public.%I
      for select using (public.owns_user_id(user_id));
    $f$, t, t, t, t);

    -- INSERT
    execute format($f$
      drop policy if exists %I_ins on public.%I;
      create policy %I_ins on public.%I
      for insert with check (public.owns_user_id(user_id));
    $f$, t, t, t, t);

    -- UPDATE
    execute format($f$
      drop policy if exists %I_upd on public.%I;
      create policy %I_upd on public.%I
      for update using (public.owns_user_id(user_id))
               with check (public.owns_user_id(user_id));
    $f$, t, t, t, t);

    -- DELETE
    execute format($f$
      drop policy if exists %I_del on public.%I;
      create policy %I_del on public.%I
      for delete using (public.owns_user_id(user_id));
    $f$, t, t, t, t);
  end loop;
end$$;
