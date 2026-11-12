// Borradores locales de rendimiento. No modifica los criterios ni la escritura final en Firebase.
const PREFIX='psi:media:performance:draft:v1:';
export function enhancePerformanceDraft261(root,view){
 if(view!=='performance')return;
 const form=root?.querySelector('#performance-form');
 if(!form||!form.dataset.id||!form.querySelector('button[type="submit"]'))return;
 const key=PREFIX+form.dataset.id;
 const fields=()=>[...form.querySelectorAll('input[name],select[name],textarea[name]')].filter(e=>!e.disabled&&!e.readOnly&&e.type!=='hidden');
 const read=()=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
 const capture=()=>{const values={};for(const el of fields())values[el.name]=el.type==='checkbox'?el.checked:el.value;return values};
 const toolbar=document.createElement('div');toolbar.className='media-261-draft';
 toolbar.innerHTML='<div><strong>Progreso de la evaluación</strong><small data-draft-status>Sin borrador guardado</small></div><div class="media-261-actions"><button type="button" data-draft-save>💾 Guardar borrador</button><button type="button" data-draft-clear class="media-261-secondary">Descartar borrador</button></div>';
 const submit=form.querySelector('button[type="submit"]');
 const footer=form.querySelector('.media-250-footer');
 if(footer)footer.after(toolbar);else if(submit)submit.before(toolbar);else form.append(toolbar);
 const status=toolbar.querySelector('[data-draft-status]');
 const stamp=()=>{const d=read();status.textContent=d?.savedAt?'Borrador local guardado: '+new Date(d.savedAt).toLocaleString('es-EC'):'Sin borrador guardado';toolbar.querySelector('[data-draft-clear]').disabled=!d};
 const save=()=>{try{localStorage.setItem(key,JSON.stringify({savedAt:new Date().toISOString(),values:capture()}));stamp();status.textContent+=' · No enviado a Firebase';}catch{status.textContent='No se pudo guardar el borrador en este navegador.'}};
 const draft=read();
 if(draft?.values){for(const el of fields()){if(!(el.name in draft.values))continue;const value=draft.values[el.name];if(el.type==='checkbox'){el.checked=!!value;continue;}if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===value))continue;el.value=value;}form.dispatchEvent(new Event('change',{bubbles:true}));}
 toolbar.querySelector('[data-draft-save]').addEventListener('click',save);
 toolbar.querySelector('[data-draft-clear]').addEventListener('click',()=>{if(!confirm('¿Descartar el borrador local de este lote? No se eliminarán registros de Firebase.'))return;localStorage.removeItem(key);stamp();});
 // Cambiar la fecha no crea un borrador automáticamente: solo el botón explícito lo hace.
 stamp();
}

// Estado efímero durante el cambio de fecha. Nunca se escribe en Firebase ni en localStorage.
let transition=null;
export function capturePerformanceDateTransition(form){
 if(!form)return;
 const overlay=form.closest('.media-249-overlay');
 const values={};
 for(const el of form.querySelectorAll('input[name],select[name],textarea[name]')){
  if(el.type==='hidden'||el.readOnly||el.disabled||el.name==='evaluationDate')continue;
  values[el.name]=el.type==='checkbox'?el.checked:el.value;
 }
 transition={id:form.dataset.id,values,opened:!!overlay&&!overlay.hidden,step:[...(overlay?.querySelectorAll('.media-250-step')||[])].findIndex(b=>b.classList.contains('active'))};
}
export function restorePerformanceDateTransition(root){
 const state=transition;transition=null;
 if(!state)return;
 const form=root?.querySelector('#performance-form');
 if(!form||form.dataset.id!==state.id)return;
 for(const el of form.querySelectorAll('input[name],select[name],textarea[name]')){
  if(!(el.name in state.values)||el.disabled||el.readOnly)continue;
  const value=state.values[el.name];
  if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===value))continue;
  if(el.type==='checkbox')el.checked=!!value;else el.value=value;
 }
 form.dispatchEvent(new Event('change',{bubbles:true}));
 if(state.opened){
  root.querySelector('.media-249-open')?.click();
  const steps=root.querySelectorAll('.media-250-step');
  steps[Math.max(0,Math.min(state.step,steps.length-1))]?.click();
 }
}
