import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {dailyVisitor,canCountVisit} from '../site-visits.js';import {normalizeCopy,defaultCopy} from '../site-copy.js';
test('daily browser keys reuse a day, rotate the next day and skip counting when storage fails',()=>{
 const m=new Map(),store={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};let n=0;const next=()=>`11111111-1111-4111-8111-${String(++n).padStart(12,'0')}`;
 assert.equal(dailyVisitor(store,'2026-09-27',next),dailyVisitor(store,'2026-09-27',next));assert.equal(n,1);
 dailyVisitor(store,'2026-09-28',next);assert.equal(n,2);
 assert.equal(dailyVisitor({getItem(){throw Error();},setItem(){throw Error();}},'2026-09-27',next),null);
 assert.equal(canCountVisit({hostname:'localhost',search:''}),false);assert.equal(canCountVisit({hostname:'sj-arc.org',search:'?copy-preview=1'}),false);
 assert.equal(canCountVisit({hostname:'sj-arc.org',search:''}),true);
});
test('email contact is limited to simple mailto addresses and only contact fields',()=>{
 assert.equal(normalizeCopy({'links.join':'mailto:chungh@sjcu.ac.kr'},{strict:true})['links.join'],'mailto:chungh@sjcu.ac.kr');
 for(const input of [{'links.join':'mailto:a@example.com?bcc=other@example.com'},{'links.discord':'mailto:a@example.com'},{'links.join':'javascript:alert(1)'},{'links.join':'mailto:a@example.com\n'}])assert.throws(()=>normalizeCopy(input,{strict:true}));
});
test('projects permissions, live video checks, daily deduplication and idempotent setup',async t=>{
 const db=new PGlite(),admin='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to anon,authenticated;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
   alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  for(const file of ['001-site-foundation.sql','003-community.sql','004-gallery-video.sql','005-site-copy.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${admin}','admin@example.test',now(),'{}'),('${other}','member@example.test',now(),'{}');update public.profiles set role='admin' where id='${admin}';insert into public.team_people(name,kind,title) values('이충현','advisor','초빙교수');`);
  const migration=await readFile(new URL('../supabase/006-projects-visits.sql',import.meta.url),'utf8');await db.exec(migration);
  async function as(role,id,fn){await db.exec(`set role ${role};select set_config('request.jwt.claim.sub','${id||''}',false);`);try{return await fn();}finally{await db.exec('reset role');}}
  const insert=()=>db.query("insert into public.club_projects(title,media_kind,youtube_id) values('실험 결과','youtube','M7lc1UVf-VE') returning *");
  let project;
  await t.test('only administrators create and publish; hidden projects remain private',async()=>{
   await as('anon',null,()=>assert.rejects(insert()));await as('authenticated',other,()=>assert.rejects(insert()));
   await as('authenticated',admin,async()=>{project=(await insert()).rows[0];});
   await as('anon',null,async()=>assert.equal((await db.query('select * from public.club_projects')).rows.length,0));
   await as('authenticated',other,async()=>assert.equal((await db.query('update public.club_projects set published=true returning id')).rows.length,0));
   await as('authenticated',admin,async()=>{
    const changed=(await db.query('update public.club_projects set published=true where id=$1 and revision=0 returning revision',[project.id])).rows;assert.equal(changed[0].revision,1);
    assert.equal((await db.query('update public.club_projects set published=false where id=$1 and revision=0 returning id',[project.id])).rows.length,0);
    await assert.rejects(db.query("insert into public.club_projects(title,media_kind,path) values('missing','video','video/cccccccc-cccc-4ccc-8ccc-cccccccccccc.mp4')"),/Uploaded video/);
    await assert.rejects(db.query("insert into public.club_projects(title,media_kind,youtube_id) values('bad','youtube','invalid')"),/check constraint/);
   });
   await as('anon',null,async()=>assert.equal((await db.query('select * from public.club_projects')).rows.length,1));
  });
  await t.test('anonymous visitors see aggregates only; repeated browser keys do not add visits',async()=>{
   await as('anon',null,async()=>{
    await assert.rejects(db.query('select * from private.site_visit_keys'));
    await assert.rejects(db.query('update private.site_visit_totals set total=999'));
    const hit=async id=>(await db.query('select public.record_site_visit($1) as data',[id])).rows[0].data;
    assert.equal((await hit(admin)).total,1);assert.equal((await hit(admin)).total,1);assert.equal((await hit(other)).total,2);
    assert.equal((await db.query('select public.site_visit_stats() as data')).rows[0].data.today,2);
   });
  });
  await t.test('FAQ/email saving and setup reruns preserve edits, roles, projects and counts',async()=>{
   assert.equal((await db.query("select kind from public.team_people where name='이충현'")).rows[0].kind,'mentor');
   const rev=(await db.query('select revision from public.site_copy')).rows[0].revision;
   await as('authenticated',admin,async()=>{await db.query('select public.publish_site_copy($1::jsonb,$2)',[JSON.stringify({...defaultCopy,'hero.title':'운영진이 수정한 제목'}),rev]);});
   await db.exec(migration);
   assert.equal((await db.query('select content from public.site_copy')).rows[0].content['hero.title'],'운영진이 수정한 제목');
   assert.equal((await db.query('select total from private.site_visit_totals')).rows[0].total,2);
   assert.equal((await db.query('select count(*) n from public.club_projects')).rows[0].n,1);
   await as('authenticated',other,()=>assert.rejects(db.query('select public.publish_site_copy($1::jsonb,1)',[JSON.stringify(defaultCopy)]),/Administrator/));
  });
 }finally{await db.close();}
});
