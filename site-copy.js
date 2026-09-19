import {copyFields} from './site-copy-schema.js';
export {copyFields};
const definitions=new Map(copyFields.map(field=>[field.key,field]));
export const defaultCopy=Object.freeze(Object.fromEntries(copyFields.map(field=>[field.key,field.default])));
export function validCopyValue(field,value){
  if(typeof value!=='string'||!value.trim()||[...value].length>field.max)return false;
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))return false;
  if(field.type==='url'){
    if(!/^https:\/\/[^/?#\s@]+(?:[/?#][^\s]*)?$/.test(value))return false;
    try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!!url.hostname;}catch{return false;}
  }
  return true;
}
export function normalizeCopy(input,{strict=false}={}){
  const values={...defaultCopy};
  if(!input||typeof input!=='object'||Array.isArray(input)){if(strict)throw new Error('문구 형식을 확인해 주세요.');return values;}
  for(const [key,value] of Object.entries(input)){
    const field=definitions.get(key);
    if(!field||!validCopyValue(field,value)){if(strict)throw new Error(field?`${field.label}: ${field.type==='url'?'https://로 시작하는 올바른 주소를 입력해 주세요.':`1~${field.max}자로 입력해 주세요.`}`:'지원하지 않는 문구 항목입니다.');continue;}
    values[key]=value;
  }
  return values;
}
export function applyCopy(root,input){
  const values=normalizeCopy(input);
  for(const element of root.querySelectorAll('[data-copy]')){
    const key=element.dataset.copy;if(definitions.has(key))element.textContent=values[key];
  }
  for(const element of root.querySelectorAll('[data-copy-link]')){
    const key=element.dataset.copyLink;if(definitions.get(key)?.type==='url')element.setAttribute('href',values[key]);
  }
  return values;
}
export function createCopyApi(client){
  return {
    async read(){
      const {data,error}=await client.from('site_copy').select('id,content,revision,updated_at').eq('id',1).single();
      if(error)throw error;
      return {...data,content:normalizeCopy(data.content)};
    },
    async publish(input,revision){
      const content=normalizeCopy(input,{strict:true});
      if(!Number.isSafeInteger(revision)||revision<0)throw new Error('문구를 다시 불러온 후 저장해 주세요.');
      const {data,error}=await client.rpc('publish_site_copy',{p_content:content,p_expected_revision:revision});
      if(error)throw error;
      if(!data||Number(data.revision)!==revision+1)throw new Error('저장 결과를 확인하지 못했습니다. 공개된 문구를 다시 불러와 확인해 주세요.');
      return {...data,content:normalizeCopy(data.content)};
    }
  };
}
export function copyError(error){
  if(error?.code==='40001')return '다른 운영진이 먼저 수정했습니다. 입력한 내용은 남아 있습니다. 공개된 문구를 다시 불러온 뒤 변경 사항을 확인해 주세요.';
  if(['42P01','PGRST205','PGRST202'].includes(error?.code))return '문구 편집 기능의 서버 연결이 아직 준비되지 않았습니다. 운영자에게 초기 연결을 요청해 주세요.';
  if(error?.code==='42501'||error?.status===403)return '운영진 계정만 문구를 저장할 수 있습니다. 로그인 상태를 확인해 주세요.';
  if(error?.code==='22023')return '문구 길이와 연결 주소를 확인해 주세요.';
  return '저장 결과를 확인하지 못했습니다. 입력한 내용은 유지됩니다. 공개된 문구를 다시 불러와 저장 여부를 확인해 주세요.';
}
