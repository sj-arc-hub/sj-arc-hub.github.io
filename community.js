import {mediaView} from './gallery-view.js';
import {client,esc,result,rpc,auth,nav,message,errorText,photoUrl,external,options,field,area,select,empty,categories,albumCategories,statuses,levelLabel,task,modal,attachFile,downloadFile,fail} from './community-core.js';
const page=document.body.dataset.page, view=document.getElementById('view'), params=new URLSearchParams(location.search);
let account={},post=null,files=[],request=null,reviews=[];
const id=params.get('id');
const heading=(title,description,action='')=>`<div class="heading"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action}</div>`;
const manager=section=>account.admin?`<a class="primary" href="./manage.html?section=${section}">관리하기</a>`:'';
function pager(count,size=24) {
  const current=Math.max(0,Number(params.get('page'))||0), link=n=>{const p=new URLSearchParams(params);p.set('page',n);return '?'+p;};
  return count>size?`<nav class="pagination" aria-label="페이지">${current?`<a href="${esc(link(current-1))}">이전</a>`:''}<span>${current+1} / ${Math.ceil(count/size)}</span>${(current+1)*size<count?`<a href="${esc(link(current+1))}">다음</a>`:''}</nav>`:'';
}
async function team() {
  const people=await result(client.from('team_people').select('*').eq('active',true).order('sort_order').order('name'));
  const cards=list=>list.length?`<div class="grid">${list.map(p=>`<article class="card">${p.photo_path?`<img class="person-photo" src="${esc(photoUrl(p.photo_path))}" alt="${esc(p.name)}" loading="lazy">`:'<div class="no-photo person-blank" aria-label="사진 미등록"></div>'}<div class="card-body"><span class="tag">${esc(p.title|| (p.kind==='advisor'?'지도교수':'운영진'))}</span><h2>${esc(p.name)}</h2><p>${esc(p.department)}</p><p class="body-text">${esc(p.bio)}</p><div class="actions">${external(p.website,'학과·연구실')}${external(p.github,'GitHub')}${p.contact_email?`<a href="mailto:${esc(p.contact_email)}">이메일</a>`:''}</div></div></article>`).join('')}</div>`:empty('등록된 소개가 없습니다.');
  view.innerHTML=heading('운영진 & 지도교수','함께 만들고, 비행하고, 배우는 사람들',manager('team'))+`<div class="section-label">ADVISOR · 지도교수</div>${cards(people.filter(x=>x.kind==='advisor'))}<div class="section-label">STAFF · 운영진</div>${cards(people.filter(x=>x.kind==='staff'))}`;
}
async function directory() {
  const track=params.get('track')||'',q=params.get('q')||'',offset=Math.max(0,Number(params.get('page'))||0)*50;
  let query=client.from('member_directory').select('*',{count:'exact'}).order('level',{ascending:false}).order('name').range(offset,offset+49);
  if(track)query=query.eq('track',track);if(q)query=query.ilike('name',`%${q}%`);
  const {data,error,count}=await query;if(error)throw error;
  view.innerHTML=heading('레벨 현황','활동을 기록하고, 근거자료로 다음 단계에 도전합니다.',manager('members'))+
    `<form class="toolbar" method="get">${field('q','이름 검색',q,'type="search" maxlength="80"')}${select('track','트랙',[['','전체'],'운영','개발'],track)}<button type="submit">검색</button></form><div class="numbers"><span><strong>${count}</strong>명</span></div>`+
    (data.length?`<div class="table-wrap"><table><thead><tr><th>이름</th><th>트랙</th><th>현재 레벨</th><th>누적 점수</th><th>최근 승급</th></tr></thead><tbody>${data.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.track)}</td><td><span class="tag">${esc(levelLabel(m.track,m.level))}</span></td><td>${m.score}</td><td>${esc(m.promoted_on||'—')}</td></tr>`).join('')}</tbody></table></div>`:empty('조건에 맞는 회원이 없습니다.'))+pager(count,50)+
    `<section class="panel"><h2>승급자료 제출</h2><p>세미나 발표, 문서화한 자료, 유튜브 영상 등을 근거로 제출합니다. 운영진의 승인 후 레벨 현황에 반영됩니다.</p><a class="primary" href="./SJ-ARC-Board.dc.html?category=${encodeURIComponent('승급자료')}">승급자료 게시판</a></section>`;
}
async function gallery() {
  if(id) {
    const album=await result(client.from('albums').select('*').eq('id',id).eq('published',true).single());
    const photos=await result(client.from('album_photos').select('*').eq('album_id',id).eq('active',true).order('sort_order').order('updated_at'));
    view.innerHTML=`<a href="./SJ-ARC-Gallery.dc.html">← 앨범 목록</a>`+heading(album.title,`${album.event_date} · ${album.category}`,manager('gallery'))+
      `<p class="body-text">${esc(album.description)}</p>`+(photos.length?`<div class="grid">${photos.map(p=>`<figure class="card">${mediaView(p)}<figcaption class="photo-caption">${esc(p.caption)}</figcaption></figure>`).join('')}</div>`:empty('등록된 사진·동영상이 없습니다.'));
    return;
  }
  const cat=params.get('category')||'',offset=Math.max(0,Number(params.get('page'))||0)*24;
  // '*' keeps existing photo albums readable before the optional video migration is applied.
  let query=client.from('albums').select('*,album_photos(*)',{count:'exact'}).eq('published',true).eq('album_photos.active',true).order('sort_order',{referencedTable:'album_photos'}).limit(1,{referencedTable:'album_photos'}).order('event_date',{ascending:false}).range(offset,offset+23);
  if(cat)query=query.eq('category',cat);
  const {data,error,count}=await query;if(error)throw error;
  view.innerHTML=heading('활동 갤러리','제작부터 비행까지, 사진과 영상으로 함께한 활동을 모았습니다.',manager('gallery'))+
    `<form class="toolbar" method="get">${select('category','활동 분류',[['','전체'],...albumCategories],cat)}<button type="submit">보기</button></form>`+
    (data.length?`<div class="grid">${data.map(a=>`<article class="card"><a href="?id=${a.id}">${a.album_photos?.[0]?mediaView(a.album_photos[0],true):'<div class="no-photo">사진·영상 준비 중</div>'}<div class="card-body"><span class="tag">${esc(a.category)}</span><h2>${esc(a.title)}</h2><p class="small">${esc(a.event_date)}</p><p>${esc(a.description.slice(0,150))}</p></div></a></article>`).join('')}</div>`:empty('공개된 앨범이 없습니다.'))+pager(count);
}

async function board() {
  if(id)return detail();
  const cat=params.get('category')||'',scope=params.get('scope')||'public',q=params.get('q')||'',offset=Math.max(0,Number(params.get('page'))||0)*24;
  let query=client.from('community_posts').select('id,title,category,author_name,state,pinned,created_at',{count:'exact'}).order('pinned',{ascending:false}).order('created_at',{ascending:false}).range(offset,offset+23);
  if(scope==='mine'&&account.user)query=query.eq('author_id',account.user.id).neq('state','archived');
  else if(scope==='archived'&&account.user)query=query.eq('author_id',account.user.id).eq('state','archived');
  else query=query.eq('state','published');
  if(cat)query=query.eq('category',cat);if(q)query=query.ilike('title',`%${q}%`);
  const {data,error,count}=await query;if(error)throw error;
  view.innerHTML=heading('게시판 · 승급자료','활동과 배움을 기록하고 함께 나눕니다.',account.canWrite?'<button class="primary" data-action="new-post">글 작성</button>':'<a class="primary" href="./admin.html">Google 로그인·회원 승인</a>')+
    `<nav class="tabs"><a href="?" ${scope==='public'?'aria-current="page"':''}>공개 게시판</a>${account.user?`<a href="?scope=mine" ${scope==='mine'?'aria-current="page"':''}>내 글·작성 중</a><a href="?scope=archived" ${scope==='archived'?'aria-current="page"':''}>내 보관함</a>`:''}</nav>`+
    `<form class="toolbar" method="get"><input type="hidden" name="scope" value="${esc(scope)}">${select('category','분류',[['','전체'],...categories],cat)}${field('q','제목 검색',q,'type="search" maxlength="150"')}<button type="submit">검색</button></form>`+
    (data.length?`<div class="post-list">${data.map(p=>`<a class="post-row" href="?id=${p.id}"><span class="tag">${esc(p.category)}</span>${p.pinned?'<span class="tag">고정</span>':''}${p.state!=='published'?`<span class="tag">${esc(statuses[p.state])}</span>`:''}<h2>${esc(p.title)}</h2><span class="small muted">${esc(p.author_name)} · ${esc(p.created_at.slice(0,10))}</span></a>`).join('')}</div>`:empty('아직 등록된 글이 없습니다.'))+pager(count);
}
async function detail() {
  post=await result(client.from('community_posts').select('*').eq('id',id).single());
  files=await result(client.from('post_files').select('*').eq('post_id',id).order('created_at'));
  request=null;reviews=[];
  if(post.category==='승급자료') {
    if(account.admin||account.user?.id===post.author_id) {
      request=await result(client.from('promotion_requests').select('*').eq('post_id',id).maybeSingle());
      if(request)reviews=await result(client.from('promotion_reviews').select('*').eq('request_id',request.id).order('created_at'));
    } else request=await result(client.from('promotion_summary').select('*').eq('post_id',id).maybeSingle());
  }
  const owns=account.canWrite&&(account.admin||post.author_id===account.user?.id);
  const locked=['submitted','approved'].includes(request?.status);
  const fileList=files.length?`<div class="file-list">${files.map(f=>`<div><button data-action="file" data-id="${f.id}">${esc(f.filename)} · ${Math.ceil(f.size_bytes/1024)}KB</button>${owns&&post.state==='draft'&&!locked?` <button class="danger" data-action="remove-file" data-id="${f.id}">첨부 해제</button>`:''}</div>`).join('')}</div>`:empty('첨부파일이 없습니다.');
  const requestInfo=request?`<div class="panel"><div class="review-meta"><span class="tag">${esc(statuses[request.status])}</span><span>${esc(request.track)} · LV${request.from_level} → LV${request.target_level}</span><span>${esc(request.evidence_kind)}</span></div>${reviews.map(r=>`<div class="history"><strong>${esc(statuses[r.decision])} · ${esc(r.created_at.slice(0,10))}</strong><p class="body-text">${esc(r.comment)}</p><details><summary>심사 당시 제출 내용</summary><p><strong>${esc(r.snapshot?.post?.title||'')}</strong></p><p class="body-text">${esc(r.snapshot?.post?.body||'')}</p>${external(r.snapshot?.post?.link,'당시 자료 링크')}<p class="small">첨부: ${esc((r.snapshot?.files||[]).map(x=>x.filename).join(', ')||'없음')}</p></details></div>`).join('')}</div>`:'';
  view.innerHTML=`<article class="article"><a href="./SJ-ARC-Board.dc.html">← 게시판</a><div class="state-line"><span class="tag">${esc(post.category)}</span><span class="tag">${esc(statuses[post.state])}</span></div><h1>${esc(post.title)}</h1><p class="small muted">${esc(post.author_name)} · ${esc(post.created_at.slice(0,10))}</p>${requestInfo}`+
    (owns&&post.state==='draft'&&!locked?`<form id="edit-post" class="editor-form">${field('title','제목',post.title,'required maxlength="150"')}${area('body','활동 내용',post.body,'required minlength="10" maxlength="30000"')}${field('link','자료·유튜브 링크',post.link,'type="url" maxlength="2048"')}<button type="submit">본문 저장</button></form><section class="panel"><h2>첨부자료</h2>${fileList}<form id="attach"><label>파일 추가<input type="file" name="file" required accept=".pdf,.docx,.pptx,.xlsx,.txt,.zip,.jpg,.jpeg,.png,.webp"></label><p class="small muted">파일당 최대 25MB, 최대 10개. 영상은 유튜브 링크를 사용하세요.</p><button type="submit">파일 첨부</button></form></section><p class="readonly-note">공개하면 본문·자료 링크·첨부파일을 방문자 누구나 볼 수 있습니다. ${request?'제출 후에는 심사가 끝날 때까지 내용을 수정할 수 없습니다.':''}</p><div class="actions"><button class="primary" data-action="publish">${request?'승급자료 공개·심사 요청':'게시글 공개'}</button><button data-action="archive">작성 취소·보관</button></div>`:
      `<div class="body-text">${esc(post.body)}</div>${post.link?`<p>${external(post.link,'자료·영상 열기 ↗')}</p>`:''}<h2>첨부자료</h2>${fileList}<div class="actions">${owns&&!locked?`<button data-action="unpublish">작성 중으로 돌려 수정</button>${post.state!=='archived'?'<button data-action="archive">보관하기</button>':''}`:''}${account.admin?'<button data-action="pin">상단 고정 전환</button>':''}</div>`)+
    (account.admin&&request?.status==='submitted'?`<section class="panel"><h2>승급 심사</h2><p>자료를 확인한 뒤 승인하면 회원 레벨이 LV${request.target_level}로 변경됩니다.</p><form id="review">${area('comment','심사 의견','','required minlength="2" maxlength="2000"')}${select('decision','심사 결과',[['approved','승급 승인'],['rejected','보완 요청']],'rejected')}<button class="primary" type="submit">심사 결과 저장</button></form></section>`:'')+'</article>';
  view.querySelectorAll('.history details').forEach((item,index)=>{
    const list=document.createElement('div');list.className='file-list';
    for(const savedFile of reviews[index]?.snapshot?.files||[]) {
      const button=document.createElement('button');button.type='button';button.dataset.action='file';button.dataset.id=savedFile.id;
      button.textContent=savedFile.filename;list.append(button);
    }
    if(list.childElementCount)item.querySelector('p.small')?.replaceWith(list);
  });
  const edit=document.getElementById('edit-post');
  if(edit)edit.onsubmit=e=>{e.preventDefault();const d=new FormData(edit);task(async()=>{post=await rpc('cm_edit_draft',{p_id:post.id,p_revision:post.revision,p_title:d.get('title').trim(),p_body:d.get('body'),p_link:d.get('link').trim()});await detail();message('본문을 저장했습니다.');});};
  const attach=document.getElementById('attach');
  if(attach)attach.onsubmit=e=>{e.preventDefault();const file=new FormData(attach).get('file');task(async()=>{post=await attachFile(post,file,account.user.id);await detail();message('첨부했습니다. 공개 버튼을 누르기 전에는 방문자에게 보이지 않습니다.');});};
  const review=document.getElementById('review');
  if(review)review.onsubmit=e=>{e.preventDefault();const d=new FormData(review);if(!confirm(d.get('decision')==='approved'?'근거자료를 확인했고 다음 레벨로 승인하시겠습니까?':'보완 요청 의견을 저장하시겠습니까?'))return;task(async()=>{await rpc('cm_review',{p_request:request.id,p_attempt:request.attempt,p_decision:d.get('decision'),p_comment:d.get('comment').trim()});await detail();message('심사 결과를 저장했습니다.');});};
}
view.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  if(action==='new-post') {
    modal('글 작성',select('category','분류',categories.filter(c=>account.admin||c!=='공지'),params.get('category')||'자료')+field('title','제목','','required maxlength="150"')+area('body','활동 내용','','required minlength="10" maxlength="30000"')+field('link','자료·유튜브 링크','','type="url" maxlength="2048"')+select('kind','승급자료인 경우: 근거 유형',['세미나 발표','자료 문서화','영상 발표'])+`<p class="readonly-note">먼저 작성 중 상태로 저장합니다. 이후 파일을 첨부하고 공개할 수 있습니다. 승급 신청은 회원 명단에 연결된 계정으로 다음 레벨에 한해 가능합니다.</p>`,async d=>{
      const created=await rpc('cm_create_post',{p_category:d.get('category'),p_title:d.get('title').trim(),p_body:d.get('body'),p_link:d.get('link').trim(),p_kind:d.get('kind')});
      // Let the save task finish before navigation so its unload guard is released.
      setTimeout(()=>{location.href=`./SJ-ARC-Board.dc.html?id=${created.id}`;},0);
    });return;
  }
  if(action==='file')return task(async()=>{await downloadFile([...files,...reviews.flatMap(r=>r.snapshot?.files||[])].find(f=>f.id===button.dataset.id));message('다운로드 링크를 열었습니다.');});
  if(action==='remove-file')return task(async()=>{post=await rpc('cm_remove_file',{p_post:post.id,p_revision:post.revision,p_file:button.dataset.id});await detail();message('첨부 연결을 해제했습니다.');});
  if(['publish','archive','unpublish','pin'].includes(action)) {
    if(action==='publish') {
      const edit=document.getElementById('edit-post');
      if(edit){const d=new FormData(edit);if(d.get('title').trim()!==post.title||d.get('body')!==post.body||d.get('link').trim()!==post.link){message('수정한 본문을 먼저 저장해 주세요.',true);return;}}
      if(!confirm('본문과 첨부파일을 모든 방문자에게 공개하시겠습니까?'))return;
    }
    task(async()=>{post=await rpc('cm_post_action',{p_id:post.id,p_revision:post.revision,p_action:action});await detail();message('반영했습니다.');});
  }
});
try { account=await auth();nav(page,account);await ({team,levels:directory,gallery,board}[page])();message(''); }
catch(e){nav(page,account);message(errorText(e),true);view.innerHTML=empty('내용을 불러오지 못했습니다. 설정을 확인한 후 페이지를 새로고침해 주세요.');}
