-- 001과 003이 실행된 프로젝트에서 전체 실행합니다. 기존 사진은 유지됩니다.
begin;
alter table public.album_photos add column if not exists media_kind text not null default 'image';
alter table public.album_photos add column if not exists youtube_id text;
alter table public.album_photos add column if not exists poster_path text;
alter table public.album_photos alter column path drop not null;
alter table public.album_photos drop constraint if exists cm_gallery_media_shape;
alter table public.album_photos add constraint cm_gallery_media_shape check (
  (media_kind='image' and path is not null and path ~ '^(team|gallery)/[0-9a-f-]{36}\.(webp|jpg|png)$' and youtube_id is null and poster_path is null)
  or (media_kind='video' and path is not null and path ~ '^video/[0-9a-f-]{36}\.(mp4|webm)$' and youtube_id is null
      and (poster_path is null or poster_path ~ '^gallery/[0-9a-f-]{36}\.(webp|jpg|png)$'))
  or (media_kind='youtube' and path is null and poster_path is null and youtube_id is not null and youtube_id ~ '^[A-Za-z0-9_-]{11}$')
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sjarc-videos','sjarc-videos',true,52428800,array['video/mp4','video/webm'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists cm_video_insert on storage.objects;
create policy cm_video_insert on storage.objects for insert to authenticated with check
  (bucket_id='sjarc-videos' and (select private.is_admin()) and name ~ '^video/[0-9a-f-]{36}\.(mp4|webm)$');
drop policy if exists cm_video_read on storage.objects;
create policy cm_video_read on storage.objects for select to authenticated using
  (bucket_id='sjarc-videos' and (select private.is_admin()));

create or replace function private.cm_media_check() returns trigger
language plpgsql security definer set search_path='' as $$
declare media_path text; media_bucket text:='sjarc-media';
begin
  if tg_table_name='team_people' then
    media_path:=new.photo_path;
    if media_path is not null and media_path !~ '^(team|gallery)/[0-9a-f-]{36}\.(webp|jpg|png)$' then
      raise exception 'Invalid team photo path' using errcode='22023';
    end if;
  else
    media_path:=new.path;
    if new.media_kind='video' then media_bucket:='sjarc-videos'; end if;
    if new.poster_path is not null and not exists(select 1 from storage.objects where bucket_id='sjarc-media' and name=new.poster_path) then
      raise exception 'Uploaded poster not found' using errcode='22023';
    end if;
  end if;
  if media_path is not null and not exists(select 1 from storage.objects where bucket_id=media_bucket and name=media_path) then
    raise exception 'Uploaded media not found' using errcode='22023';
  end if;
  return new;
end $$;
revoke all on function private.cm_media_check() from public,anon,authenticated;
-- Existing album row policies and revision trigger apply equally to images and videos.
notify pgrst,'reload schema';
commit;
