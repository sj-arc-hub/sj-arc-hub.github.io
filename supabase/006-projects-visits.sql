-- Run once after 001, 003, 004 and 005. Safe to run again.
begin;
alter table public.team_people drop constraint if exists team_people_kind_check;
alter table public.team_people add constraint team_people_kind_check check(kind in ('advisor','mentor','staff'));
create table if not exists public.club_projects (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(btrim(title)) between 1 and 120),
 description text not null default '' check(char_length(description)<=3000),
 technologies text not null default '' check(char_length(technologies)<=200),
 source_url text not null default '' check(source_url='' or source_url ~ '^https://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$'),
 media_kind text not null check(media_kind in ('youtube','video')),
 youtube_id text, path text, poster_path text,
 published boolean not null default false,
 sort_order integer not null default 0,
 revision bigint not null default 0, updated_at timestamptz not null default now(),
 constraint project_media_shape check (
  (media_kind='youtube' and youtube_id is not null and youtube_id ~ '^[A-Za-z0-9_-]{11}$' and path is null and poster_path is null)
  or (media_kind='video' and youtube_id is null and path is not null and path ~ '^video/[0-9a-f-]{36}\.(mp4|webm)$'
   and (poster_path is null or poster_path ~ '^gallery/[0-9a-f-]{36}\.(webp|jpg|png)$')))
);
alter table public.club_projects enable row level security;
revoke all on public.club_projects from public,anon,authenticated;
grant select on public.club_projects to anon,authenticated;
grant insert,update on public.club_projects to authenticated;
drop policy if exists project_read on public.club_projects;
create policy project_read on public.club_projects for select to anon,authenticated using(published or (select private.is_admin()));
drop policy if exists project_insert on public.club_projects;
create policy project_insert on public.club_projects for insert to authenticated with check((select private.is_admin()));
drop policy if exists project_update on public.club_projects;
create policy project_update on public.club_projects for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create or replace function private.project_media_check() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.media_kind='video' and not exists(select 1 from storage.objects where bucket_id='sjarc-videos' and name=new.path) then
  raise exception 'Uploaded video not found' using errcode='22023';
 end if;
 if new.poster_path is not null and not exists(select 1 from storage.objects where bucket_id='sjarc-media' and name=new.poster_path) then
  raise exception 'Uploaded poster not found' using errcode='22023';
 end if;
 return new;
end $$;
revoke all on function private.project_media_check() from public,anon,authenticated;
drop trigger if exists project_media_check on public.club_projects;
create trigger project_media_check before insert or update on public.club_projects for each row execute function private.project_media_check();
drop trigger if exists cm_touch on public.club_projects;
create trigger cm_touch before update on public.club_projects for each row execute function private.cm_touch();

-- Only aggregate counts are exposed. No IP, email, account or fingerprint is stored.
create table if not exists private.site_visit_totals (
 id smallint primary key check(id=1), total bigint not null default 0,
 started_on date not null default (now() at time zone 'Asia/Seoul')::date
);
insert into private.site_visit_totals(id) values(1) on conflict do nothing;
create table if not exists private.site_visit_days(day date primary key,total bigint not null default 0);
create table if not exists private.site_visit_keys(day date not null,visitor uuid not null,primary key(day,visitor));
alter table private.site_visit_totals enable row level security;
alter table private.site_visit_days enable row level security;
alter table private.site_visit_keys enable row level security;
revoke all on private.site_visit_totals,private.site_visit_days,private.site_visit_keys from public,anon,authenticated;
create or replace function public.site_visit_stats() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('day',(now() at time zone 'Asia/Seoul')::date,'today',coalesce(d.total,0),'total',t.total,'started_on',t.started_on)
 from private.site_visit_totals t left join private.site_visit_days d on d.day=(now() at time zone 'Asia/Seoul')::date where t.id=1;
