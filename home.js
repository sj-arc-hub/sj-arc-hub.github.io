import {applyCopy,createCopyApi} from './site-copy.js';
const isPreview=new URLSearchParams(location.search).get('copy-preview')==='1'&&window.parent!==window;
if(!isPreview)try{
  const {client}=await import('./supabase-client.js');
  const saved=await createCopyApi(client).read();applyCopy(document,saved.content);
}catch{
  // The complete static homepage remains readable during an outage or before migration.
}
if(isPreview){
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='sjarc-copy-preview')return;
    applyCopy(document,event.data.content);
  });
  window.parent.postMessage({type:'sjarc-copy-ready'},location.origin);
  document.addEventListener('click',event=>{const link=event.target.closest('a');if(link&&!link.getAttribute('href')?.startsWith('#'))event.preventDefault();});
}
