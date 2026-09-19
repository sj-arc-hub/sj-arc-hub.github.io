import {copyFields,normalizeCopy,createCopyApi,copyError} from './site-copy.js';
const el=id=>document.getElementById(id);
let api,client,site,saved,dirty=false,busy=false,accountId=null,authVersion=0;
const inputs=new Map();
const setStatus=(text,error=false)=>{el('editor-status').textContent=text;el('editor-status').classList.toggle('error',error);};
function formValues(){return Object.fromEntries([...inputs].map(([key,input])=>[key,input.value]));}
function updateControls(){el('copy-save').disabled=busy||!dirty||!saved;el('copy-reload').disabled=busy;for(const input of inputs.values())input.disabled=busy;el('edit-state').textContent=busy?'저장하고 있습니다…':dirty?'저장하지 않은 변경 내용':'저장된 문구';}
function preview(){el('copy-preview').contentWindow?.postMessage({type:'sjarc-copy-preview',content:formValues()},location.origin);}
function sizePreview(){const stage=el('preview-stage');const width=document.querySelector('.copy-preview').dataset.width==='mobile'?390:1280;const scale=Math.min(1,stage.clientWidth/width);const height=window.innerWidth<=1050?440:680;const frame=el('copy-preview');frame.style.width=width+'px';frame.style.height=height/scale+'px';frame.style.transform=`scale(${scale})`;stage.style.height=height+'px';}
function fill(content){for(const [key,input] of inputs){input.value=content[key];document.getElementById(input.id+'-count').textContent=`${[...input.value].length} / ${input.maxLength}`;}dirty=false;updateControls();preview();}
function renderFields(){
  const groups=[...new Set(copyFields.map(f=>f.group))];
  for(const [index,group] of groups.entries()){
    const details=document.createElement('details');details.className='copy-fields-section';details.open=index===0;
    const summary=document.createElement('summary');summary.textContent=group;details.append(summary);
    for(const field of copyFields.filter(f=>f.group===group)){
      const label=document.createElement('label');label.textContent=field.label;
      const input=document.createElement(field.type==='url'?'input':'textarea');input.id='copy-'+field.key.replaceAll('.','-');input.name=field.key;input.maxLength=field.max;input.required=true;
      if(field.type==='url'){input.type='url';input.pattern='https://.*';input.spellcheck=false;}else input.rows=field.max<=100?2:3;
      const hint=document.createElement('span');hint.className='field-hint';const help=document.createElement('span');help.textContent=field.type==='url'?'https:// 주소를 입력하세요.':'줄바꿈을 그대로 표시합니다.';const count=document.createElement('span');count.id=input.id+'-count';hint.append(help,count);input.setAttribute('aria-describedby',count.id);label.append(input,hint);details.append(label);inputs.set(field.key,input);
    }
    el('copy-fields').append(details);
  }
}
async function reload(){
  const version=authVersion;
  busy=true;updateControls();
  try{const value=await api.read();if(version!==authVersion)return;saved=value;fill(value.content);el('copy-updated').textContent='최근 저장: '+new Date(value.updated_at).toLocaleString('ko-KR');setStatus('내용을 수정하면 오른쪽 미리보기에 표시됩니다.');}
  catch(error){if(version===authVersion)setStatus(copyError(error),true);}
  finally{if(version===authVersion){busy=false;updateControls();}}
}
async function authorize(){
  const version=++authVersion;
  el('editor-workspace').hidden=true;el('editor-locked').hidden=true;saved=null;dirty=false;busy=false;updateControls();
  try{
    const {data:{session},error}=await client.auth.getSession();if(error)throw error;
    const profile=session?await site.profile(session.user.id):null;
    if(version!==authVersion)return;
    accountId=session?.user.id||null;
    if(profile?.role!=='admin'){el('editor-locked').hidden=false;setStatus('운영진 계정에서 홈페이지 문구를 편집할 수 있습니다.');return;}
    el('editor-workspace').hidden=false;
    if(!el('copy-preview').getAttribute('src'))el('copy-preview').src='./SJ-ARC-Home.dc.html?copy-preview=1';
    await reload();
  }catch{if(version===authVersion){el('editor-locked').hidden=false;setStatus('로그인 권한을 확인하지 못했습니다. 내 계정 화면에서 다시 로그인해 주세요.',true);}}
}
renderFields();
el('copy-form').addEventListener('input',event=>{
  dirty=true;const input=event.target;const count=el(input.id+'-count');if(count)count.textContent=`${[...input.value].length} / ${input.maxLength}`;
  updateControls();preview();
});
// A collapsed invalid field must become visible before native validation tries to focus it.
el('copy-form').addEventListener('invalid',event=>{event.target.closest('details').open=true;},true);
el('copy-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!dirty||!saved)return;
  const version=authVersion;
  let content;try{content=normalizeCopy(formValues(),{strict:true});}catch(error){setStatus(error.message,true);return;}
  busy=true;updateControls();setStatus('변경 내용을 저장하고 있습니다.');
  try{const value=await api.publish(content,Number(saved.revision));if(version!==authVersion)return;saved=value;fill(saved.content);el('copy-updated').textContent='최근 저장: '+new Date(saved.updated_at).toLocaleString('ko-KR');setStatus('저장했습니다. 홈페이지를 새로 열면 변경된 문구가 표시됩니다.');}
  catch(error){if(version===authVersion)setStatus(copyError(error),true);}
  finally{if(version===authVersion){busy=false;updateControls();}}
});
el('copy-reload').addEventListener('click',()=>{if(!dirty||confirm('저장하지 않은 변경 내용을 버리고 공개된 문구를 다시 불러올까요?'))reload();});
for(const button of document.querySelectorAll('[data-preview-width]'))button.addEventListener('click',()=>{document.querySelector('.copy-preview').dataset.width=button.dataset.previewWidth;for(const other of document.querySelectorAll('[data-preview-width]'))other.setAttribute('aria-pressed',String(other===button));sizePreview();});
new ResizeObserver(()=>{if(el('preview-stage').clientWidth)sizePreview();}).observe(el('preview-stage'));
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===el('copy-preview').contentWindow&&event.data?.type==='sjarc-copy-ready')preview();});
window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
try{
  ({client,site}=await import('./supabase-client.js'));api=createCopyApi(client);
  client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(event==='SIGNED_IN'&&session?.user.id!==accountId))setTimeout(authorize,0);});
  await authorize();
}catch{setStatus('편집기를 불러오지 못했습니다. 새로고침해 주세요.',true);}
