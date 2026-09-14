import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('vendor', { recursive: true });
await build({ stdin: { contents: "export { createClient } from '@supabase/supabase-js';", resolveDir: process.cwd() },
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true,
  legalComments: 'eof', outfile: 'vendor/supabase.js' });
await copyFile('node_modules/@supabase/supabase-js/LICENSE', 'vendor/supabase-LICENSE');
