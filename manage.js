import {mediaView} from './gallery-view.js';
import {youtubeId} from './gallery-media.js';
import {prepareVideo} from './video-upload.js';
import {client,esc,result,rpc,auth,nav,message,errorText,photoUrl,options,field,area,select,check,empty,albumCategories,statuses,levelLabel,task,modal,uploadPhoto,saveRecord,today,fail} from './community-core.js';
const view=document.getElementById('view'),params=new URLSearchParams(location.search),section=params.get('section')||'team';
let account={},people=[],members=[],accounts=[],albums=[],photos=[],requests=[],posts=[];
const tabs=[['team','운영진 소개'],['members','명단·레벨'],['accounts','회원 승인'],['gallery','갤러리'],['reviews','승급 심사'],['posts','게시글 관리']];
const toolbar=(text,action,label='추가')=>`<div class="heading"><div><h2>${text}</h2></div><button class="primary" data-action="${action}">${esc(label)}</button></div>`;
const table=(heads,rows)=>rows.length?`<div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:empty('등록된 항목이 없습니다.');
const editButton=(action,id,label='수정')=>`<button data-action="${action}" data-id="${id}">${label}</button>`;
function frame(body) {
  view.innerHTML=`<div class="heading"><div><h1>홈페이지 콘텐츠 관리</h1><p>내용을 저장하면 홈페이지에 반영됩니다.</p></div><a href="./admin.html">대표 사진·내 계정</a></div><nav class="tabs" aria-label="관리 메뉴">${tabs.map(([key,label])=>`<a href="?section=${key}" ${section===key?'aria-current="page"':''}>${label}</a>`).join('')}</nav>${body}`;
}
async function load() {
  if(section==='team') {
    people=await result(client.from('team_people').select('*').order('sort_order').order('name'));
    frame(toolbar('운영진 & 지도교수','person')+table(['이름','구분·직함','공개','관리'],people.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.kind==='advisor'?'지도교수':'운영진')} · ${esc(p.title)}</td><td>${p.active?'공개':'숨김'}</td><td>${editButton('person',p.id)}</td></tr>`)));
  } else if(section==='members') {
    [members,accounts]=await Promise.all([result(client.from('club_members').select('*').order('name')),rpc('cm_accounts',{})]);
    frame(toolbar('회원 명단·레벨','member','회원 직접 등록')+`<p class="small muted">이름·트랙·레벨·점수·최근 승급일은 공개됩니다. 내부 메모와 Google 계정은 방문자에게 공개하지 않습니다.</p><p>‘회원 직접 등록’에서 이름, 운영/개발, 레벨, 근거를 입력하세요.</p><details><summary>일괄 등록·이전 기록</summary><div class="actions"><button data-action="import-members">명단 일괄 등록</button><button data-action="legacy-backup">이 브라우저의 이전 기록 내려받기</button></div></details>`+
      table(['이름','운영/개발·레벨','근거','계정 연결','활동','관리'],members.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.track)}<br>${esc(levelLabel(m.track,m.level))}</td><td style="min-width:180px;max-width:320px;white-space:pre-wrap;overflow-wrap:anywhere">${esc(m.note||'—')}</td><td>${m.user_id?'연결됨':'미연결'}</td><td>${m.active?'활동 중':'비활동'}</td><td><div class="actions">${editButton('member',m.id)}${editButton('history',m.id,'변경 이력')}</div></td></tr>`)));
  } else if(section==='accounts') {
    [members,accounts]=await Promise.all([result(client.from('club_members').select('*').order('name')),rpc('cm_accounts',{})]);
    frame(`<h2>Google 로그인 계정 승인</h2><p>회원이 한 번 로그인하면 여기에 표시됩니다. 명단과 연결한 뒤 동아리원으로 승인하세요.</p>`+table(['계정','이름','현재 권한','관리'],accounts.map(a=>`<tr><td>${esc(a.email)}</td><td>${esc(a.display_name)}</td><td>${esc({pending:'승인 대기',member:'동아리원',admin:'운영진'}[a.role])}</td><td>${a.id===account.user.id?'내 운영진 계정':editButton('account',a.id,'승인·권한 변경')}</td></tr>`)));
  } else if(section==='gallery') {
    albums=await result(client.from('albums').select('*').order('event_date',{ascending:false}));
    const album=albums.find(a=>a.id===params.get('album'));
    if(album) {
      photos=await result(client.from('album_photos').select('*').eq('album_id',album.id).order('sort_order').order('updated_at'));
      frame(`<a href="?section=gallery">← 앨범 목록</a><div class="heading"><div><h2>${esc(album.title)}</h2><p>${album.published?'공개 앨범':'숨긴 앨범'}</p></div><div class="actions"><button class="primary" data-action="add-photos" data-id="${album.id}">사진 추가</button><button data-action="add-video" data-id="${album.id}">동영상 업로드</button><button data-action="add-youtube" data-id="${album.id}">유튜브 영상 추가</button></div></div>`+
        (photos.length?`<div class="grid">${photos.map(p=>`<article class="card">${mediaView(p)}<div class="card-body"><p>${esc(p.caption)}</p><p class="small muted">${esc({image:'사진',video:'동영상',youtube:'YouTube'}[p.media_kind||'image'])} · 순서 ${p.sort_order} · ${p.active?'공개':'숨김'}</p>${editButton('photo',p.id,'설명·순서·공개 수정')}</div></article>`).join('')}</div>`:empty('사진이나 동영상을 추가해 주세요.')));
    } else frame(toolbar('활동 앨범','album')+table(['앨범','활동일','분류','공개','관리'],albums.map(a=>`<tr><td>${esc(a.title)}</td><td>${esc(a.event_date)}</td><td>${esc(a.category)}</td><td>${a.published?'공개':'숨김'}</td><td><div class="actions">${editButton('album',a.id)}<a href="?section=gallery&album=${a.id}">사진·영상 관리</a></div></td></tr>`)));

  } else if(section==='reviews') {
    requests=await result(client.from('promotion_requests').select('*,community_posts(title,author_name)').order('submitted_at',{ascending:false,nullsFirst:false}));
    frame(`<h2>승급 신청·심사 이력</h2><p>심사 대기 자료를 열어 근거를 확인한 뒤 승인 또는 보완 요청을 남깁니다. 본인의 신청은 다른 운영진이 심사합니다.</p>`+
      table(['신청자·자료','목표 레벨','상태','신청일','확인'],requests.filter(r=>r.status!=='draft').map(r=>`<tr><td>${esc(r.community_posts?.author_name)}<br>${esc(r.community_posts?.title)}</td><td>${esc(r.track)} · LV${r.from_level} → LV${r.target_level}</td><td><span class="tag">${esc(statuses[r.status])}</span></td><td>${esc(r.submitted_at?.slice(0,10))}</td><td><a href="./SJ-ARC-Board.dc.html?id=${r.post_id}">자료·심사 열기</a></td></tr>`)));
  } else if(section==='posts') {
    posts=await result(client.from('community_posts').select('id,title,author_name,category,state,created_at').order('created_at',{ascending:false}).limit(500));
    frame(`<h2>게시글 관리</h2><p>작성 중·공개·보관된 글을 확인합니다. 글을 열어 수정·보관하거나 상단 고정을 설정할 수 있습니다.</p><p><a href="./SJ-ARC-Board.dc.html">게시판에서 새 글 작성 →</a></p>`+
      table(['제목','분류','작성자','상태','관리'],posts.map(p=>`<tr><td>${esc(p.title)}</td><td>${esc(p.category)}</td><td>${esc(p.author_name)}</td><td>${esc(statuses[p.state])}</td><td><a href="./SJ-ARC-Board.dc.html?id=${p.id}">열기</a></td></tr>`)));
  } else fail('올바른 관리 메뉴를 선택해 주세요.');
}
async function saved(text='저장했습니다.') {await load();message(text);}
function personForm(id) {
  const p=people.find(x=>x.id===id);
  modal(p?'소개 수정':'소개 추가',`<div class="form-grid">${field('name','이름',p?.name,'required maxlength="80"')}${select('kind','구분',[['staff','운영진'],['advisor','지도교수']],p?.kind||'staff')}${field('title','직함',p?.title,'maxlength="80"')}${field('department','학과·소속',p?.department,'maxlength="160"')}<div class="wide">${area('bio','소개',p?.bio,'maxlength="2000"')}</div>${field('email','공개 이메일',p?.contact_email,'type="email" maxlength="254"')}${field('website','학과·연구실 주소',p?.website,'type="url"')}${field('github','GitHub 주소',p?.github,'type="url"')}${field('sort_order','표시 순서',p?.sort_order||0,'type="number" required')}<div class="wide"><label>사진<input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/avif"></label>${check('remove_photo','기존 사진 비우기',false)}${check('active','홈페이지에 공개',p?.active??true)}</div></div>`,async d=>{
    let path=d.has('remove_photo')?null:p?.photo_path||null;
    const file=d.get('photo');if(file?.size)path=await uploadPhoto(file,'team');
    await saveRecord('team_people',{name:d.get('name').trim(),kind:d.get('kind'),title:d.get('title').trim(),department:d.get('department').trim(),bio:d.get('bio'),contact_email:d.get('email').trim(),website:d.get('website').trim(),github:d.get('github').trim(),sort_order:Number(d.get('sort_order')),active:d.has('active'),photo_path:path},p);await saved();
  });
}
function memberForm(id) {
  const m=members.find(x=>x.id===id);
  const selectable=accounts.filter(a=>!members.some(x=>x.user_id===a.id&&x.id!==m?.id));
  const levelOptions=track=>Array.from({length:track==='운영'?3:4},(_,i)=>[i+1,levelLabel(track,i+1)]);
  const track=m?.track||'운영';
  modal(m?'회원 정보 수정':'회원 직접 등록',`
    <div class="form-grid">
      <div class="wide">${field('name','이름',m?.name,'required maxlength="80" placeholder="이름 입력"')}</div>
      ${select('track','운영 / 개발',['운영','개발'],track)}
      ${select('level','레벨',levelOptions(track),m?.level||1)}
      <div class="wide">${area('note','근거',m?.note,'required minlength="2" maxlength="2000" placeholder="예: 신규 가입 / 비행 실습 완료 / 세미나 발표 및 자료 링크"')}</div>
    </div>
    <p class="small muted">근거에는 활동 내용이나 자료 링크를 적어 주세요. 이 입력은 명단 기록용이며, 승급자료 제출·심사는 게시판에서 별도로 진행합니다.</p>
    <details><summary>추가 설정 · 점수, 계정 연결, 활동 상태</summary>
      <div class="form-grid" style="margin-top:18px">
        ${field('score','누적 점수',m?.score||0,'type="number" required min="0" max="1000000"')}
        ${field('promoted_on','최근 승급일',m?.promoted_on,'type="date"')}
        <div class="wide">${select('user_id','Google 계정 연결',[['','미연결'],...selectable.map(a=>[a.id,a.email])],m?.user_id||'')}${check('active','활동 중인 회원 (레벨 현황에 공개)',m?.active??true)}</div>
      </div>
    </details>`,async d=>{
    const evidence=d.get('note').trim();
    if(evidence.length<2)fail('근거를 2자 이상 입력해 주세요.');
    await saveRecord('club_members',{
      name:d.get('name').trim(),track:d.get('track'),level:Number(d.get('level')),
      score:Number(d.get('score')),promoted_on:d.get('promoted_on')||null,user_id:d.get('user_id')||null,
      note:evidence,change_reason:((m?'명단 수정: ':'수동 등록: ')+evidence).slice(0,500),active:d.has('active')
    },m);await saved(m?'회원 정보를 수정했습니다.':'회원을 등록했습니다.');
  });
  const form=document.getElementById('dialog-form');
  form.elements.track.addEventListener('change',()=>{
    const chosenTrack=form.elements.track.value;
    const chosenLevel=Math.min(Number(form.elements.level.value),chosenTrack==='운영'?3:4);
    form.elements.level.innerHTML=options(levelOptions(chosenTrack),chosenLevel);
  });
}