$$;
create or replace function public.record_site_visit(p_visitor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare visit_day date:=(now() at time zone 'Asia/Seoul')::date; inserted integer;
begin
 if p_visitor is null then raise exception 'Visitor key required' using errcode='22023'; end if;
 insert into private.site_visit_keys(day,visitor) values(visit_day,p_visitor) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then
  insert into private.site_visit_days(day,total) values(visit_day,1) on conflict(day) do update set total=private.site_visit_days.total+1;
  update private.site_visit_totals set total=total+1 where id=1;
 end if;
 -- Daily anonymous tokens expire; lifetime aggregates remain intact.
 delete from private.site_visit_keys where day<visit_day-2;
 return public.site_visit_stats();
end $$;
revoke all on function public.site_visit_stats() from public,anon,authenticated;
revoke all on function public.record_site_visit(uuid) from public,anon,authenticated;
grant execute on function public.site_visit_stats(),public.record_site_visit(uuid) to anon,authenticated;
create or replace function public.publish_site_copy(p_content jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  rules constant jsonb := '{"hero.eyebrow":{"max":100,"type":"text"},"hero.title":{"max":100,"type":"text"},"hero.description":{"max":500,"type":"text"},"hero.joinLabel":{"max":40,"type":"text"},"hero.galleryLabel":{"max":40,"type":"text"},"intro.build.title":{"max":80,"type":"text"},"intro.build.description":{"max":500,"type":"text"},"intro.study.title":{"max":80,"type":"text"},"intro.study.description":{"max":500,"type":"text"},"intro.meet.title":{"max":80,"type":"text"},"intro.meet.description":{"max":500,"type":"text"},"activities.eyebrow":{"max":60,"type":"text"},"activities.title":{"max":100,"type":"text"},"activities.build.title":{"max":80,"type":"text"},"activities.build.description":{"max":500,"type":"text"},"activities.fly.title":{"max":80,"type":"text"},"activities.fly.description":{"max":500,"type":"text"},"activities.study.title":{"max":80,"type":"text"},"activities.study.description":{"max":500,"type":"text"},"activities.challenge.title":{"max":80,"type":"text"},"activities.challenge.description":{"max":500,"type":"text"},"tracks.title":{"max":100,"type":"text"},"tracks.description":{"max":500,"type":"text"},"tracks.op1.title":{"max":80,"type":"text"},"tracks.op1.description":{"max":500,"type":"text"},"tracks.op2.title":{"max":80,"type":"text"},"tracks.op2.description":{"max":500,"type":"text"},"tracks.op3.title":{"max":80,"type":"text"},"tracks.op3.description":{"max":500,"type":"text"},"tracks.dev1.title":{"max":80,"type":"text"},"tracks.dev1.description":{"max":500,"type":"text"},"tracks.dev2.title":{"max":80,"type":"text"},"tracks.dev2.description":{"max":500,"type":"text"},"tracks.dev3.title":{"max":80,"type":"text"},"tracks.dev3.description":{"max":500,"type":"text"},"tracks.dev4.title":{"max":80,"type":"text"},"tracks.dev4.description":{"max":500,"type":"text"},"projects.title":{"max":100,"type":"text"},"projects.vision.title":{"max":80,"type":"text"},"projects.vision.description":{"max":500,"type":"text"},"projects.path.title":{"max":80,"type":"text"},"projects.path.description":{"max":500,"type":"text"},"join.title":{"max":100,"type":"text"},"join.description":{"max":500,"type":"text"},"join.meeting":{"max":500,"type":"text"},"join.fee":{"max":100,"type":"text"},"join.feeNote":{"max":300,"type":"text"},"join.button":{"max":40,"type":"text"},"footer.description":{"max":300,"type":"text"},"links.join":{"max":1500,"type":"contact"},"links.discord":{"max":1500,"type":"url"},"links.github":{"max":1500,"type":"url"},"links.notion":{"max":1500,"type":"url"},"faq.learn.question":{"max":120,"type":"text"},"faq.learn.answer":{"max":800,"type":"text"},"faq.who.question":{"max":120,"type":"text"},"faq.who.answer":{"max":800,"type":"text"},"faq.fee.question":{"max":120,"type":"text"},"faq.fee.answer":{"max":800,"type":"text"},"faq.join.question":{"max":120,"type":"text"},"faq.join.answer":{"max":800,"type":"text"},"faq.meeting.question":{"max":120,"type":"text"},"faq.meeting.answer":{"max":800,"type":"text"}}'::jsonb;
  item record; value text; result public.site_copy;
begin
  if not private.is_admin() then raise exception 'Administrator role required' using errcode='42501'; end if;
  if p_content is null or jsonb_typeof(p_content)<>'object' or octet_length(p_content::text)>60000 then
    raise exception 'Invalid content object' using errcode='22023';
  end if;
  for item in select * from jsonb_each(p_content) loop
    if not rules ? item.key or jsonb_typeof(item.value)<>'string' then
      raise exception 'Unknown field or invalid value' using errcode='22023';
    end if;
    value := p_content->>item.key;
    if char_length(btrim(value))=0 or char_length(value)>(rules->item.key->>'max')::integer
      or value ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' then
      raise exception 'Invalid text length or characters' using errcode='22023';
    end if;
    if rules->item.key->>'type' in ('url','contact') and not (rules->item.key->>'type'='contact' and value ~ '^mailto:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$') and value !~ '^https://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$' then
      raise exception 'Only valid HTTPS links are allowed' using errcode='22023';
    end if;
  end loop;
  update public.site_copy set content=p_content,revision=revision+1,updated_at=clock_timestamp()
    where id=1 and revision=p_expected_revision returning * into result;
  if not found then raise exception 'Content changed by another administrator' using errcode='40001'; end if;
  return to_jsonb(result);
end;
$$;
revoke all on function public.publish_site_copy(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.publish_site_copy(jsonb,bigint) to authenticated;

create table if not exists private.site_migrations(name text primary key,applied_at timestamptz default now());
alter table private.site_migrations enable row level security;
revoke all on private.site_migrations from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from private.site_migrations where name='006-projects-visits') then
  update public.site_copy set content=content || '{"intro.meet.title":"월 1회 정기모임","intro.meet.description":"매달 한 번 함께 모입니다. 자세한 일정과 장소는 카카오톡방에서 안내합니다.","activities.title":"함께 모여, 한 걸음 더.","join.description":"세종사이버대학교 재학생이라면 함께할 수 있습니다.\n가입은 이메일로 문의해 주세요.","join.meeting":"월 1회 정기모임\n날짜·시간·장소는 카카오톡방 공지","join.fee":"학기당 100,000원","join.feeNote":"가입 및 회비 안내는 이메일로 문의해 주세요.","hero.joinLabel":"가입 문의하기","join.button":"이메일로 가입 문의","links.join":"mailto:chungh@sjcu.ac.kr","faq.learn.question":"무엇을 할 수 있나요?","faq.learn.answer":"드론 제작·세팅부터 비행 제어 소프트웨어 활용과 기체 연동까지 함께 배웁니다. ROS2 기반 프로그래밍과 자율비행 프로젝트도 단계적으로 경험합니다.","faq.who.question":"누가 가입할 수 있나요?","faq.who.answer":"세종사이버대학교 재학생을 대상으로 합니다.","faq.fee.question":"회비는 얼마인가요?","faq.fee.answer":"회비는 학기당 100,000원입니다.","faq.join.question":"어떻게 가입하나요?","faq.join.answer":"chungh@sjcu.ac.kr로 가입을 문의해 주세요. 이메일로 가입 절차를 안내해 드립니다.","faq.meeting.question":"모임은 언제 하나요?","faq.meeting.answer":"매달 1회 정기모임을 진행합니다. 구체적인 날짜·시간·장소는 카카오톡방에서 공지합니다."}'::jsonb,revision=revision+1,updated_at=now() where id=1;
  update public.team_people set kind='mentor' where name='이충현' and kind='advisor' and title='초빙교수';
  insert into private.site_migrations(name) values('006-projects-visits');
 end if;
end $$;
notify pgrst,'reload schema';
commit;
