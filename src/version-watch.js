// Consulta exclusivamente /version.json (sin lecturas Firebase).
const CURRENT='1.0.278';
const INTERVAL=5*60*1000;
let running=false, dismissedVersion='';
function newer(remote,local){
 const a=String(remote).split('.').map(Number),b=String(local).split('.').map(Number);
 if(a.some(n=>!Number.isFinite(n)))return false;
 for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);}
 return false;
}
function showUpdate(version){
 if(document.getElementById('micro-version-notice')||dismissedVersion===version)return;
 const bar=document.createElement('aside');bar.id='micro-version-notice';bar.setAttribute('role','status');
 bar.style.cssText='position:fixed;bottom:18px;right:18px;z-index:99999;max-width:min(390px,calc(100vw - 36px));background:#123f70;color:white;padding:18px;border:1px solid #85c8ed;border-radius:14px;box-shadow:0 12px 35px #08284a55;font:14px system-ui';
 const title=document.createElement('strong');title.textContent='Actualización disponible · V'+version;
 const desc=document.createElement('p');desc.textContent='Versión instalada: V'+CURRENT+'. Guarda primero cualquier formulario abierto antes de actualizar.';
 const update=document.createElement('button');update.textContent='Actualizar ahora';update.style.cssText='padding:10px 13px;margin-right:8px;background:#e8f5ff;color:#123f70;border:0;border-radius:8px;cursor:pointer;font-weight:700';
 update.onclick=async()=>{update.disabled=true;update.textContent='Actualizando…';try{if('serviceWorker' in navigator){const r=await navigator.serviceWorker.getRegistration();await r?.update();}}catch(_){}window.location.reload();};
 const later=document.createElement('button');later.textContent='Más tarde';later.style.cssText='padding:10px 13px;border:1px solid #a8d3ed;background:transparent;color:white;border-radius:8px;cursor:pointer';later.onclick=()=>{dismissedVersion=version;bar.remove();};
 bar.append(title,desc,update,later);document.body.append(bar);
}
async function check(){
 if(running||document.visibilityState==='hidden')return;
 running=true;
 try{const response=await fetch('/version.json?check='+Date.now(),{cache:'no-store'});
  if(!response.ok)return;
  const data=await response.json();
  if(typeof data.version==='string'&&newer(data.version,CURRENT))showUpdate(data.version);
 }catch(_){}finally{running=false;}
}
export function startVersionWatch(){
 if(import.meta.env.DEV)return;
 if(document.readyState==='complete')check();else window.addEventListener('load',check,{once:true});
 window.setInterval(check,INTERVAL);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
}
