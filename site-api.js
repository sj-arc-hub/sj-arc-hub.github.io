export function readableError(error) {
  if (error?.code === '40001') return '다른 운영진이 사진을 변경했습니다. 현재 사진을 새로 불러온 뒤 다시 저장해 주세요.';
  if (error?.code === '42501' || error?.status === 403) return '이 계정에는 변경 권한이 없습니다. 운영진 권한을 확인해 주세요.';
  if (error?.code === 'PGRST205' || error?.code === '42P01') return '사이트 초기 설정이 아직 완료되지 않았습니다.';
  if (/provider.*not enabled|Unsupported provider/i.test(error?.message || '')) return 'Google 로그인 설정이 아직 완료되지 않았습니다.';
  return '요청을 완료하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
}

export function createSiteApi(client, config, request = fetch) {
  return {
    async googleEnabled() {
      const response = await request(config.url + '/auth/v1/settings', {
        headers: { apikey: config.publishableKey }, signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Could not load login settings');
      return (await response.json()).external?.google === true;
    },
    async settings() {
      const { data, error } = await client.from('site_settings')
        .select('id,hero_path,hero_alt,revision,updated_at').eq('id', 1).single();
      if (error) throw error;
      return data;
    },
    async profile(userId) {
      const { data, error } = await client.from('profiles')
        .select('id,display_name,role').eq('id', userId).single();
      if (error) throw error;
      return data;
    },
    photoUrl(path) {
      if (!/^hero\/[0-9a-f-]{36}\.(webp|jpg|png)$/.test(path || '')) return '';
      return client.storage.from(config.publicBucket).getPublicUrl(path).data.publicUrl;
    },
    async saveHero(blob, description, expectedRevision) {
      const extensions = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
      const extension = extensions[blob.type];
      const alt = description.trim();
      if (!extension || !blob.size || blob.size > 5 * 1024 * 1024) throw new Error('Invalid image');
      if (!alt || [...alt].length > 180 || !Number.isSafeInteger(expectedRevision)) throw new Error('Invalid photo details');
      const path = `hero/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await client.storage.from(config.publicBucket)
        .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await client.rpc('publish_hero', {
        p_path: path, p_alt: alt, p_expected_revision: expectedRevision,
      });
      // Do not delete the upload on an uncertain response: publishing may have succeeded.
      // Previous images are retained; future media management can retire unreferenced files.
      if (error) throw error;
      if (!data || data.hero_path !== path) throw new Error('Publication not confirmed');
      return data;
    },
  };
}
