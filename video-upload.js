import {videoInfo} from './gallery-media.js';
// Decode locally before uploading; do not transcode or upload unusable files.
export async function prepareVideo(file) {
  const info=videoInfo(file),video=document.createElement('video'),url=URL.createObjectURL(file);
  video.muted=true;video.playsInline=true;video.preload='auto';
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>finish(new Error('동영상을 읽는 데 시간이 오래 걸립니다. MP4(H.264)로 변환하거나 유튜브 링크를 사용해 주세요.')),20000);
      const finish=error=>{clearTimeout(timer);video.onloadeddata=null;video.onerror=null;error?reject(error):resolve();};
      video.onloadeddata=()=>video.videoWidth&&video.videoHeight?finish():finish(new Error('영상 화면을 읽을 수 없습니다.'));
      video.onerror=()=>finish(new Error('이 브라우저에서 재생할 수 없는 영상입니다. MP4(H.264)로 변환하거나 유튜브 링크를 사용해 주세요.'));
      video.src=url;
    });
    const canvas=document.createElement('canvas'),scale=Math.min(1,960/video.videoWidth);
    canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
    const poster=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.8));
    return {...info,poster};
  }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
