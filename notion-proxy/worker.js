// SJ-ARC Notion 프록시 — Cloudflare Worker (읽기 전용)
// Notion DB → JSON. 사이트(GitHub Pages)는 이 Worker 주소만 알면 됩니다.
//
// 환경 변수 (Worker → Settings → Variables and Secrets)
//   NOTION_TOKEN         [Secret] Notion 통합 시크릿 (ntn_... 또는 secret_...)
//   NOTION_DB_STUDENTS   학생 레벨 관리 DB ID (32자리)            → GET /students
//   NOTION_DB_ALBUMS     (선택) 갤러리 앨범 DB ID                  → GET /albums
//   NOTION_DB_PHOTOS     (선택) 갤러리 사진 DB ID                  → GET /photos
//   NOTION_DB_POSTS      (선택) 게시판 DB ID                       → GET /posts
//   ALLOWED_ORIGINS      (선택) 허용 도메인, 쉼표 구분. 비우면 모두 허용
//   CACHE_SECONDS        (선택) 캐시 시간(초). 기본 120. ?fresh=1 을 붙이면 캐시 무시
//
// 이미지: GET /file/{pageId}/{속성이름}/{번호}  또는  /file/{pageId}/cover
//   Notion 내부 파일 URL은 1시간 뒤 만료되므로 요청 시점에 최신 URL을 받아 그대로 전달합니다.

const NOTION_VERSION = '2022-06-28';
const memo = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return json({ error: 'GET only' }, 405, cors);

    const dbs = { students: env.NOTION_DB_STUDENTS, albums: env.NOTION_DB_ALBUMS, photos: env.NOTION_DB_PHOTOS, posts: env.NOTION_DB_POSTS };
    const parts = url.pathname.split('/').filter(Boolean);
    const route = parts[0] || '';

    if (!route) return json({ ok: true, endpoints: Object.keys(dbs).filter(k => dbs[k]).map(k => '/' + k), file: '/file/{pageId}/{property}/{index}' }, 200, cors);
    if (!env.NOTION_TOKEN) return json({ error: 'NOTION_TOKEN 환경 변수가 없습니다' }, 500, cors);
    if (route === 'file') return fileProxy(parts, env, cors);

    const dbId = dbs[route];
    if (!dbId) return json({ error: 'unknown endpoint: /' + route, hint: 'NOTION_DB_' + route.toUpperCase() + ' 환경 변수를 설정하세요' }, 404, cors);

    const ttl = Math.max(0, Number(env.CACHE_SECONDS ?? 120)) * 1000;
    const hit = memo.get(route);
    if (hit && !url.searchParams.has('fresh') && Date.now() - hit.at < ttl) return json(hit.body, 200, cors, { 'X-Cache': 'HIT' });

    try {
      const rows = await queryAll(dbId, env.NOTION_TOKEN);
      const body = { db: route, count: rows.length, fetchedAt: new Date().toISOString(), rows };
      memo.set(route, { at: Date.now(), body });
      return json(body, 200, cors, { 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=' + Math.floor(ttl / 1000) });
    } catch (e) {
      return json({ error: String(e.message || e) }, 502, cors);
    }
  },
};

async function notion(path, token, init = {}) {
  const res = await fetch('https://api.notion.com/v1' + path, {
    ...init,
    headers: { Authorization: 'Bearer ' + token, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) {
    let msg = res.status + ' ' + res.statusText;
    try { const j = await res.json(); if (j.message) msg += ' — ' + j.message; } catch (_) {}
    throw new Error('Notion API ' + msg);
  }
  return res.json();
}

async function queryAll(dbId, token) {
  const rows = [];
  let cursor;
  do {
    const data = await notion('/databases/' + cleanId(dbId) + '/query', token, {
      method: 'POST',
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    for (const page of data.results) rows.push(normalize(page));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return rows;
}

function normalize(page) {
  const props = {}, types = {};
  let title = '';
  for (const [name, p] of Object.entries(page.properties || {})) {
    props[name] = value(p);
    types[name] = p.type;
    if (p.type === 'title') title = props[name] || '';
  }
  return {
    id: page.id, url: page.url, title,
    cover: fileUrl(page.cover),
    icon: page.icon && page.icon.type === 'emoji' ? page.icon.emoji : null,
    createdTime: page.created_time, lastEditedTime: page.last_edited_time,
    props, types,
  };
}

function fileUrl(f) { return !f ? null : f.type === 'external' ? f.external.url : (f.file ? f.file.url : null); }

function value(p) {
  switch (p.type) {
    case 'title': case 'rich_text': return (p[p.type] || []).map(t => t.plain_text).join('');
    case 'number': return p.number;
    case 'select': return p.select ? p.select.name : null;
    case 'status': return p.status ? p.status.name : null;
    case 'multi_select': return (p.multi_select || []).map(s => s.name);
    case 'date': return p.date ? p.date.start : null;
    case 'checkbox': return !!p.checkbox;
    case 'url': return p.url;
    case 'email': return p.email;
    case 'phone_number': return p.phone_number;
    case 'files': return (p.files || []).map(fileUrl).filter(Boolean);
    case 'people': return (p.people || []).map(u => u.name).filter(Boolean);
    case 'relation': return (p.relation || []).map(r => r.id);
    case 'created_time': return p.created_time;
    case 'last_edited_time': return p.last_edited_time;
    case 'created_by': case 'last_edited_by': return (p[p.type] && p[p.type].name) || null;
    case 'formula': return p.formula ? (p.formula.type === 'date' ? (p.formula.date && p.formula.date.start) : p.formula[p.formula.type]) : null;
    case 'rollup': { const r = p.rollup; if (!r) return null; return r.type === 'array' ? r.array.map(value) : r[r.type]; }
    case 'unique_id': return p.unique_id ? (p.unique_id.prefix ? p.unique_id.prefix + '-' : '') + p.unique_id.number : null;
    default: return null;
  }
}

async function fileProxy(parts, env, cors) {
  const [, pageId, propRaw, idxRaw] = parts;
  if (!pageId) return json({ error: '/file/{pageId}/{property}/{index}' }, 400, cors);
  try {
    const page = await notion('/pages/' + cleanId(pageId), env.NOTION_TOKEN);
    let src = null;
    if (!propRaw || propRaw === 'cover') src = fileUrl(page.cover);
    else { const prop = page.properties[decodeURIComponent(propRaw)]; const files = prop && prop.type === 'files' ? value(prop) : []; src = files[Number(idxRaw || 0)] || null; }
    if (!src) return json({ error: 'file not found' }, 404, cors);
    const upstream = await fetch(src);
    const headers = new Headers(cors);
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=86400');
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502, cors);
  }
}

function cleanId(id) { const m = String(id || '').replace(/-/g, '').match(/[0-9a-f]{32}/i); return m ? m[0] : String(id || '').trim(); }

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const allow = allowed.length === 0 ? '*' : (allowed.includes(origin) ? origin : allowed[0]);
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
}

function json(body, status, cors, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', ...extra } });
}
