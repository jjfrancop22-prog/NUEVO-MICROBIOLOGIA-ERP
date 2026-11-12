// V1.0.236: expediente de solo lectura sobre las jornadas ya renderizadas.
// No consulta ni escribe Firebase; no altera la evaluación ni el editor QC.
export function enhanceQcExpediente(root){
 const section=root.querySelector('#micro-daily-editor')?.closest('section.sample-section');
 const table=section?.querySelector('table.sample-table');if(!table||!table.tBodies[0])return;
 const rows=[...table.tBodies[0].rows].filter(r=>r.cells.length===8);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const modal=document.createElement('div');modal.className='qc236-backdrop';modal.hidden=true;
 modal.innerHTML='<section class="qc236-dialog" role="dialog" aria-modal="true" aria-labelledby="qc236-title"><header class="qc236-head"><div><small>LAB-PSI · EXPEDIENTE DE CALIDAD</small><h2 id="qc236-title">Detalle de jornada</h2><p id="qc236-subtitle"></p></div><button type="button" class="qc236-close">✕ Cerrar</button></header><div class="qc236-body"></div><footer class="qc236-actions"><button type="button" class="qc236-close">Cerrar expediente</button></footer></section>';
 document.body.append(modal);let previousFocus=null;
 const close=()=>{modal.hidden=true;document.body.classList.remove('qc236-modal-open');previousFocus?.focus?.();};
 modal.querySelectorAll('.qc236-close').forEach(b=>b.addEventListener('click',close));
 modal.addEventListener('click',e=>{if(e.target===modal)close();});
 modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const items=[...modal.querySelectorAll('button:not([disabled])')];if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 rows.forEach(row=>{
  const action=row.cells[7];if(!action)return;
  const btn=document.createElement('button');btn.type='button';btn.className='secondary qc236-open';btn.textContent='Ver expediente';btn.setAttribute('aria-label','Ver expediente de jornada '+row.cells[0].textContent.trim());action.append(document.createTextNode(' '),btn);
  btn.addEventListener('click',()=>{
   previousFocus=btn;
   const values=[...row.cells].slice(0,7).map(c=>c.textContent.trim().replace(/\s+/g,' '));
   const [date,parameter,samples,activity,q1,q2,q3]=values;
   const executed=activity.includes('ejecutada');
   const sampleCodes=(row.cells[2].childNodes.length?row.cells[2].childNodes[0].textContent:samples).split(',').map(x=>x.trim()).filter(Boolean);
   const chips=sampleCodes.length?sampleCodes.map(s=>`<span class="qc236-chip">${escape(s)}</span>`).join(''):'<span class="qc236-muted">Sin muestras ejecutadas identificadas en esta jornada.</span>';
   modal.querySelector('#qc236-title').textContent=`Jornada · ${parameter}`;
   modal.querySelector('#qc236-subtitle').textContent=`Fecha: ${date} · ${executed?'Ejecución registrada':'Programación / pendiente'}`;
   modal.querySelector('.qc236-body').innerHTML=`<div class="qc236-summary"><div><small>FECHA DE JORNADA</small><strong>${escape(date)}</strong></div><div><small>PARÁMETRO</small><strong>${escape(parameter)}</strong></div><div><small>ACTIVIDAD</small><strong>${escape(activity)}</strong></div></div><section class="qc236-panel"><h3>Muestras asociadas</h3><div class="qc236-chips">${chips}</div><p class="qc236-muted">Los códigos y las programaciones se muestran según la consulta actual. Para revisar cada expediente completo, utilice Registro de muestras.</p></section><section class="qc236-panel"><h3>Evaluaciones Q1 / Q2 / Q3</h3><div class="qc236-status-grid"><div><b>Q1 · Positivo / negativo</b><span>${escape(q1)}</span></div><div><b>Q2 · Muestra fortificada</b><span>${escape(q2)}</span></div><div><b>Q3 · Esterilidad de medios</b><span>${escape(q3)}</span></div></div></section><section class="qc236-panel"><h3>Recursos, observaciones y trazabilidad</h3><p>Recursos y lotes: <strong>consulte el Planificador QC y el registro de evaluación.</strong></p><p>Observaciones detalladas y responsables: <strong>no disponibles en esta tabla de consulta.</strong></p><p class="qc236-muted">Este expediente no inventa datos ni interpreta automáticamente la conformidad. Las evaluaciones oficiales y su auditoría permanecen en el registro original.</p></section>`;
   modal.hidden=false;document.body.classList.add('qc236-modal-open');modal.querySelector('.qc236-close').focus();
  });
 });
}
