import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const admin = '11111111-1111-4111-8111-111111111111';
const member = '22222222-2222-4222-8222-222222222222';
const pending = '33333333-3333-4333-8333-333333333333';
const photo1 = 'hero/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp';
const photo2 = 'hero/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp';
const schema = await readFile(new URL('../supabase/001-site-foundation.sql', import.meta.url), 'utf8');

test('PostgreSQL grants, roles, uploads and publication', async t => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
    create table auth.identities (user_id uuid references auth.users(id), provider text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, storage to anon, authenticated;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon, authenticated;
  `);
  await db.exec(schema);
  await db.exec(`insert into auth.users values
    ('${admin}','admin@example.test',now(),'{}'),
    ('${member}','member@example.test',now(),'{}'),
    ('${pending}','pending@example.test',now(),'{"role":"admin","full_name":"Attempted admin"}');
    update public.profiles set role='admin' where id='${admin}';
    update public.profiles set role='member' where id='${member}';
  `);
  async function as(role, id, operation) {
    await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${id || ''}',false);`);
    try { return await operation(); }
    finally { await db.exec('reset role;'); }
  }
  const upload = path => db.query('insert into storage.objects (bucket_id,name) values ($1,$2)', ['sjarc-public', path]);
  const publish = (path, revision, alt = '정기모임 활동') => db.query(
    'select public.publish_hero($1,$2,$3) as result', [path, alt, revision]);
  try {
    await t.test('anonymous visitors read settings but cannot read profiles', async () => {
      await as('anon', null, async () => {
        assert.equal((await db.query('select * from public.site_settings')).rows.length, 1);
        await assert.rejects(db.query('select * from public.profiles'), /permission denied/);
        await assert.rejects(publish(photo1, 0), /permission denied/);
      });
    });
    await t.test('signup metadata cannot grant admin and members only see themselves', async () => {
      await as('authenticated', pending, async () => {
        const { rows } = await db.query('select id,role from public.profiles');
        assert.deepEqual(rows, [{ id: pending, role: 'pending' }]);
        await assert.rejects(db.query("update public.profiles set role='admin'"), /permission denied/);
        await assert.rejects(publish(photo1, 0), /Administrator role required/);
      });
    });
    await t.test('member and anonymous uploads are rejected', async () => {
      await as('anon', null, () => assert.rejects(upload(photo1), /row-level security/));
      await as('authenticated', member, () => assert.rejects(upload(photo1), /row-level security/));
    });
    await t.test('admin may upload only allowed hero paths', async () => {
      await as('authenticated', admin, async () => {
        await assert.rejects(upload('evidence/private.pdf'), /row-level security/);
        await upload(photo1); await upload(photo2);
        await assert.rejects(db.query('update public.site_settings set hero_path=$1', [photo1]), /permission denied/);
      });
    });
    await t.test('publication rejects missing files and invalid descriptions', async () => {
      await as('authenticated', admin, async () => {
        await assert.rejects(publish('hero/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp', 0), /not found/);
        await assert.rejects(publish(photo1, 0, ''), /description/);
      });
    });
    await t.test('admin publication persists and concurrent overwrite is rejected', async () => {
      await as('authenticated', admin, async () => {
        const { rows } = await publish(photo1, 0);
        assert.equal(rows[0].result.hero_path, photo1);
        assert.equal(rows[0].result.revision, 1);
        await assert.rejects(publish(photo2, 0), /another administrator/);
      });
      await as('anon', null, async () => {
        assert.equal((await db.query('select hero_path from public.site_settings')).rows[0].hero_path, photo1);
      });
    });
    await t.test('existing stored photos cannot be overwritten through the API', async () => {
      await as('authenticated', admin, async () => {
        const changed = await db.query('update storage.objects set name=$1 where name=$2 returning *', [photo2, photo1]);
        assert.equal(changed.rows.length, 0);
      });
    });
    await t.test('rerunning setup preserves admin and published photo', async () => {
      await db.exec(schema);
      assert.equal((await db.query('select hero_path from public.site_settings')).rows[0].hero_path, photo1);
      assert.equal((await db.query('select role from public.profiles where id=$1', [admin])).rows[0].role, 'admin');
    });
    await t.test('bootstrap requires verified Google identity', async () => {
      const bootstrap = (await readFile(new URL('../supabase/002-bootstrap-admin.example.sql', import.meta.url), 'utf8'))
        .replace('YOUR_GOOGLE_EMAIL', 'pending@example.test').replace('YOUR_GOOGLE_EMAIL', 'pending@example.test');
      await assert.rejects(db.exec(bootstrap), /Sign in with the specified Google/);
      await db.query('insert into auth.identities values ($1,$2)', [pending, 'google']);
      await db.exec(bootstrap);
      assert.equal((await db.query('select role from public.profiles where id=$1', [pending])).rows[0].role, 'admin');
    });
  } finally { await db.close(); }
});
