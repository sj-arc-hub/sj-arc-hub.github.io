import test from 'node:test';
import assert from 'node:assert/strict';
import { createSiteApi, readableError } from '../site-api.js';

test('Google login stays unavailable until the provider explicitly reports enabled', async () => {
  let result = { external: { google: false } };
  let ok = true;
  const site = createSiteApi({}, { url: 'https://project.example', publishableKey: 'public-test-key' }, async (url, options) => {
    assert.equal(url, 'https://project.example/auth/v1/settings');
    assert.equal(options.headers.apikey, 'public-test-key');
    return { ok, json: async () => result };
  });
  assert.equal(await site.googleEnabled(), false);
  result = {};
  assert.equal(await site.googleEnabled(), false);
  result = { external: { google: true } };
  assert.equal(await site.googleEnabled(), true);
  ok = false;
  await assert.rejects(site.googleEnabled(), /Could not load login settings/);
});

test('upload failure never publishes; successful publication uses the returned unique path', async () => {
  let rpcCalls = 0;
  let failUpload = true;
  const client = {
    storage: { from: () => ({ upload: async (path, blob, options) => {
      assert.match(path, /^hero\/[0-9a-f-]{36}\.webp$/);
      assert.equal(options.upsert, false);
      return { error: failUpload ? new Error('upload failed') : null };
    } }) },
    rpc: async (name, args) => {
      rpcCalls++;
      assert.equal(name, 'publish_hero');
      assert.equal(args.p_expected_revision, 3);
      return { data: { hero_path: args.p_path, revision: 4 }, error: null };
    },
  };
  const site = createSiteApi(client, { publicBucket: 'sjarc-public' });
  const blob = new Blob(['photo'], { type: 'image/webp' });
  await assert.rejects(site.saveHero(blob, '사진', 3), /upload failed/);
  assert.equal(rpcCalls, 0);
  failUpload = false;
  assert.equal((await site.saveHero(blob, '사진', 3)).revision, 4);
  assert.equal(rpcCalls, 1);
});

test('invalid images and external paths are rejected before storage access', async () => {
  const site = createSiteApi({}, { publicBucket: 'sjarc-public' });
  assert.equal(site.photoUrl('https://unexpected.example/picture.jpg'), '');
  assert.equal(site.photoUrl('../private/file'), '');
  await assert.rejects(site.saveHero(new Blob(['x'], { type: 'image/svg+xml' }), '사진', 0), /Invalid image/);
  await assert.rejects(site.saveHero(new Blob(['x'], { type: 'image/webp' }), '', 0), /Invalid photo details/);
});

test('concurrency errors stay distinguishable from setup and permission errors', () => {
  assert.match(readableError({ code: '40001' }), /다른 운영진/);
  assert.match(readableError({ code: '42501' }), /권한/);
  assert.match(readableError({ code: 'PGRST205' }), /초기 설정/);
});
