import { createClient } from './vendor/supabase.js';
import { config } from './supabase-config.js';
import { createSiteApi } from './site-api.js';

export const client = createClient(config.url, config.publishableKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});
export const site = createSiteApi(client, config);
