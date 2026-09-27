import {client,esc,result,field,area,select,check,modal,saveRecord,fail,message} from './community-core.js?v=20260927b';
import {youtubeId} from './gallery-media.js';
import {prepareVideo} from './video-upload.js';
let projects=[];
export async function projectManagement(){
 try{projects=await result(client.from('club_projects').select('*').order('sort_order').order('updated_at',{ascending:false}));}
 catch(e){if(['42P01','PGRST205'].includes(e.code))fail('프로젝트 기능의 초기 서버 설정(006-projects-visits.sql)이 필요합니다.');throw e;}
 return `<div class="heading"><div><h2>프로젝트 결과물</h2><p>유튜브 링크 또는 영상 파일과 설명을 등록하세요.</p></div><button class="primary" data-action="project">결과물 추가</button></div><p class="small muted">영상 파일은 MP4·WebM, 50MB 이하입니다. 숨김은 소개의 노출만 중지하며 이미 업로드한 영상의 직접 주소는 유지됩니다.</p>`+
 (projects.length?`<div class="table-wrap"><table><thead><tr><th>제목</th><th>영상</th><th>공개</th><th>관리</th></tr></thead><tbody>${projects.map(p=>`<tr><td>${esc(p.title)}</td><td>${p.media_kind==='youtube'?'YouTube':'동영상 파일'}</td><td>${p.published?'공개':'숨김'}</td><td><button data-action="project" data-id="${p.id}">수정</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">첫 프로젝트 결과물을 등록해 주세요.</div>');
}
export function projectForm(id,onSaved){
 const p=projects.find(x=>x.id===id);
 modal(p?'프로젝트 수정':'프로젝트 결과물 추가',`${field('title','프로젝트 제목',p?.title,'required maxlength="120"')}${area('description','만든 내용·실험 결과',p?.description,'maxlength="3000"')}${field('technologies','사용 기술',p?.technologies,'maxlength="200" placeholder="예: PX4, ROS2, OpenCV"')}${field('source_url','코드·관련 자료 주소',p?.source_url,'type="url" pattern="https://.*" maxlength="1500"')}${select('media_kind','영상 방식',[['youtube','유튜브 링크'],['video','동영상 파일']],p?.media_kind||'youtube')}${field('youtube_url','유튜브 영상 주소',p?.youtube_id?'https://www.youtube.com/watch?v='+p.youtube_id:'','type="url"')}<label>영상 파일<input type="file" name="video" accept="video/mp4,video/webm,.mp4,.webm"></label><p class="small muted">파일은 50MB 이하. 기존 파일을 유지하려면 새 파일을 선택하지 마세요.</p>${field('sort_order','표시 순서',p?.sort_order??0,'type="number" required min="-10000" max="10000"')}${check('published','홈페이지에 공개',p?.published??false)}<p id="project-progress" role="status"></p>`,async d=>{
  const kind=d.get('media_kind');let path=null,poster_path=null,youtube_id=null;
  if(kind==='youtube'){youtube_id=youtubeId(d.get('youtube_url'));if(!youtube_id)fail('올바른 유튜브 영상 주소를 입력해 주세요.');}
  else {
   const file=d.get('video');
   if(file?.size){
    const status=text=>{message(text);document.getElementById('project-progress').textContent=text;};
    status('동영상 재생 여부를 확인하고 있습니다…');let prepared;try{prepared=await prepareVideo(file);}catch(e){fail(e.message);}
    path=`video/${crypto.randomUUID()}.${prepared.ext}`;status('영상을 업로드하고 있습니다. 창을 열어 두세요.');
    await result(client.storage.from('sjarc-videos').upload(path,file,{contentType:prepared.mime,cacheControl:'31536000',upsert:false}));
    if(prepared.poster){poster_path=`gallery/${crypto.randomUUID()}.webp`;await result(client.storage.from('sjarc-media').upload(poster_path,prepared.poster,{contentType:'image/webp',upsert:false}));}
   }else if(p?.media_kind==='video'){path=p.path;poster_path=p.poster_path;}else fail('등록할 동영상 파일을 선택해 주세요.');
  }
  const title=d.get('title').trim();if(!title)fail('제목을 입력해 주세요.');
  await saveRecord('club_projects',{title,description:d.get('description').trim(),technologies:d.get('technologies').trim(),source_url:d.get('source_url').trim(),media_kind:kind,path,poster_path,youtube_id,sort_order:Number(d.get('sort_order')),published:d.has('published')},p);
  await onSaved('프로젝트를 저장했습니다.');
 });
 const form=document.getElementById('dialog-form');const toggle=()=>{const video=form.elements.media_kind.value==='video';form.elements.video.closest('label').hidden=!video;form.elements.youtube_url.closest('label').hidden=video;form.elements.youtube_url.required=!video;form.elements.youtube_url.disabled=video;form.elements.video.disabled=!video;};
 form.elements.media_kind.addEventListener('change',toggle);toggle();
}
