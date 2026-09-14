-- SJ-ARC 2단계. 001 실행 후 SQL Editor에서 전체 실행합니다.
-- 공개: 운영진 소개, 회원 레벨 요약, 공개 앨범, 게시한 글·승급자료·첨부파일.
-- 비공개: 작성 중인 글, 로그인 이메일, 심사 의견, 레벨 변경 감사 기록.
begin;

create or replace function private.cm_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('member','admin'));
$$;

create table if not exists public.team_people (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(trim(name)) between 1 and 80),
  kind text not null default 'staff' check (kind in ('advisor','staff')), title text not null default '' check (char_length(title)<=80),
  department text not null default '' check (char_length(department)<=160), bio text not null default '' check (char_length(bio)<=2000),
  contact_email text not null default '' check (char_length(contact_email)<=254),
  website text not null default '' check (website='' or website ~ '^https?://'),
  github text not null default '' check (github='' or github ~ '^https?://'), photo_path text,
  sort_order integer not null default 0, active boolean not null default true,
  revision bigint not null default 0, updated_at timestamptz not null default now()
);
create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  track text not null check (track in ('운영','개발')), level integer not null default 1,
  score integer not null default 0 check (score between 0 and 1000000), promoted_on date,
  note text not null default '' check (char_length(note)<=2000), active boolean not null default true,
  change_reason text not null default '최초 등록' check (char_length(trim(change_reason)) between 2 and 500),
  revision bigint not null default 0, updated_at timestamptz not null default now(),
  check (level between 1 and case when track='운영' then 3 else 4 end)
);
create table if not exists public.member_events (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.club_members(id),
  actor_id uuid references auth.users(id) on delete set null, reason text not null,
  before_value jsonb, after_value jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.account_events (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null references auth.users(id),
  user_id uuid not null references auth.users(id), before_role text not null, after_role text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(), title text not null check (char_length(trim(title)) between 1 and 150),
  event_date date not null default current_date, category text not null default '정기모임',
  description text not null default '' check (char_length(description)<=3000),
  published boolean not null default true, revision bigint not null default 0, updated_at timestamptz not null default now(),
  check (category in ('정기모임','기체 제작','비행 실습','대회','세미나','기타'))
);
create table if not exists public.album_photos (
  id uuid primary key default gen_random_uuid(), album_id uuid not null references public.albums(id),
  path text not null unique, caption text not null check (char_length(trim(caption)) between 1 and 180),
  sort_order integer not null default 0, active boolean not null default true,
  revision bigint not null default 0, updated_at timestamptz not null default now()
);
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id),
  author_name text not null, category text not null check (category in ('공지','질문 / 답변','자료','대회 소식','승급자료')),
  title text not null check (char_length(trim(title)) between 1 and 150),
  body text not null default '' check (char_length(body)<=30000),
  link text not null default '' check (link='' or (char_length(link)<=2048 and link ~ '^https?://')),
  state text not null default 'draft' check (state in ('draft','published','archived')),
  pinned boolean not null default false, revision bigint not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.post_files (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.community_posts(id),
  path text not null unique, filename text not null check (char_length(filename) between 1 and 150),
  size_bytes bigint not null check (size_bytes between 1 and 26214400), created_at timestamptz not null default now()
);
create table if not exists public.promotion_requests (
  id uuid primary key default gen_random_uuid(), post_id uuid not null unique references public.community_posts(id),
  member_id uuid not null references public.club_members(id), track text not null,
  from_level integer not null, target_level integer not null,
  evidence_kind text not null check (evidence_kind in ('세미나 발표','자료 문서화','영상 발표')),
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  attempt integer not null default 0, submitted_at timestamptz, reviewed_at timestamptz,
  check (target_level=from_level+1 and target_level<=case when track='운영' then 3 else 4 end)
);
create unique index if not exists cm_one_pending_promotion on public.promotion_requests(member_id) where status='submitted';
create table if not exists public.promotion_reviews (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.promotion_requests(id),
  reviewer_id uuid not null references auth.users(id), decision text not null check (decision in ('approved','rejected')),
  comment text not null check (char_length(trim(comment)) between 2 and 2000), attempt integer not null,
  snapshot jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create or replace function private.cm_member() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and
    (p.role='admin' or (p.role='member' and exists(select 1 from public.club_members m where m.user_id=p.id and m.active))));
