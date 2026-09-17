// Pure validation shared by gallery rendering and upload controls.
export const MAX_VIDEO_BYTES=50*1024*1024;
export function youtubeId(value) {
  let url;try{url=new URL(String(value).trim());}catch{return null;}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port)return null;
  const host=url.hostname.toLowerCase(),parts=url.pathname.split('/').filter(Boolean);
  let id=null;
  if(host==='youtu.be'&&parts.length===1)id=parts[0];
  else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host)) {
    if(url.pathname==='/watch')id=url.searchParams.get('v');
    else if(['shorts','embed','live'].includes(parts[0])&&parts.length===2)id=parts[1];
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:null;
}
export function videoInfo(file) {
  const ext=String(file?.name||'').split('.').pop().toLowerCase();
  const mime={mp4:'video/mp4',webm:'video/webm'}[ext];
  if(!mime || (file.type && file.type!==mime && file.type!=='application/octet-stream'))throw new Error('MP4 또는 WebM 동영상을 선택해 주세요. MOV 파일은 MP4로 변환해 주세요.');
  if(!file.size||file.size>MAX_VIDEO_BYTES)throw new Error('동영상은 파일당 50MB 이하로 선택해 주세요. 더 큰 영상은 유튜브 링크로 추가할 수 있습니다.');
  return {ext,mime};
}
export function youtubeEmbed(id) {return /^[A-Za-z0-9_-]{11}$/.test(id||'')?`https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`:'';}
