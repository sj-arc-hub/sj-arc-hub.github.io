-- Google로 홈페이지에 한 번 로그인한 뒤 실행합니다.
-- YOUR_GOOGLE_EMAIL을 첫 운영진 이메일로 바꿉니다. 비밀번호/비밀키는 필요하지 않습니다.
do $$
declare matched_user uuid;
begin
  select u.id into strict matched_user from auth.users u
  where lower(u.email) = lower('YOUR_GOOGLE_EMAIL')
    and u.email_confirmed_at is not null
    and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google');
  update public.profiles set role = 'admin' where id = matched_user;
  if not found then raise exception 'Run 001-site-foundation.sql first'; end if;
exception
  when no_data_found then raise exception 'Sign in with the specified Google account first';
  when too_many_rows then raise exception 'More than one account matched; check Auth users';
end;
$$;
