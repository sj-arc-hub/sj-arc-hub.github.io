// Approximate visits, not a count of identifiable people. Daily random browser key.
export function dailyVisitor(storage,day,uuid=()=>crypto.randomUUID()) {
 const key='sjarc.visit.daily';
 try {
  let stored;try{stored=JSON.parse(storage.getItem(key)||'null');}catch{}
  if(stored?.day===day&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stored.id))return stored.id;
  const id=uuid();storage.setItem(key,JSON.stringify({day,id}));return id;
 }catch{return null;} // If storage is unavailable, show totals without inflating them.
}
export async function loadVisits(client,{count=true,storage}={}) {
 let {data,error}=await client.rpc('site_visit_stats');if(error)throw error;
 if(count){let id=null;try{id=dailyVisitor(storage||localStorage,data.day);}catch{}
  if(id){const result=await client.rpc('record_site_visit',{p_visitor:id});if(result.error)throw result.error;data=result.data;}}
 return data;
}
export function canCountVisit(location) {
 return location.hostname==='sj-arc.org'&&!new URLSearchParams(location.search).has('copy-preview');
}