$$;
create index if not exists cm_posts_list on public.community_posts(state,created_at desc);
create index if not exists cm_files_post on public.post_files(post_id);
create index if not exists cm_photos_album on public.album_photos(album_id,sort_order);

create or replace function private.cm_touch() returns trigger language plpgsql set search_path='' as $$
begin new.revision := old.revision+1; new.updated_at := now(); return new; end;
$$;
create or replace function private.cm_member_audit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.member_events(member_id,actor_id,reason,before_value,after_value)
  values(new.id,auth.uid(),new.change_reason,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
  return new;
end;
$$;
create or replace function private.cm_media_check() returns trigger language plpgsql security definer set search_path='' as $$
declare media_path text;
begin
  if tg_table_name='team_people' then media_path:=new.photo_path; else media_path:=new.path; end if;
  if media_path is not null and (media_path !~ '^(team|gallery)/[0-9a-f-]{36}\.(webp|jpg|png)$'
    or not exists(select 1 from storage.objects where bucket_id='sjarc-media' and name=media_path)) then
    raise exception 'Uploaded image not found' using errcode='22023';
  end if;
  return new;
end;
$$;
do $$ declare tab text; begin
  foreach tab in array array['team_people','club_members','albums','album_photos','community_posts'] loop
    execute format('drop trigger if exists cm_touch on public.%I',tab);
    execute format('create trigger cm_touch before update on public.%I for each row execute function private.cm_touch()',tab);
  end loop;
  foreach tab in array array['team_people','album_photos'] loop
    execute format('drop trigger if exists cm_media_check on public.%I',tab);
    execute format('create trigger cm_media_check before insert or update on public.%I for each row execute function private.cm_media_check()',tab);
  end loop;
  foreach tab in array array['team_people','club_members','member_events','account_events','albums','album_photos','community_posts','post_files','promotion_requests','promotion_reviews'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from public, anon, authenticated',tab);
    execute format('drop policy if exists cm_read on public.%I',tab);
    execute format('drop policy if exists cm_insert on public.%I',tab);
    execute format('drop policy if exists cm_update on public.%I',tab);
  end loop;
end $$;
drop trigger if exists cm_member_audit on public.club_members;
create trigger cm_member_audit after insert or update on public.club_members for each row execute function private.cm_member_audit();

create or replace function private.cm_read_post(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.community_posts where id=p_id and
    (state='published' or author_id=auth.uid() or private.is_admin()));
$$;
create or replace function private.cm_edit_post(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.cm_member() and exists(select 1 from public.community_posts p where p.id=p_id
    and p.state='draft' and (p.author_id=auth.uid() or private.is_admin())
    and (p.category<>'공지' or private.is_admin())
    and not exists(select 1 from public.promotion_requests r where r.post_id=p.id and r.status in ('submitted','approved')));
$$;
create or replace function private.cm_read_file(p_path text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.post_files f where f.path=p_path and private.cm_read_post(f.post_id))
    or exists(select 1 from public.promotion_reviews v join public.promotion_requests r on r.id=v.request_id
      join public.community_posts p on p.id=r.post_id,
      jsonb_array_elements(coalesce(v.snapshot->'files','[]'::jsonb)) saved_file
      where saved_file->>'path'=p_path and (private.is_admin() or p.author_id=auth.uid()));
$$;
grant select on public.team_people,public.albums,public.album_photos,public.community_posts,public.post_files to anon,authenticated;
grant select on public.club_members,public.member_events,public.promotion_requests,public.promotion_reviews to authenticated;
grant select on public.account_events to authenticated;
create policy cm_read on public.account_events for select to authenticated using((select private.is_admin()));
grant insert,update on public.team_people,public.club_members,public.albums,public.album_photos to authenticated;
create policy cm_read on public.team_people for select to anon,authenticated using(active or (select private.is_admin()));
create policy cm_read on public.albums for select to anon,authenticated using(published or (select private.is_admin()));
create policy cm_read on public.album_photos for select to anon,authenticated using
  ((active and exists(select 1 from public.albums where id=album_id and published)) or (select private.is_admin()));
create policy cm_read on public.club_members for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy cm_read on public.member_events for select to authenticated using((select private.is_admin()) or exists
  (select 1 from public.club_members m where m.id=member_id and m.user_id=(select auth.uid())));
create policy cm_read on public.community_posts for select to anon,authenticated using(private.cm_read_post(id));
create policy cm_read on public.post_files for select to anon,authenticated using(private.cm_read_post(post_id));
create policy cm_read on public.promotion_requests for select to authenticated using((select private.is_admin()) or exists
  (select 1 from public.club_members m where m.id=member_id and m.user_id=(select auth.uid())));
create policy cm_read on public.promotion_reviews for select to authenticated using((select private.is_admin()) or exists
  (select 1 from public.promotion_requests r join public.club_members m on m.id=r.member_id where r.id=request_id and m.user_id=(select auth.uid())));
do $$ declare tab text; begin
  foreach tab in array array['team_people','club_members','albums','album_photos'] loop
    execute format('create policy cm_insert on public.%I for insert to authenticated with check ((select private.is_admin()))',tab);
    execute format('create policy cm_update on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',tab);
  end loop;
end $$;
-- Deliberate public projections. Auth email, login UUID, notes and reviewer comments are excluded.
create or replace view public.member_directory with (security_barrier=true) as
  select id,name,track,level,score,promoted_on from public.club_members where active;
create or replace view public.promotion_summary with (security_barrier=true) as
  select r.post_id,r.track,r.from_level,r.target_level,r.evidence_kind,r.status,r.submitted_at,r.reviewed_at
  from public.promotion_requests r join public.community_posts p on p.id=r.post_id where p.state='published';
revoke all on public.member_directory,public.promotion_summary from public,anon,authenticated;
grant select on public.member_directory,public.promotion_summary to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('sjarc-media','sjarc-media',true,5242880,array['image/webp','image/jpeg','image/png']),
  ('sjarc-documents','sjarc-documents',false,26214400,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','application/zip','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists cm_media_insert on storage.objects;
create policy cm_media_insert on storage.objects for insert to authenticated with check
  (bucket_id='sjarc-media' and (select private.is_admin()) and name ~ '^(team|gallery)/[0-9a-f-]{36}\.(webp|jpg|png)$');
drop policy if exists cm_media_read on storage.objects;
create policy cm_media_read on storage.objects for select to authenticated using(bucket_id='sjarc-media' and (select private.is_admin()));
drop policy if exists cm_document_insert on storage.objects;
create policy cm_document_insert on storage.objects for insert to authenticated with check
  (bucket_id='sjarc-documents' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|docx|pptx|xlsx|txt|zip|jpg|png|webp)$'
   and split_part(name,'/',2)=(select auth.uid())::text
   and private.cm_edit_post(split_part(name,'/',1)::uuid));
drop policy if exists cm_document_read on storage.objects;
create policy cm_document_read on storage.objects for select to anon,authenticated using
  (bucket_id='sjarc-documents' and private.cm_read_file(name));

create or replace function public.cm_accounts() returns table(id uuid,email text,display_name text,role text)
language plpgsql security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Administrator role required' using errcode='42501'; end if;
  return query select u.id,u.email::text,p.display_name,p.role from auth.users u join public.profiles p on p.id=u.id order by p.created_at desc limit 1000;
end $$;
create or replace function public.cm_manage_account(p_user uuid,p_role text,p_member uuid,p_expected_role text) returns void
language plpgsql security definer set search_path='' as $$
declare role_before text;
begin
  if not private.is_admin() then raise exception 'Administrator role required' using errcode='42501'; end if;
  select role into role_before from public.profiles where id=p_user for update;
  if role_before is null or role_before<>p_expected_role then raise exception 'Account changed. Refresh.' using errcode='40001'; end if;
  if p_user=auth.uid() or p_role not in ('pending','member','admin') then raise exception 'Cannot change your own administrator role' using errcode='42501'; end if;
  if p_role='member' then
    update public.club_members set user_id=p_user,change_reason='Google 계정 연결 및 동아리원 승인'
      where id=p_member and active and (user_id is null or user_id=p_user);
    if not found then raise exception 'Select an active unlinked member record' using errcode='22023'; end if;
  end if;
  update public.profiles set role=p_role where id=p_user;
  insert into public.account_events(actor_id,user_id,before_role,after_role) values(auth.uid(),p_user,role_before,p_role);
end $$;

create or replace function public.cm_import_members(p_rows jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare row_data jsonb; added integer:=0;
begin
  if not private.is_admin() then raise exception 'Administrator role required' using errcode='42501'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 200 then raise exception 'Import 1 to 200 rows' using errcode='22023'; end if;
  -- Serializes bulk imports so two concurrent batches cannot silently duplicate names.
  lock table public.club_members in share row exclusive mode;
  for row_data in select value from jsonb_array_elements(p_rows) loop
    if exists(select 1 from public.club_members where name=trim(row_data->>'name') and track=row_data->>'track') then
      raise exception 'Duplicate member name and track' using errcode='23505';
    end if;
    insert into public.club_members(name,track,level,score,change_reason)
      values(trim(row_data->>'name'),row_data->>'track',(row_data->>'level')::integer,(row_data->>'score')::integer,'명단 일괄 등록');
    added:=added+1;
  end loop;
  return added;
end $$;

create or replace function public.cm_create_post(p_category text,p_title text,p_body text,p_link text,p_kind text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.community_posts; m public.club_members; display text;
begin
  if not private.cm_member() or (p_category='공지' and not private.is_admin()) then raise exception 'Member role required' using errcode='42501'; end if;
  select * into m from public.club_members where user_id=auth.uid() and active;
  select coalesce(nullif(m.name,''),nullif(display_name,''),'동아리원') into display from public.profiles where id=auth.uid();
  insert into public.community_posts(author_id,author_name,category,title,body,link)
    values(auth.uid(),display,p_category,p_title,p_body,p_link) returning * into result;
  if p_category='승급자료' then
    if m.id is null then raise exception 'Link an active member record first' using errcode='22023'; end if;
    insert into public.promotion_requests(post_id,member_id,track,from_level,target_level,evidence_kind)
      values(result.id,m.id,m.track,m.level,m.level+1,p_kind);
  end if;
  return to_jsonb(result);
end $$;
create or replace function public.cm_edit_draft(p_id uuid,p_revision bigint,p_title text,p_body text,p_link text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.community_posts;
begin
  if not private.cm_edit_post(p_id) then raise exception 'This post cannot be edited' using errcode='42501'; end if;
  update public.community_posts set title=p_title,body=p_body,link=p_link where id=p_id and revision=p_revision returning * into result;
  if not found then raise exception 'Post changed. Refresh.' using errcode='40001'; end if;
  return to_jsonb(result);
end $$;
create or replace function public.cm_attach_file(p_post uuid,p_revision bigint,p_path text,p_filename text,p_size bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.community_posts;
begin
  select * into result from public.community_posts where id=p_post for update;
  if not private.cm_edit_post(p_post) then raise exception 'Draft ownership required' using errcode='42501'; end if;
  if result.revision<>p_revision then raise exception 'Post changed. Refresh.' using errcode='40001'; end if;
  if p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|docx|pptx|xlsx|txt|zip|jpg|png|webp)$'
    or split_part(p_path,'/',1)<>p_post::text or split_part(p_path,'/',2)<>auth.uid()::text
    or not exists(select 1 from storage.objects where bucket_id='sjarc-documents' and name=p_path) then
    raise exception 'Uploaded document not found' using errcode='22023';
  end if;
  if (select count(*) from public.post_files where post_id=p_post)>=10 then raise exception 'Maximum 10 files per post' using errcode='22023'; end if;
  insert into public.post_files(post_id,path,filename,size_bytes) values(p_post,p_path,p_filename,p_size);
  update public.community_posts set updated_at=now() where id=p_post returning * into result;
  return to_jsonb(result);
end $$;
create or replace function public.cm_remove_file(p_post uuid,p_revision bigint,p_file uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.community_posts;
begin
  select * into result from public.community_posts where id=p_post for update;
  if not private.cm_edit_post(p_post) then raise exception 'Draft ownership required' using errcode='42501'; end if;
  if result.revision<>p_revision then raise exception 'Post changed. Refresh.' using errcode='40001'; end if;
  delete from public.post_files where id=p_file and post_id=p_post;
  if not found then raise exception 'File not found' using errcode='22023'; end if;
  update public.community_posts set updated_at=now() where id=p_post returning * into result;
  return to_jsonb(result);
end $$;
create or replace function public.cm_post_action(p_id uuid,p_revision bigint,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.community_posts; r public.promotion_requests; m public.club_members;
begin
  select * into p from public.community_posts where id=p_id for update;
  if not private.cm_member() or p.id is null or (p.author_id<>auth.uid() and not private.is_admin()) then raise exception 'Post ownership required' using errcode='42501'; end if;
  if p.category='공지' and not private.is_admin() then raise exception 'Administrator role required' using errcode='42501'; end if;
  if p.revision<>p_revision then raise exception 'Post changed. Refresh.' using errcode='40001'; end if;
  select * into r from public.promotion_requests where post_id=p_id for update;
  if p_action='publish' then
    if p.state<>'draft' then raise exception 'Save a draft first' using errcode='22023'; end if;
    if char_length(trim(p.body))<10 then raise exception 'Write at least 10 characters' using errcode='22023'; end if;
    if r.id is not null then
      select * into m from public.club_members where id=r.member_id for update;
      if not m.active or m.user_id<>p.author_id or m.track<>r.track or m.level<>r.from_level then raise exception 'Member level changed. Create a new request.' using errcode='40001'; end if;
      if p.link='' and not exists(select 1 from public.post_files where post_id=p_id) then raise exception 'Attach evidence or add its URL' using errcode='22023'; end if;
      update public.promotion_requests set status='submitted',attempt=attempt+1,submitted_at=now(),reviewed_at=null where id=r.id;
    end if;
    update public.community_posts set state='published' where id=p_id returning * into p;
  elsif p_action in ('unpublish','archive') then
    if r.status in ('submitted','approved') then raise exception 'Submitted evidence is locked' using errcode='42501'; end if;
    update public.community_posts set state=case when p_action='archive' then 'archived' else 'draft' end where id=p_id returning * into p;
  elsif p_action='pin' then
    if not private.is_admin() then raise exception 'Administrator role required' using errcode='42501'; end if;
    update public.community_posts set pinned=not pinned where id=p_id returning * into p;
  else raise exception 'Unknown action' using errcode='22023'; end if;
  return to_jsonb(p);
end $$;
create or replace function public.cm_review(p_request uuid,p_attempt integer,p_decision text,p_comment text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.promotion_requests; m public.club_members; p public.community_posts;
begin
  if not private.is_admin() then raise exception 'Administrator role required' using errcode='42501'; end if;
  -- Same lock order as submission prevents a review/submission deadlock.
  select cp.* into p from public.community_posts cp join public.promotion_requests pr on pr.post_id=cp.id where pr.id=p_request for update of cp;
  select * into r from public.promotion_requests where id=p_request for update;
  if r.id is null or r.status<>'submitted' or r.attempt<>p_attempt or p.state<>'published' then raise exception 'Review state changed. Refresh.' using errcode='40001'; end if;
  if p.author_id=auth.uid() then raise exception 'A different administrator must review your request' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') or char_length(trim(p_comment))<2 or char_length(p_comment)>2000 then raise exception 'Review comment required' using errcode='22023'; end if;
  if p_decision='approved' then
    select * into m from public.club_members where id=r.member_id for update;
    if not m.active or m.user_id<>p.author_id or m.track<>r.track or m.level<>r.from_level then raise exception 'Member level changed. Refresh.' using errcode='40001'; end if;
    update public.club_members set level=r.target_level,promoted_on=current_date,
      change_reason='승급자료 승인: '||p.title where id=m.id;
  end if;
  insert into public.promotion_reviews(request_id,reviewer_id,decision,comment,attempt,snapshot)
    values(r.id,auth.uid(),p_decision,trim(p_comment),r.attempt,jsonb_build_object('post',to_jsonb(p),'files',
      coalesce((select jsonb_agg(to_jsonb(f)) from public.post_files f where f.post_id=p.id),'[]'::jsonb)));
  update public.promotion_requests set status=p_decision,reviewed_at=now() where id=r.id;
  -- Rejected evidence stays public. The author can explicitly return it to a draft.
end $$;

-- Every RPC checks its caller; browser clients have no direct write grants on posts/reviews/roles.
do $$ declare fn record; begin
  for fn in select p.oid::regprocedure as signature,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname like 'cm\_%' escape '\' loop
    execute format('revoke all on function %s from public, anon, authenticated',fn.signature);
    if fn.nspname='public' then execute format('grant execute on function %s to authenticated',fn.signature); end if;
  end loop;
end $$;
-- Read helpers must be callable by policies, including anonymous public-file downloads.
grant usage on schema private to anon;
grant execute on function private.is_admin() to anon;
grant execute on function private.cm_read_post(uuid) to anon,authenticated;
grant execute on function private.cm_read_file(text) to anon,authenticated;
grant execute on function private.cm_edit_post(uuid),private.cm_member() to authenticated;
notify pgrst,'reload schema';
commit;
