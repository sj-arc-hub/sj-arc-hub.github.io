import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {youtubeId,youtubeEmbed,videoInfo,MAX_VIDEO_BYTES} from '../gallery-media.js';
test('YouTube links normalize to a safe video ID and reject embedded URLs or lookalike hosts',()=>{
 const id='M7lc1UVf-VE';
 for(const url of [`https://youtu.be/${id}?si=test`,`https://www.youtube.com/watch?v=${id}&t=30`,`https://m.youtube.com/shorts/${id}`,`https://youtube.com/live/${id}`,`https://youtube.com/embed/${id}`])assert.equal(youtubeId(url),id);
 for(const url of [`https://youtube.com.evil.test/watch?v=${id}`,`https://evil.test@youtube.com/watch?v=${id}`,`javascript:alert(1)`,`https://youtube.com/watch?v=invalid`,`https://youtu.be/${id}/extra`,`https://www.youtube.com/playlist?list=anything`])assert.equal(youtubeId(url),null);
 assert.match(youtubeEmbed(id),/^https:\/\/www.youtube-nocookie.com\/embed\//);
 assert.equal(youtubeEmbed('x" onload="bad'), '');
});
test('video validation enforces formats and the 50MB ceiling',()=>{
 assert.deepEqual(videoInfo({name:'FLIGHT.MP4',type:'video/mp4',size:MAX_VIDEO_BYTES}),{ext:'mp4',mime:'video/mp4'});
 assert.deepEqual(videoInfo({name:'flight.webm',type:'',size:10}),{ext:'webm',mime:'video/webm'});
 assert.throws(()=>videoInfo({name:'movie.mp4',type:'video/mp4',size:MAX_VIDEO_BYTES+1}),/50MB/);
 assert.throws(()=>videoInfo({name:'movie.mov',type:'video/quicktime',size:10}),/MP4/);
 assert.throws(()=>videoInfo({name:'fake.mp4',type:'text/html',size:10}),/MP4/);
 assert.throws(()=>videoInfo({name:'empty.mp4',type:'video/mp4',size:0}),/50MB/);
});
test('gallery migration preserves photos, restricts video uploads and applies album visibility',async()=>{
 const db=new PGlite(),admin='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to anon,authenticated;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
   alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  for(const file of ['001-site-foundation.sql','003-community.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${admin}','admin@example.test',now(),'{}'),('${other}','member@example.test',now(),'{}');update public.profiles set role='admin' where id='${admin}';`);
  const image='gallery/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',video='video/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.mp4';
  await db.query("insert into storage.objects(bucket_id,name) values('sjarc-media',$1)",[image]);
  const album=(await db.query("insert into public.albums(title) values('비행 실습') returning id")).rows[0].id;
  await db.query("insert into public.album_photos(album_id,path,caption) values($1,$2,'기존 사진')",[album,image]);
  const sql=await readFile(new URL('../supabase/004-gallery-video.sql',import.meta.url),'utf8');await db.exec(sql);
  assert.equal((await db.query('select media_kind from public.album_photos')).rows[0].media_kind,'image');
  const bucket=(await db.query("select * from storage.buckets where id='sjarc-videos'")).rows[0];assert.equal(Number(bucket.file_size_limit),MAX_VIDEO_BYTES);assert.deepEqual(bucket.allowed_mime_types,['video/mp4','video/webm']);
  async function as(role,id,fn){await db.exec(`set role ${role};select set_config('request.jwt.claim.sub','${id||''}',false);`);try{return await fn();}finally{await db.exec('reset role');}}
  const upload=()=>db.query("insert into storage.objects(bucket_id,name) values('sjarc-videos',$1)",[video]);
  await as('anon',null,()=>assert.rejects(upload(),/row-level security/));
  await as('authenticated',other,()=>assert.rejects(upload(),/row-level security/));
  await as('authenticated',admin,async()=>{
   await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('sjarc-videos','video/file.html')"),/row-level security/);
   await upload();
   await db.query("insert into public.album_photos(album_id,media_kind,path,poster_path,caption) values($1,'video',$2,$3,'비행 영상')",[album,video,image]);
   await db.query("insert into public.album_photos(album_id,media_kind,path,youtube_id,caption) values($1,'youtube',null,'M7lc1UVf-VE','발표 영상')",[album]);
   await assert.rejects(db.query("insert into public.album_photos(album_id,media_kind,path,youtube_id,caption) values($1,'youtube',null,'bad-id','잘못된 영상')",[album]),/check constraint/);
   await assert.rejects(db.query("insert into public.album_photos(album_id,media_kind,path,caption) values($1,'video','video/cccccccc-cccc-4ccc-8ccc-cccccccccccc.mp4','없는 영상')",[album]),/Uploaded media not found/);
   await assert.rejects(db.query("insert into public.team_people(name,photo_path) values('테스트',$1)",[video]),/Invalid team photo/);
  });
  await as('authenticated',other,()=>assert.rejects(db.query("insert into public.album_photos(album_id,media_kind,path,youtube_id,caption) values($1,'youtube',null,'M7lc1UVf-VE','무단 영상')",[album]),/row-level security/));
  await as('anon',null,async()=>assert.equal((await db.query('select * from public.album_photos')).rows.length,3));
  await as('authenticated',admin,async()=>{await db.query('update public.albums set published=false where id=$1',[album]);assert.equal((await db.query("update storage.objects set name='replacement.mp4' where name=$1 returning *",[video])).rows.length,0);});
  await as('anon',null,async()=>assert.equal((await db.query('select * from public.album_photos')).rows.length,0));
  await db.exec(sql);assert.equal((await db.query('select * from public.album_photos')).rows.length,3);
 }finally{await db.close();}
});
