import {client,esc,photoUrl} from './community-core.js';
import {youtubeEmbed} from './gallery-media.js';
export function videoUrl(path) {
  if(!/^video\/[0-9a-f-]{36}\.(mp4|webm)$/.test(path||''))return '';
  return client.storage.from('sjarc-videos').getPublicUrl(path).data.publicUrl;
}
export function mediaView(item,cover=false) {
  const kind=item.media_kind||'image';
  if(kind==='image') {
    const image=`<img class="${cover?'album-cover':'gallery-photo'}" loading="lazy" src="${esc(photoUrl(item.path))}" alt="${esc(item.caption)}">`;
    return cover?image:`<a href="${esc(photoUrl(item.path))}" target="_blank" rel="noopener">${image}</a>`;
  }
  if(kind==='youtube') {
    if(!youtubeEmbed(item.youtube_id))return '<div class="no-photo">영상 주소를 확인해 주세요.</div>';
    if(cover)return '<div class="video-cover"><span class="play-symbol" aria-hidden="true">▶</span><span>YouTube 영상</span></div>';
    return `<div class="video-shell"><button type="button" class="youtube-load" data-youtube="${esc(item.youtube_id)}" data-title="${esc(item.caption)}"><span class="play-symbol" aria-hidden="true">▶</span><span>${esc(item.caption)}</span><span class="small">YouTube 플레이어 열기</span></button></div><p class="video-link"><a href="https://www.youtube.com/watch?v=${esc(item.youtube_id)}" target="_blank" rel="noopener">YouTube에서 보기 ↗</a></p>`;
  }
  if(kind==='video') {
    const url=videoUrl(item.path),poster=photoUrl(item.poster_path);
    if(!url)return '<div class="no-photo">영상 파일을 확인해 주세요.</div>';
    if(cover)return `<div class="video-cover">${poster?`<img class="album-cover" loading="lazy" src="${esc(poster)}" alt="${esc(item.caption)}">`:''}<span class="video-badge">▶ 동영상</span></div>`;
    return `<div class="video-shell"><video controls playsinline preload="none" aria-label="${esc(item.caption)}" ${poster?`poster="${esc(poster)}"`:''} src="${esc(url)}">이 브라우저는 동영상 재생을 지원하지 않습니다.</video></div><p class="video-link"><a href="${esc(url)}" target="_blank" rel="noopener">원본 영상 열기 ↗</a></p>`;
  }
  return '<div class="no-photo">지원하지 않는 자료입니다.</div>';
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-youtube]');if(!button)return;
  const src=youtubeEmbed(button.dataset.youtube);if(!src)return;
  const iframe=document.createElement('iframe');iframe.src=src;iframe.title=button.dataset.title||'YouTube 영상';
  iframe.allow='encrypted-media; gyroscope; picture-in-picture; fullscreen';iframe.allowFullscreen=true;
  iframe.referrerPolicy='strict-origin-when-cross-origin';
  button.replaceWith(iframe);
});
document.addEventListener('error',event=>{
  const video=event.target;if(video.tagName!=='VIDEO'||video.dataset.errorShown)return;
  video.dataset.errorShown='true';const note=document.createElement('p');note.className='video-link';note.textContent='영상을 재생하지 못했습니다. 아래 원본 영상 링크를 이용해 주세요.';
  video.parentElement.after(note);
},true);
