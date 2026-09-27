import {client,auth,nav,message,errorText,esc,result,empty,external} from './community-core.js?v=20260927b';
import {mediaView} from './gallery-view.js?v=20260927b';
import {loadVisits,canCountVisit} from './site-visits.js';
const view=document.getElementById('view');let account={};
try {
 account=await auth();nav('projects',account);
 const projects=await result(client.from('club_projects').select('*').eq('published',true).order('sort_order').order('updated_at',{ascending:false}));
 view.innerHTML=`<div class="heading"><div><h1>프로젝트 결과물</h1><p>직접 만들고 시험한 과정을 영상과 자료로 공유합니다.</p></div>${account.admin?'<a class="primary" href="./manage.html?section=projects">결과물 관리</a>':''}</div>`+
 (projects.length?`<div class="grid project-grid">${projects.map(p=>`<article class="card" id="project-${esc(p.id)}">${mediaView({...p,caption:p.title})}<div class="card-body"><h2>${esc(p.title)}</h2><p class="body-text">${esc(p.description)}</p>${p.technologies?`<p class="small muted">${esc(p.technologies)}</p>`:''}${external(p.source_url,'코드·관련 자료 ↗')}</div></article>`).join('')}</div>`:empty('프로젝트 결과물을 준비하고 있습니다. 등록된 시연 영상과 자료를 이곳에서 만나보세요.'));
 message('');
}catch(e){nav('projects',account);message(['42P01','PGRST205'].includes(e.code)?'프로젝트 결과물 공간을 준비하고 있습니다.':errorText(e),true);}
if(canCountVisit(location))loadVisits(client).catch(()=>{});
