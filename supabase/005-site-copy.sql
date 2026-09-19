-- SJ-ARC: editable public homepage text. Apply after 001-site-foundation.sql.
-- Idempotent: existing text, photos and administrator roles are preserved.
begin;
create table if not exists public.site_copy (
  id smallint primary key default 1 check (id=1),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content)='object'),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.site_copy enable row level security;
revoke all on public.site_copy from public,anon,authenticated;
grant select on public.site_copy to anon,authenticated;
drop policy if exists sjarc_copy_read on public.site_copy;
create policy sjarc_copy_read on public.site_copy for select to anon,authenticated using(id=1);
insert into public.site_copy(id) values(1) on conflict(id) do nothing;

create or replace function public.publish_site_copy(p_content jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  rules constant jsonb := '{"hero.eyebrow":{"max":100,"type":"text"},"hero.title":{"max":100,"type":"text"},"hero.description":{"max":500,"type":"text"},"hero.joinLabel":{"max":40,"type":"text"},"hero.galleryLabel":{"max":40,"type":"text"},"intro.build.title":{"max":80,"type":"text"},"intro.build.description":{"max":500,"type":"text"},"intro.study.title":{"max":80,"type":"text"},"intro.study.description":{"max":500,"type":"text"},"intro.meet.title":{"max":80,"type":"text"},"intro.meet.description":{"max":500,"type":"text"},"activities.eyebrow":{"max":60,"type":"text"},"activities.title":{"max":100,"type":"text"},"activities.build.title":{"max":80,"type":"text"},"activities.build.description":{"max":500,"type":"text"},"activities.fly.title":{"max":80,"type":"text"},"activities.fly.description":{"max":500,"type":"text"},"activities.study.title":{"max":80,"type":"text"},"activities.study.description":{"max":500,"type":"text"},"activities.challenge.title":{"max":80,"type":"text"},"activities.challenge.description":{"max":500,"type":"text"},"tracks.title":{"max":100,"type":"text"},"tracks.description":{"max":500,"type":"text"},"tracks.op1.title":{"max":80,"type":"text"},"tracks.op1.description":{"max":500,"type":"text"},"tracks.op2.title":{"max":80,"type":"text"},"tracks.op2.description":{"max":500,"type":"text"},"tracks.op3.title":{"max":80,"type":"text"},"tracks.op3.description":{"max":500,"type":"text"},"tracks.dev1.title":{"max":80,"type":"text"},"tracks.dev1.description":{"max":500,"type":"text"},"tracks.dev2.title":{"max":80,"type":"text"},"tracks.dev2.description":{"max":500,"type":"text"},"tracks.dev3.title":{"max":80,"type":"text"},"tracks.dev3.description":{"max":500,"type":"text"},"tracks.dev4.title":{"max":80,"type":"text"},"tracks.dev4.description":{"max":500,"type":"text"},"projects.title":{"max":100,"type":"text"},"projects.vision.title":{"max":80,"type":"text"},"projects.vision.description":{"max":500,"type":"text"},"projects.path.title":{"max":80,"type":"text"},"projects.path.description":{"max":500,"type":"text"},"join.title":{"max":100,"type":"text"},"join.description":{"max":500,"type":"text"},"join.meeting":{"max":500,"type":"text"},"join.fee":{"max":100,"type":"text"},"join.feeNote":{"max":300,"type":"text"},"join.button":{"max":40,"type":"text"},"footer.description":{"max":300,"type":"text"},"links.join":{"max":1500,"type":"url"},"links.discord":{"max":1500,"type":"url"},"links.github":{"max":1500,"type":"url"},"links.notion":{"max":1500,"type":"url"}}'::jsonb;
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
    if rules->item.key->>'type'='url' and value !~ '^https://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$' then
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
notify pgrst,'reload schema';
commit;
