import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const base=await readFile(new URL('../supabase/001-site-foundation.sql',import.meta.url),'utf8');
const migration=await readFile(new URL('../supabase/003-community.sql',import.meta.url),'utf8');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
test('community authorization, public evidence and transactional promotion',async t=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create table auth.identities(user_id uuid references auth.users(id),provider text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to anon,authenticated;`);
 await db.exec(base);await db.exec(migration);
 await db.exec(`insert into auth.users values('${a}','admin@example.test',now(),'{}'),('${b}','member@example.test',now(),'{}'),('${c}','pending@example.test',now(),'{}');
 update public.profiles set role='admin' where id='${a}';`);
 async function as(role,id,fn){await db.exec(`set role ${role};select set_config('request.jwt.claim.sub','${id||''}',false)`);try{return await fn();}finally{await db.exec('reset role');}}
 const admin=fn=>as('authenticated',a,fn), member=fn=>as('authenticated',b,fn), pending=fn=>as('authenticated',c,fn),anon=fn=>as('anon',null,fn);
 const call=async(name,args=[])=>{const {rows}=await db.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) as value`,args);return rows[0]?.value;};
 let m,p,req,filePath;
 try{
  await t.test('admin creates roster; pending cannot write or self-approve; approval links a member',async()=>{
   m=await admin(async()=>{const {rows}=await db.query("insert into public.club_members(name,track,level,score,note) values('테스트 회원','개발',1,0,'내부 메모') returning *");return rows[0];});
   await pending(()=>assert.rejects(call('cm_create_post',['자료','무단 글','이 글은 허용되면 안 됩니다.','',null]),/Member role/));
   await pending(()=>assert.rejects(call('cm_manage_account',[c,'admin',null,'pending']),/Administrator/));
   await admin(()=>call('cm_manage_account',[b,'member',m.id,'pending']));
   await admin(()=>assert.rejects(call('cm_manage_account',[b,'pending',m.id,'pending']),/Account changed/));
   await member(async()=>{const changed=await db.query('update public.club_members set level=4 where id=$1 returning *',[m.id]);assert.equal(changed.rows.length,0);});
   assert.equal((await db.query('select level from public.club_members where id=$1',[m.id])).rows[0].level,1);
  });
  await t.test('anonymous directory exposes no login IDs or private member notes',async()=>{
   await anon(async()=>{const {rows}=await db.query('select * from public.member_directory');assert.equal(rows.length,1);assert.equal(rows[0].name,'테스트 회원');assert.equal('note' in rows[0],false);assert.equal('user_id' in rows[0],false);await assert.rejects(db.query('select * from public.club_members'),/permission denied/);await assert.rejects(call('cm_accounts'),/permission denied/);});
  });
  await t.test('gallery uploads require admin; hidden albums disappear from public reads',async()=>{
   const path='gallery/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp';
   await member(()=>assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('sjarc-media',$1)",[path]),/row-level security/));
   await admin(async()=>{await db.query("insert into storage.objects(bucket_id,name) values('sjarc-media',$1)",[path]);const album=(await db.query("insert into public.albums(title) values('시험 앨범') returning *")).rows[0];await db.query('insert into public.album_photos(album_id,path,caption) values($1,$2,$3)',[album.id,path,'비행 실습']);await db.query('update public.albums set published=false where id=$1',[album.id]);});
   await anon(async()=>{assert.equal((await db.query('select * from public.albums')).rows.length,0);assert.equal((await db.query('select * from public.album_photos')).rows.length,0);});
  });
  await t.test('evidence drafts and files are private until publication',async()=>{
   p=await member(()=>call('cm_create_post',['승급자료','비행 세미나 발표','세미나에서 비행 제어 실습 내용을 발표했습니다.','','세미나 발표']));
   req=(await db.query('select * from public.promotion_requests where post_id=$1',[p.id])).rows[0];
   filePath=`${p.id}/${b}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf`;
   await pending(()=>assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('sjarc-documents',$1)",[filePath]),/row-level security/));
   await member(async()=>{await db.query("insert into storage.objects(bucket_id,name) values('sjarc-documents',$1)",[filePath]);p=await call('cm_attach_file',[p.id,p.revision,filePath,'세미나.pdf',100]);});
   await anon(async()=>{assert.equal((await db.query('select * from public.community_posts')).rows.length,0);assert.equal((await db.query('select * from public.post_files')).rows.length,0);assert.equal((await db.query("select * from storage.objects where bucket_id='sjarc-documents'")).rows.length,0);});
   p=await member(()=>call('cm_post_action',[p.id,p.revision,'publish']));
   await anon(async()=>{assert.equal((await db.query('select * from public.community_posts')).rows.length,1);assert.equal((await db.query('select * from public.post_files')).rows.length,1);assert.equal((await db.query("select * from storage.objects where bucket_id='sjarc-documents'")).rows.length,1);assert.equal((await db.query('select status from public.promotion_summary')).rows[0].status,'submitted');});
  });
  await t.test('submitted evidence is immutable and cannot be reviewed by members',async()=>{
   await member(()=>assert.rejects(call('cm_edit_draft',[p.id,p.revision,'변경','바뀐 내용을 담은 글입니다.','']),/cannot be edited/));
   await member(()=>assert.rejects(call('cm_post_action',[p.id,p.revision,'archive']),/locked/));
   await member(()=>assert.rejects(call('cm_review',[req.id,1,'approved','잘했습니다.']),/Administrator/));
   const extra=`${p.id}/${b}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf`;
   await member(()=>assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('sjarc-documents',$1)",[extra]),/row-level security/));
   await member(async()=>{const result=await db.query("update public.promotion_requests set status='approved' where id=$1 returning *",[req.id]).catch(e=>({denied:e}));assert.ok(result.denied||result.rows.length===0);});
  });
  await t.test('rejection saves an immutable snapshot; author revises and resubmits',async()=>{
   await admin(()=>call('cm_review',[req.id,1,'rejected','비행 로그 설명을 보완해 주세요.']));
   assert.equal((await db.query('select level from public.club_members where id=$1',[m.id])).rows[0].level,1);
   p=await member(()=>call('cm_post_action',[p.id,p.revision,'unpublish']));
   p=await member(()=>call('cm_edit_draft',[p.id,p.revision,'보완한 비행 세미나 발표','비행 로그 해석과 실습 결과를 보완한 자료입니다.','']));
   const review=(await db.query('select * from public.promotion_reviews')).rows[0];assert.equal(review.snapshot.post.title,'비행 세미나 발표');assert.equal(review.snapshot.files.length,1);
   await db.exec('begin');
   await db.query('delete from public.post_files where post_id=$1',[p.id]);
   await member(async()=>assert.equal((await db.query('select * from storage.objects where name=$1',[filePath])).rows.length,1));
   await anon(async()=>assert.equal((await db.query('select * from storage.objects where name=$1',[filePath])).rows.length,0));
   await db.exec('rollback');
   p=await member(()=>call('cm_post_action',[p.id,p.revision,'publish']));
   await admin(()=>assert.rejects(call('cm_review',[req.id,1,'approved','오래된 심사']),/Review state changed/));
  });
  await t.test('approval updates level exactly once and records audit history atomically',async()=>{
   await admin(()=>call('cm_review',[req.id,2,'approved','자료와 발표 내용을 확인했습니다.']));
   assert.equal((await db.query('select level from public.club_members where id=$1',[m.id])).rows[0].level,2);
   assert.equal((await db.query('select * from public.promotion_reviews')).rows.length,2);
   await admin(()=>assert.rejects(call('cm_review',[req.id,2,'approved','중복 승인']),/Review state changed/));
   assert.equal((await db.query('select level from public.club_members where id=$1',[m.id])).rows[0].level,2);
   const audit=(await db.query("select * from public.member_events where reason like '승급자료 승인:%'")).rows;assert.equal(audit.length,1);assert.equal(audit[0].before_value.level,1);assert.equal(audit[0].after_value.level,2);
   await anon(()=>assert.rejects(db.query('select * from public.promotion_reviews'),/permission denied/));
  });
  await t.test('level conflicts prevent approval without partial review records',async()=>{
   const other=await member(()=>call('cm_create_post',['승급자료','다음 단계 영상','다음 단계의 실습을 유튜브 영상으로 발표했습니다.','https://www.youtube.com/watch?v=example','영상 발표']));
   await member(()=>call('cm_post_action',[other.id,other.revision,'publish']));
   const r=(await db.query('select * from public.promotion_requests where post_id=$1',[other.id])).rows[0];
   await admin(()=>db.query("update public.club_members set level=3,change_reason='이전 기록 정정' where id=$1",[m.id]));
   await admin(()=>assert.rejects(call('cm_review',[r.id,1,'approved','확인 완료']),/Member level changed/));
   assert.equal((await db.query('select * from public.promotion_reviews where request_id=$1',[r.id])).rows.length,0);
   await admin(()=>call('cm_review',[r.id,1,'rejected','현재 레벨 변경으로 다시 신청해 주세요.']));
  });
  await t.test('administrator cannot self-review; member revocation and inactive roster block writes',async()=>{
   await admin(()=>call('cm_manage_account',[b,'admin',null,'member']));
   const own=await member(()=>call('cm_create_post',['승급자료','최종 단계 자료','최종 단계의 개발 결과를 정리한 자료입니다.','https://example.test/evidence','자료 문서화']));
   await member(()=>call('cm_post_action',[own.id,own.revision,'publish']));
   const r=(await db.query('select id from public.promotion_requests where post_id=$1',[own.id])).rows[0];
   await member(()=>assert.rejects(call('cm_review',[r.id,1,'approved','본인 승인']),/different administrator/));
   await member(()=>assert.rejects(call('cm_manage_account',[b,'pending',null,'admin']),/own administrator/));
   await admin(()=>call('cm_manage_account',[b,'member',m.id,'admin']));
   await admin(()=>db.query("update public.club_members set active=false,change_reason='활동 중단' where id=$1",[m.id]));
   await member(()=>assert.rejects(call('cm_create_post',['자료','새 자료','현재 비활동 회원은 작성할 수 없습니다.','',null]),/Member role/));
  });
  await t.test('bulk import rolls back all rows on duplicate or invalid data',async()=>{
   await admin(()=>assert.rejects(call('cm_import_members',[JSON.stringify([{name:'새 회원',track:'운영',level:1,score:0},{name:'새 회원',track:'운영',level:1,score:0}])]),/Duplicate/));
   assert.equal((await db.query("select * from public.club_members where name='새 회원'")).rows.length,0);
   await admin(()=>assert.rejects(call('cm_import_members',[JSON.stringify([{name:'새 회원',track:'운영',level:4,score:0}])]),/check constraint/));
   assert.equal(await admin(()=>call('cm_import_members',[JSON.stringify([{name:'새 회원',track:'운영',level:1,score:0}])])),1);
  });
  await t.test('migration rerun preserves existing photos, roles, posts and review history',async()=>{
   await db.exec(migration);assert.equal((await db.query('select count(*)::int as n from public.promotion_reviews')).rows[0].n,3);
   assert.equal((await db.query('select role from public.profiles where id=$1',[a])).rows[0].role,'admin');
   assert.equal((await db.query('select * from public.post_files')).rows.length,1);
  });
 }finally{await db.close();}
});
