import { client, site } from './supabase-client.js';
import { preparePhoto } from './image-upload.js';
import { readableError } from './site-api.js';
export { client };
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const today = () => new Date().toLocaleDateString('en-CA');
export const levels = { '운영':['Beginner','Expert','Master'], '개발':['Intro','Middle','Advanced','Core'] };
export const levelLabel = (track, n) => `LV${n} · ${levels[track]?.[n-1] || ''}`;
export const categories = ['공지','질문 / 답변','자료','대회 소식','승급자료'];
export const albumCategories = ['정기모임','기체 제작','비행 실습','대회','세미나','기타'];
export const statuses = {draft:'작성 중',published:'공개',archived:'보관',submitted:'심사 대기',approved:'승급 승인',rejected:'보완 요청'};
export function message(text, error=false) {
  const el = document.getElementById('notice'); el.textContent = text; el.hidden = !text; el.classList.toggle('error',error);
}
export function errorText(e) {
  if (e?.code === 'PGRST202' || e?.code === 'PGRST205' || e?.code === '42P01') return '새 관리 기능의 서버 설정이 필요합니다. 운영자가 003-community.sql을 실행한 뒤 새로고침해 주세요.';
  if (e?.code==='40001') return '다른 수정이나 심사가 반영됐습니다. 새로고침해서 현재 내용을 확인해 주세요.';
  if (e?.code==='23505') return '이미 연결된 계정이거나, 심사 중인 승급 신청이 있습니다. 기존 기록을 확인해 주세요.';
  const known = [
    ['different administrator','본인의 승급자료는 다른 운영진이 심사해야 합니다.'],
    ['Submitted evidence is locked','심사 중이거나 승인된 승급자료는 변경할 수 없습니다.'],
    ['Attach evidence','근거 파일 또는 자료·영상 링크를 추가해 주세요.'],
    ['Link an active member','운영진에게 Google 계정과 회원 명단 연결을 요청해 주세요.'],
    ['Maximum 10 files','글 하나에는 파일을 최대 10개까지 첨부할 수 있습니다.'],
    ['Write at least','활동 내용을 10자 이상 작성해 주세요.'],
  ];
  for (const [match,text] of known) if (e?.message?.includes(match)) return text;
  if (e?.code==='23514' || e?.code==='22023' || e?.code==='23502') return '입력값을 확인해 주세요. 승급 신청은 현재 레벨의 다음 단계만 가능합니다.';
  if (!e?.code && e instanceof Error && e.userMessage) return e.message;
  return readableError(e);
}
export function fail(text) { const e = new Error(text); e.userMessage=true; throw e; }
export async function result(query) { const {data,error} = await query; if(error) throw error; return data; }
export async function rpc(name,args) { return result(client.rpc(name,args)); }
export async function auth() {
  const {data:{session},error} = await client.auth.getSession(); if(error) throw error;
  const profile = session ? await site.profile(session.user.id) : null;
  let member = null;
  if(session) member = await result(client.from('club_members').select('*').eq('user_id',session.user.id).maybeSingle());
  return {user:session?.user,profile,member,admin:profile?.role==='admin',canWrite:profile?.role==='admin'||(profile?.role==='member'&&!!member?.active)};
}
export function photoUrl(path) {
  if(!/^(team|gallery)\/[0-9a-f-]{36}\.(webp|jpg|png)$/.test(path||'')) return '';
  return client.storage.from('sjarc-media').getPublicUrl(path).data.publicUrl;
}
export function external(url,label) {
  if(!/^https?:\/\//i.test(url||'')) return '';
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}
export function options(list,value) { return list.map(item => { const [val,label] = Array.isArray(item)?item:[item,item]; return `<option value="${esc(val)}" ${String(val)===String(value)?'selected':''}>${esc(label)}</option>`; }).join(''); }
export function field(name,label,value='',attrs='') { return `<label>${esc(label)}<input name="${name}" value="${esc(value)}" ${attrs}></label>`; }
export function area(name,label,value='',attrs='') { return `<label>${esc(label)}<textarea name="${name}" ${attrs}>${esc(value)}</textarea></label>`; }
export function select(name,label,list,value='') { return `<label>${esc(label)}<select name="${name}">${options(list,value)}</select></label>`; }
export function check(name,label,value) { return `<label class="check"><input type="checkbox" name="${name}" ${value?'checked':''}>${esc(label)}</label>`; }
export function empty(text) { return `<div class="empty">${esc(text)}</div>`; }
export function nav(page,account) {
  const links=[['home','홈','SJ-ARC-Home.dc.html'],['team','운영진','SJ-ARC-Team.dc.html'],['levels','레벨 현황','SJ-ARC-Levels.dc.html'],['gallery','갤러리','SJ-ARC-Gallery.dc.html'],['board','게시판','SJ-ARC-Board.dc.html']];
  document.getElementById('nav').innerHTML=`<a class="brand" href="./SJ-ARC-Home.dc.html"><img src="./assets/sjarc-mark.png" alt="">SJ-ARC</a><nav aria-label="주 메뉴">${links.map(([key,text,url])=>`<a href="./${url}" ${page===key?'aria-current="page"':''}>${text}</a>`).join('')}<a href="https://forms.gle/tCWkZqtovFibKZ4KA" target="_blank" rel="noopener">가입 신청</a><a href="./admin.html">${account.user?'내 계정':'Google 로그인'}</a>${account.admin?'<a class="accent" href="./manage.html">콘텐츠 관리</a>':''}</nav>`;
}
export async function uploadPhoto(file,folder) {
  let blob;try{blob=await preparePhoto(file);}catch(e){e.userMessage=true;throw e;}
  const path=`${folder}/${crypto.randomUUID()}.webp`;
  await result(client.storage.from('sjarc-media').upload(path,blob,{contentType:blob.type,cacheControl:'31536000',upsert:false}));
  return path;
}
export async function saveRecord(table,values,existing) {
  if(!existing) return result(client.from(table).insert(values).select().single());
  const saved=await result(client.from(table).update(values).eq('id',existing.id).eq('revision',existing.revision).select().maybeSingle());
  if(!saved) throw {code:'40001'};
  return saved;
}
export const fileTypes={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain',zip:'application/zip',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
export async function attachFile(post,file,userId) {
  let ext=file.name.split('.').pop().toLowerCase();
  if(!fileTypes[ext]||!file.size||file.size>25*1024*1024) fail('첨부파일은 PDF·Office 문서·TXT·ZIP·사진, 파일당 25MB 이하로 선택해 주세요.');
  const type=fileTypes[ext]; if(ext==='jpeg') ext='jpg';
  const path=`${post.id}/${userId}/${crypto.randomUUID()}.${ext}`;
  await result(client.storage.from('sjarc-documents').upload(path,file,{contentType:type,upsert:false}));
  // A lost response may mean the link succeeded; retain the object and ask the user to reload.
  return rpc('cm_attach_file',{p_post:post.id,p_revision:post.revision,p_path:path,p_filename:file.name.slice(0,150),p_size:file.size});
}
export async function downloadFile(file) {
  const data=await result(client.storage.from('sjarc-documents').createSignedUrl(file.path,60,{download:file.filename}));
  const link=document.createElement('a'); link.href=data.signedUrl; link.rel='noopener'; link.target='_blank'; link.click();
}
let working=false;
export async function task(action) {
  if(working) return;
  working=true; document.body.setAttribute('aria-busy','true');
  const enabled=[...document.querySelectorAll('button,input,select,textarea')].filter(x=>!x.disabled);
  for(const item of enabled) item.disabled=true;
  message('처리 중입니다…');
  try { await action(); }
  catch(e) { message(errorText(e),true); }
  finally { working=false; document.body.removeAttribute('aria-busy'); for(const item of enabled) if(item.isConnected) item.disabled=false; }
}
window.addEventListener('beforeunload',event=>{if(working){event.preventDefault();event.returnValue='';}});
export function modal(title,body,onSubmit) {
  const dialog=document.getElementById('dialog');
  dialog.innerHTML=`<form id="dialog-form"><div class="dialog-head"><h2>${esc(title)}</h2><button type="button" data-close aria-label="닫기">닫기</button></div>${body}<p id="dialog-error" role="alert"></p><div class="actions"><button class="primary" type="submit">저장</button><button type="button" data-close>취소</button></div></form>`;
  dialog.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>dialog.close());
  dialog.oncancel=e=>{if(working)e.preventDefault();};
  dialog.querySelector('form').onsubmit=event=>{
    event.preventDefault();
    // Collect before task disables fields; disabled controls are omitted by FormData.
    const data=new FormData(event.target);
    task(async()=>{try{await onSubmit(data);dialog.close();}catch(e){dialog.querySelector('#dialog-error').textContent=errorText(e);throw e;}});
  };
  dialog.showModal();
}