function accountForm(id) {
  const a=accounts.find(x=>x.id===id),linked=members.find(m=>m.user_id===id);
  modal('회원 승인·권한 변경',`<p>${esc(a.email)}</p>${select('role','권한',[['member','동아리원 승인'],['admin','운영진 지정'],['pending','승인 대기로 변경']],a.role==='admin'?'admin':'member')}${select('member','연결할 회원 명단',[['','선택해 주세요'],...members.filter(m=>m.active&&(!m.user_id||m.user_id===id)).map(m=>[m.id,`${m.name} · ${m.track}`])],linked?.id||'')}<p class="small muted">명단에 없다면 먼저 ‘명단·레벨’에서 등록하세요. 운영진으로 지정하면 전체 콘텐츠·회원 권한·승급 심사를 관리할 수 있습니다.</p>`,async d=>{
    if(d.get('role')==='admin'&&!confirm(`${a.email} 계정에 전체 홈페이지 관리와 승급 심사 권한을 부여하시겠습니까?`))fail('운영진 지정을 취소했습니다.');
    await rpc('cm_manage_account',{p_user:id,p_role:d.get('role'),p_member:d.get('member')||null,p_expected_role:a.role});await saved('회원 권한을 반영했습니다. 해당 회원은 페이지를 새로고침하면 됩니다.');
  });
}
function albumForm(id) {
  const a=albums.find(x=>x.id===id);
  modal(a?'앨범 수정':'앨범 만들기',field('title','앨범 이름',a?.title,'required maxlength="150"')+field('event_date','활동일',a?.event_date||today(),'required type="date"')+select('category','분류',albumCategories,a?.category||'정기모임')+area('description','활동 설명',a?.description,'maxlength="3000"')+check('published','홈페이지에 공개',a?.published??true),async d=>{
    await saveRecord('albums',{title:d.get('title').trim(),event_date:d.get('event_date'),category:d.get('category'),description:d.get('description'),published:d.has('published')},a);await saved();
  });
}
view.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||!account.admin)return;
  const {action,id}=button.dataset;
  if(action==='person')return personForm(id);
  if(action==='member')return memberForm(id);
  if(action==='account')return accountForm(id);
  if(action==='album')return albumForm(id);
  if(action==='photo') {
    const p=photos.find(x=>x.id===id);
    modal('사진·영상 설명·표시 순서',field('caption','설명',p.caption,'required maxlength="180"')+field('sort_order','표시 순서',p.sort_order,'type="number" required')+check('active','앨범에 표시',p.active),async d=>{await saveRecord('album_photos',{caption:d.get('caption').trim(),sort_order:Number(d.get('sort_order')),active:d.has('active')},p);await saved();});return;
  }
  if(action==='add-video') {
    const a=albums.find(x=>x.id===id);
    modal('동영상 업로드',`<label>동영상 선택<input type="file" name="video" required accept="video/mp4,video/webm,.mp4,.webm"></label>${field('caption','영상 설명',a.title,'required maxlength="180"')}<p class="small muted">MP4(H.264) · WebM, 파일당 50MB 이하. 영상은 원본 그대로 저장합니다. 큰 영상은 유튜브 링크로 추가해 주세요.</p><p id="video-progress" role="status" aria-live="polite"></p>`,async d=>{
      await requireVideoSchema();
      const progress=text=>{message(text);document.getElementById('video-progress').textContent=text;};
      progress('재생 가능 여부와 미리보기를 확인하고 있습니다…');
      const file=d.get('video');let prepared;
      try{prepared=await prepareVideo(file);}catch(e){fail(e.message);}
      const path=`video/${crypto.randomUUID()}.${prepared.ext}`;
      progress('동영상을 업로드하고 있습니다. 업로드가 끝날 때까지 창을 열어 두세요.');
      await result(client.storage.from('sjarc-videos').upload(path,file,{contentType:prepared.mime,cacheControl:'31536000',upsert:false}));
      let posterPath=null;
      if(prepared.poster){posterPath=`gallery/${crypto.randomUUID()}.webp`;await result(client.storage.from('sjarc-media').upload(posterPath,prepared.poster,{contentType:'image/webp',cacheControl:'31536000',upsert:false}));}
      progress('앨범에 동영상을 연결하고 있습니다…');
      await saveRecord('album_photos',{album_id:id,media_kind:'video',path,poster_path:posterPath,caption:d.get('caption').trim(),sort_order:Math.max(-1,...photos.map(p=>p.sort_order))+1,active:true});
      await saved('동영상을 등록했습니다. 앨범 안에서 재생할 수 있습니다.');
    });return;
  }
  if(action==='add-youtube') {
    const a=albums.find(x=>x.id===id);
    modal('유튜브 영상 추가',field('url','YouTube 영상 주소','','required type="url" placeholder="https://www.youtube.com/watch?v=..."')+field('caption','영상 설명',a.title,'required maxlength="180"')+'<p class="small muted">일반 영상·공유 링크·Shorts·라이브 주소를 지원합니다. 비공개 영상이나 외부 재생을 막은 영상은 재생되지 않을 수 있습니다.</p>',async d=>{
      const videoId=youtubeId(d.get('url'));if(!videoId)fail('올바른 YouTube 영상 링크를 입력해 주세요.');
      await requireVideoSchema();
      await saveRecord('album_photos',{album_id:id,media_kind:'youtube',path:null,youtube_id:videoId,caption:d.get('caption').trim(),sort_order:Math.max(-1,...photos.map(p=>p.sort_order))+1,active:true});
      await saved('유튜브 영상을 등록했습니다. 앨범에서 플레이어를 열어 재생할 수 있습니다.');
    });return;
  }

  if(action==='add-photos') {
    const a=albums.find(x=>x.id===id);
    modal('앨범 사진 추가',`<label>사진 선택<input type="file" name="photos" multiple required accept="image/jpeg,image/png,image/webp,image/avif"></label>${field('caption','공통 사진 설명',a.title,'required maxlength="160"')}<p class="small muted">한 번에 최대 20장, 원본은 장당 15MB 이하입니다. 자동 압축 후 업로드합니다. 사진별 설명은 등록 후 수정할 수 있습니다.</p>`,async d=>{
      const picked=d.getAll('photos').filter(f=>f.size);if(!picked.length||picked.length>20)fail('사진을 1~20장 선택해 주세요.');
      let done=0;const start=Math.max(-1,...photos.map(p=>p.sort_order))+1;
      try {for(const file of picked){message(`사진 업로드 ${done+1} / ${picked.length}`);const path=await uploadPhoto(file,'gallery');await saveRecord('album_photos',{album_id:id,path,caption:`${d.get('caption').trim()}${picked.length>1?' · '+(done+1):''}`,sort_order:start+done,active:true});done++;}}
      catch(e){await load();fail(`${done}장은 저장됐습니다. 나머지 사진만 다시 선택해 주세요. ${errorText(e)}`);}
      await saved(`${done}장의 사진을 등록했습니다.`);
    });return;
  }
  if(action==='history')return task(async()=>{
    const events=await result(client.from('member_events').select('*').eq('member_id',id).order('created_at',{ascending:false}).limit(100));
    const dialog=document.getElementById('dialog');dialog.innerHTML=`<div class="dialog-head"><h2>회원 변경 이력</h2><button id="close-history">닫기</button></div>${events.map(e=>`<div class="history"><strong>${esc(e.reason)}</strong><p>${esc(e.created_at.slice(0,19).replace('T',' '))}</p><p>${e.before_value?`${esc(e.before_value.track)} LV${e.before_value.level} · ${e.before_value.score}점 → `:'신규 등록 → '}${esc(e.after_value.track)} LV${e.after_value.level} · ${e.after_value.score}점</p></div>`).join('')}`;dialog.querySelector('button').onclick=()=>dialog.close();dialog.showModal();message('변경 이력을 불러왔습니다.');
  });
  if(action==='legacy-backup') {
    const data={};for(const key of ['sjarc.students.v1','sjarc.albums.v1','sjarc.posts.v1']){try{data[key]=JSON.parse(localStorage.getItem(key)||'null');}catch{data[key]=localStorage.getItem(key);}}
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sjarc-previous-browser-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);message('이 브라우저에 남아 있는 이전 기록을 내려받았습니다. 기존 기록은 삭제하지 않았습니다.');return;
  }
  if(action==='import-members') {
    modal('명단 일괄 등록',`<p>엑셀에서 아래 순서로 열을 복사해 붙여넣으세요. 첫 줄부터 회원 데이터만 넣습니다.</p><p class="small">이름 / 트랙(운영·개발) / 레벨 / 점수</p>${area('rows','회원 명단','','required placeholder="홍길동\t운영\t1\t0"')}<p class="small muted">최대 200명. 중복 이름·트랙이나 잘못된 값이 있으면 전체 등록을 멈춥니다. 계정 연결은 등록 후 진행합니다.</p>`,async d=>{
      const rows=d.get('rows').trim().split(/\r?\n/).filter(Boolean).map(line=>{const [name,track,level,score,...extra]=line.split('\t');if(extra.length)fail('열은 이름·트랙·레벨·점수 4개만 넣어 주세요.');return {name:name?.trim(),track:track?.trim(),level:Number(level),score:Number(score||0)};});
      await rpc('cm_import_members',{p_rows:rows});await saved(`${rows.length}명을 등록했습니다.`);
    });
  }
});
try {account=await auth();nav('manage',account);if(!account.admin){view.innerHTML=empty('운영진 계정으로 로그인해 주세요.')+'<p><a class="primary" href="./admin.html">로그인·권한 확인</a></p>';message('');}else{await load();message('');}}
catch(e){nav('manage',account);message(errorText(e),true);}

async function requireVideoSchema(){const {error}=await client.from('album_photos').select('media_kind').limit(0);if(error){if(['42703','PGRST204'].includes(error.code))fail('동영상 기능의 서버 설정이 필요합니다. Supabase에서 004-gallery-video.sql을 실행한 뒤 다시 시도해 주세요.');throw error;}}
