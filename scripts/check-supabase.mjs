// Read-only health check; never prints credentials, user records or uploaded content.
import {config} from '../supabase-config.js';
const headers={apikey:config.publishableKey};
const endpoints=['/auth/v1/settings','/rest/v1/site_settings?select=id&limit=1','/rest/v1/team_people?select=id&limit=1','/rest/v1/member_directory?select=id&limit=1','/rest/v1/albums?select=id&limit=1','/rest/v1/community_posts?select=id&limit=1'];
let ready=true;
for(const endpoint of endpoints){try{const response=await fetch(config.url+endpoint,{headers,signal:AbortSignal.timeout(15000)});const data=await response.json();const detail=endpoint.includes('/auth/')?`Google enabled: ${data.external?.google===true}`:(response.ok?'public read OK':`code: ${data.code||'unknown'}`);console.log(response.status,endpoint.split('?')[0],detail);if(!response.ok)ready=false;}catch{console.log('Connection failed',endpoint.split('?')[0]);ready=false;}}
if(!ready)process.exitCode=1;
