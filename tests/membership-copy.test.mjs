import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {defaultCopy} from '../site-copy.js';
test('007 opens membership copy to on-leave and graduated students, keeps other copy and reruns safely',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to anon,authenticated;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
   alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  for(const file of ['001-site-foundation.sql','003-community.sql','004-gallery-video.sql','005-site-copy.sql','006-projects-visits.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  await db.exec(`update public.site_copy set content=content || '{"faq.who.answer":"세종사이버대학교 재학생을 대상으로 합니다.","intro.meet.title":"운영진이 바꾼 제목"}'::jsonb where id=1`);
  const before=(await db.query('select revision from public.site_copy where id=1')).rows[0].revision;
  const migration=await readFile(new URL('../supabase/007-membership-copy.sql',import.meta.url),'utf8');
  await db.exec(migration);await db.exec(migration);
  const row=(await db.query('select content,revision from public.site_copy where id=1')).rows[0];
  assert.equal(row.content['faq.who.answer'],defaultCopy['faq.who.answer']);
  assert.equal(row.content['join.description'],defaultCopy['join.description']);
  assert.match(row.content['faq.who.answer'],/재학생·휴학생·졸업생/);
  assert.equal(row.content['intro.meet.title'],'운영진이 바꾼 제목');
  assert.equal(Number(row.revision),Number(before)+1);
 }finally{await db.close();}
});
