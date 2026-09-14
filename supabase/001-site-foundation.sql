-- SJ-ARC 1단계: 로그인 프로필, 대표 사진, 운영진 권한.
-- 새 프로젝트의 SQL Editor에서 전체 실행합니다. 기존 데이터는 삭제하지 않습니다.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'pending' check (role in ('pending', 'member', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

drop policy if exists sjarc_profiles_read on public.profiles;
create policy sjarc_profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));

create or replace function private.create_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_profile() from public, anon, authenticated;
drop trigger if exists sjarc_create_profile on auth.users;
create trigger sjarc_create_profile after insert on auth.users
for each row execute function private.create_profile();
insert into public.profiles (id, display_name)
select id, left(coalesce(raw_user_meta_data->>'full_name', ''), 120) from auth.users
on conflict (id) do nothing;

create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  hero_path text,
  hero_alt text not null default 'SJ-ARC 활동 사진' check (char_length(hero_alt) <= 180),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
drop policy if exists sjarc_settings_read on public.site_settings;
create policy sjarc_settings_read on public.site_settings for select to anon, authenticated
using (id = 1);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- 홈페이지 대표 사진 전용 공개 버킷. 승급자료 같은 내부 문서는 여기에 넣지 않습니다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sjarc-public', 'sjarc-public', true, 5242880, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/webp','image/jpeg','image/png'];

drop policy if exists sjarc_hero_upload on storage.objects;
create policy sjarc_hero_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'sjarc-public' and (select private.is_admin())
  and name ~ '^hero/[0-9a-f-]{36}\.(webp|jpg|png)$'
);
drop policy if exists sjarc_hero_admin_read on storage.objects;
create policy sjarc_hero_admin_read on storage.objects for select to authenticated
using (bucket_id = 'sjarc-public' and (select private.is_admin()));

-- 업로드가 확인된 이미지만 연결하고, revision으로 동시 편집 충돌을 검사합니다.
create or replace function public.publish_hero(
  p_path text, p_alt text, p_expected_revision bigint
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare result public.site_settings;
begin
  if not private.is_admin() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if p_alt is null or char_length(trim(p_alt)) = 0 or char_length(p_alt) > 180 then
    raise exception 'Photo description is required (max 180 characters)' using errcode = '22023';
  end if;
  if p_path is null or p_path !~ '^hero/[0-9a-f-]{36}\.(webp|jpg|png)$'
     or not exists (select 1 from storage.objects where bucket_id = 'sjarc-public' and name = p_path) then
    raise exception 'Uploaded photo not found' using errcode = '22023';
  end if;
  update public.site_settings set hero_path = p_path, hero_alt = trim(p_alt),
    revision = revision + 1, updated_at = now()
  where id = 1 and revision = p_expected_revision
  returning * into result;
  if not found then
    raise exception 'The photo was changed by another administrator. Refresh and retry.' using errcode = '40001';
  end if;
  return to_jsonb(result);
end;
$$;
revoke all on function public.publish_hero(text,text,bigint) from public, anon, authenticated;
grant execute on function public.publish_hero(text,text,bigint) to authenticated;
grant usage on schema public to anon, authenticated;
notify pgrst, 'reload schema';
commit;
