import {client,esc,photoUrl} from './community-core.js?v=20260927b';
import {mediaView} from './gallery-view.js?v=20260927b';
import {loadVisits,canCountVisit} from './site-visits.js';
const byId=id=>document.getElementById(id);
async function recent(){
 const box=byId('recent-activities');if(!box)return;
 try{
  const {data,error}=await client.from('albums').select('*,album_photos(*)').eq('published',true).eq('album_photos.active',true).order('sort_order',{referencedTable:'album_photos'}).limit(1,{referencedTable:'album_photos'}).order('event_date',{ascending:false,nullsFirst:false}).order('id').limit(3);
  if(error)throw error;
  box.innerHTML=data.length?data.map(a=>`<article class="home-content-card"><a href="./SJ-ARC-Gallery.dc.html?id=${esc(a.id)}">${a.album_photos?.[0]?mediaView(a.album_photos[0],true):'<div class="home-empty home-cover">활동 기록</div>'}<div class="home-card-body"><p class="home-date">${esc(a.event_date||'')} · ${esc(a.category)}</p><h3>${esc(a.title)}</h3><p>${esc(a.description.slice(0,140))}</p></div></a></article>`).join(''):'<p class="home-empty">공개된 활동 앨범을 준비하고 있습니다.</p>';
 }catch{box.innerHTML='<p class="home-empty">최근 활동을 불러오지 못했습니다. <a href="./SJ-ARC-Gallery.dc.html">갤러리에서 확인하기 →</a></p>';}
}
async function outcomes(){
 const box=byId('project-outcomes');if(!box)return;
 try{
  const {data,error}=await client.from('club_projects').select('*').eq('published',true).order('sort_order').order('updated_at',{ascending:false}).limit(3);if(error)throw error;
  box.innerHTML=data.length?data.map(p=>`<article class="home-content-card">${mediaView({...p,caption:p.title})}<div class="home-card-body"><h3>${esc(p.title)}</h3><p>${esc(p.description.slice(0,220))}</p>${p.technologies?`<p class="home-date">${esc(p.technologies)}</p>`:''}<a class="home-card-link" href="./SJ-ARC-Projects.dc.html#project-${esc(p.id)}">결과물 자세히 보기 →</a></div></article>`).join(''):'<p class="home-empty">아직 등록된 프로젝트 영상이 없습니다.<br>직접 만든 결과물과 시연 영상을 이곳에 공유할 예정입니다.</p>';
 }catch{box.innerHTML='<p class="home-empty">프로젝트 결과물 공간을 준비하고 있습니다.</p>';}
}
async function visits(){
 if(!byId('visits-today'))return;
 try{
  const data=await loadVisits(client,{count:canCountVisit(location)});
  byId('visits-today').textContent=Number(data.today).toLocaleString('ko-KR');byId('visits-total').textContent=Number(data.total).toLocaleString('ko-KR');
  byId('visits-note').textContent=`${data.started_on} 집계 시작 · 브라우저별 하루 1회 · 참고용 방문 수`;
 }catch{byId('visits-note').textContent='방문 집계를 준비하고 있습니다.';}
}
await Promise.allSettled([recent(),outcomes(),visits()]);
