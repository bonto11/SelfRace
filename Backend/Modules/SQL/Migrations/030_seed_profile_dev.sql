-- DOPLŇ SVOJE HODNOTY
-- napr. auth_uid: 'b3e1f7a8-....-....-....-............'
-- user_id: 13

insert into public.profiles (auth_uid, user_id)
values ('<TVOJ_AUTH_UID>', <TVOJ_USERS_ID>)
on conflict (auth_uid) do update
  set user_id = excluded.user_id;
