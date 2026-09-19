import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {normalizeCopy,defaultCopy,copyFields,applyCopy,createCopyApi} from '../site-copy.js';
test('copy defaults survive old, absent and malformed server content',()=>{
  for(const input of [null,[],1,{}, {'unknown':'x','hero.title':3}])assert.equal(normalizeCopy(input)['hero.title'],defaultCopy['hero.title']);
  assert.equal(normalizeCopy({'hero.title':'새 제목\n두 번째 줄'})['hero.title'],'새 제목\n두 번째 줄');
});
test('invalid links, excessive text and unknown fields cannot be published',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,hello','http://example.com','https://user:pass@example.com','https://example.com\n'])assert.throws(()=>normalizeCopy({'links.join':url},{strict:true}));
  assert.throws(()=>normalizeCopy({'hero.title':'가'.repeat(101)},{strict:true}));
  assert.throws(()=>normalizeCopy({'__unexpected':'x'},{strict:true}));
  assert.throws(()=>normalizeCopy({'hero.title':'\u0001'},{strict:true}));
});
test('editable text is assigned as text, not HTML, and invalid URLs use safe defaults',()=>{
  const text={dataset:{copy:'hero.title'},textContent:''};const link={dataset:{copyLink:'links.join'},setAttribute(name,value){this[name]=value;}};
  const root={querySelectorAll(selector){return selector==='[data-copy]'?[text]:[link];}};
  const malicious='<img src=x onerror=alert(1)>';
  applyCopy(root,{'hero.title':malicious,'links.join':'javascript:alert(1)'});
  assert.equal(text.textContent,malicious);assert.equal(link.href,defaultCopy['links.join']);
});
test('copy API requires revision confirmation and never hides server conflict errors',async()=>{
  let called=false;
  const api=createCopyApi({rpc:async(name,args)=>{called=true;assert.equal(name,'publish_site_copy');assert.equal(args.p_expected_revision,2);return {error:{code:'40001'}};}});
  await assert.rejects(api.publish({'links.join':'javascript:alert(1)'},2));assert.equal(called,false);
  await assert.rejects(api.publish({},2),error=>error.code==='40001');
  const uncertain=createCopyApi({rpc:async()=>({data:{revision:2}})});await assert.rejects(uncertain.publish({},2),/저장 결과/);
});
test('homepage exposes every registered editable field and keeps static defaults without JavaScript',async()=>{
  const html=await readFile(new URL('../SJ-ARC-Home.dc.html',import.meta.url),'utf8');
  const ids=[...html.matchAll(/data-copy(?:-link)?="([^"]+)"/g)].map(m=>m[1]);
  for(const field of copyFields)assert.ok(ids.includes(field.key),field.key);
  assert.ok(html.includes('함께 만들고,'));assert.ok(!html.includes('cdn.tailwindcss.com'));assert.ok(!html.includes('vgbujcuwptvheqijyjbe'));
});
test('PostgreSQL limits copy publication to admins, detects stale edits, preserves photos and survives reruns',async t=>{
  const db=new PGlite();
  const admin='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222';
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`);
  const base=await readFile(new URL('../supabase/001-site-foundation.sql',import.meta.url),'utf8');
  const migration=await readFile(new URL('../supabase/005-site-copy.sql',import.meta.url),'utf8');
  await db.exec(base);await db.exec(migration);
  await db.exec(`insert into auth.users values('${admin}','{}'),('${member}','{}');update public.profiles set role='admin' where id='${admin}';update public.site_settings set hero_path='hero/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',revision=9;`);
  async function as(role,id,fn){await db.exec(`set role ${role};select set_config('request.jwt.claim.sub','${id||''}',false);`);try{return await fn();}finally{await db.exec('reset role;');}}
  const publish=(content,revision)=>db.query('select public.publish_site_copy($1::jsonb,$2) as result',[JSON.stringify(content),revision]);
  try{
    await t.test('public reads but no public or member writes',async()=>{
      await as('anon',null,async()=>{assert.equal((await db.query('select * from public.site_copy')).rows.length,1);await assert.rejects(publish({},0),/permission denied/);await assert.rejects(db.query("update public.site_copy set content='{}'"),/permission denied/);});
      await as('authenticated',member,()=>assert.rejects(publish({},0),/Administrator/));
    });
    await t.test('server rejects forged fields, URLs, shapes and oversized values',async()=>{
      await as('authenticated',admin,async()=>{
        for(const input of [null,[],{'hero.title':5},{unknown:'x'},{'hero.title':''},{'hero.title':'가'.repeat(101)},{'links.join':'javascript:alert(1)'},{'links.join':'https://user@example.com'},{'hero.title':'\u0001'}])await assert.rejects(publish(input,0),error=>error.code==='22023');
        await assert.rejects(db.query("update public.site_copy set content='{}'"),/permission denied/);
      });
    });
    await t.test('approved defaults publish atomically and stale writes preserve current copy',async()=>{
      await as('authenticated',admin,async()=>{
        const result=(await publish({...defaultCopy,'hero.title':'새 제목\n우리의 비행'},0)).rows[0].result;
        assert.equal(result.revision,1);assert.equal(result.content['hero.title'],'새 제목\n우리의 비행');
        await assert.rejects(publish({'hero.title':'덮어쓰기 시도'},0),error=>error.code==='40001');
      });
      await as('anon',null,async()=>{assert.equal((await db.query('select content from public.site_copy')).rows[0].content['hero.title'],'새 제목\n우리의 비행');});
      assert.equal((await db.query('select revision from public.site_settings')).rows[0].revision,9);
    });
    await t.test('migration rerun keeps saved text and privileges',async()=>{
      await db.exec(migration);assert.equal((await db.query('select revision from public.site_copy')).rows[0].revision,1);
      await as('authenticated',member,()=>assert.rejects(publish({},1),/Administrator/));
    });
  }finally{await db.close();}
});
