import {readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const scripts=['admin.js','community-core.js','community.js','manage.js','hero-photo.js','image-upload.js','site-api.js','supabase-client.js','gallery-media.js','gallery-view.js','video-upload.js','home.js','site-copy.js','site-copy-schema.js','edit-home.js'];
for(const file of scripts){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);}
const pages=['SJ-ARC-Team.dc.html','SJ-ARC-Levels.dc.html','SJ-ARC-Gallery.dc.html','SJ-ARC-Board.dc.html','manage.html'];
for(const file of pages){const html=await readFile(file,'utf8');for(const id of ['nav','notice','view','dialog'])if(!html.includes(`id="${id}"`))throw new Error(`${file}: missing ${id}`);for(const [,asset] of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))await access(asset);}
for(const file of ['community.js','manage.js']){const source=await readFile(file,'utf8');if(/localStorage\.setItem/.test(source))throw new Error('Community records must use server persistence');}
console.log('JavaScript syntax and local page dependencies passed.');
