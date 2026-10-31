-- Run once after 005 and 006. Safe to run again.
-- Updates the published home copy: membership is open to current, on-leave and graduated students.
begin;
do $$ begin
 if not exists(select 1 from private.site_migrations where name='007-membership-copy') then
  update public.site_copy set content=content || '{"join.description":"세종사이버대학교 재학생·휴학생·졸업생이라면 함께할 수 있습니다.\n가입은 이메일로 문의해 주세요.","faq.who.answer":"세종사이버대학교 재학생·휴학생·졸업생 모두 가입할 수 있습니다."}'::jsonb, revision=revision+1, updated_at=now() where id=1;
  insert into private.site_migrations(name) values('007-membership-copy');
 end if;
end $$;
commit;
