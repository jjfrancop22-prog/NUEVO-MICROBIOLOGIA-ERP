// Ventanas informativas del planificador QC. No modifica datos ni reglas de evaluación.
export function enhanceQcPlanner(root){
 if(!root || root.dataset.qcPremiumReady==='1')return;
 root.dataset.qcPremiumReady='1';
 root.addEventListener('click',event=>{
  const summary=event.target.closest('.qc150-disclosure > summary, .qc150-help > summary');
  if(!summary || !root.contains(summary))return;
  event.preventDefault();
  const detail=summary.parentElement;
  const card=detail.closest('.qc-planner-card');
  const title=card?.querySelector('.qc-planner-title strong')?.textContent?.trim()||'Criterios de programación QC';
  const label=summary.textContent.trim();
  const overlay=document.createElement('div');overlay.className='qc233-overlay';
  overlay.innerHTML=`<section class="qc233-dialog" role="dialog" aria-modal="true" aria-label="${title.replaceAll('"','&quot;')}"><header class="qc233-header"><div><small>LAB-PSI · CONTROL DE CALIDAD</small><h2></h2><p></p></div><button type="button" class="qc233-close" aria-label="Cerrar ventana">✕ Cerrar</button></header><div class="qc233-body"></div><footer class="qc233-footer"><span>Información del planificador · sin modificar registros</span><button type="button" class="qc233-close qc233-primary">Cerrar</button></footer></section>`;
  overlay.querySelector('h2').textContent=title;
  overlay.querySelector('.qc233-header p').textContent=label;
  const body=overlay.querySelector('.qc233-body');
  [...detail.children].filter(n=>n!==summary).forEach(n=>body.append(n.cloneNode(true)));
  const priorFocus=document.activeElement;
  const close=()=>{overlay.remove();document.removeEventListener('keydown',onKey);priorFocus?.focus?.();};
  const onKey=e=>{if(e.key==='Escape')close();};
  overlay.querySelectorAll('.qc233-close').forEach(b=>b.addEventListener('click',close));
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  body.addEventListener('click',e=>{const go=e.target.closest('[data-qc-go]');if(!go)return;e.preventDefault();e.stopPropagation();const page=go.dataset.qcGo,atcc=go.dataset.qcAtcc||'';close();window.dispatchEvent(new CustomEvent('micro:navigate',{detail:{page,atcc}}));});
  document.body.append(overlay);document.addEventListener('keydown',onKey);overlay.querySelector('.qc233-close').focus();
 });
}
