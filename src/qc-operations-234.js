// Presentación operativa QC. Conserva el formulario y las validaciones originales.
export function openQcOperation(panel, form, row, preferred='Q1') {
  document.querySelectorAll('.qc234-backdrop').forEach(n=>n.remove());
  const backdrop=document.createElement('div');backdrop.className='qc234-backdrop';
  const previousFocus=document.activeElement;
  panel.classList.add('qc234-active');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Evaluación de jornada de control de calidad');
  const header=document.createElement('div');header.className='qc234-header';
  const title=document.createElement('div');title.innerHTML='<small>LAB-PSI · CONTROL DE CALIDAD</small><h2>Evaluación de jornada Q1 · Q2 · Q3</h2>';
  const subtitle=document.createElement('p');subtitle.textContent=`${row.parameter} · ${row.date} · ${row.executedCodes.size} muestra(s) ejecutada(s)`;title.append(subtitle);
  const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='qc234-close';closeButton.textContent='✕ Cerrar';header.append(title,closeButton);panel.prepend(header);
  const toolbar=document.createElement('nav');toolbar.className='qc234-tabs';toolbar.setAttribute('aria-label','Secciones de control');
  const sections=[...form.querySelectorAll('fieldset.qc-detail')];
  const activate=(q)=>{sections.forEach((s,i)=>{s.hidden=['Q1','Q2','Q3'][i]!==q;});toolbar.querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',b.dataset.qc234===q);b.setAttribute('aria-pressed',String(b.dataset.qc234===q));});};
  ['Q1','Q2','Q3'].forEach(q=>{const b=document.createElement('button');b.type='button';b.dataset.qc234=q;b.textContent=q==='Q1'?'Q1 · Positivo/negativo':q==='Q2'?'Q2 · Fortificada':'Q3 · Esterilidad';b.addEventListener('click',()=>activate(q));toolbar.append(b);});
  form.prepend(toolbar);activate(preferred);
  document.body.append(backdrop);document.body.classList.add('qc234-modal-open');
  const cleanup=()=>{backdrop.remove();header.remove();toolbar.remove();panel.classList.remove('qc234-active');panel.removeAttribute('role');panel.removeAttribute('aria-modal');panel.removeAttribute('aria-label');document.body.classList.remove('qc234-modal-open');document.removeEventListener('keydown',onKey);observer.disconnect();previousFocus?.focus?.();};
  const cancel=()=>{cleanup();panel.replaceChildren();};
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
  const observer=new MutationObserver(()=>{if(!panel.isConnected)cleanup();});observer.observe(document.getElementById('page-content')||document.body,{childList:true,subtree:true});
  closeButton.addEventListener('click',cancel);backdrop.addEventListener('click',cancel);
  form.querySelector('#daily-cancel')?.addEventListener('click',cleanup,{once:true});
  document.addEventListener('keydown',onKey);closeButton.focus();
  return {activate,close:cancel};
}
export function showQcLoadedIndicators(root, dailyControls){
 const planner=root.querySelector('.qc-planner');if(!planner)return;
 const existing=planner.querySelector('.qc234-kpis');if(existing)existing.remove();
 const controls=dailyControls.flatMap(d=>Object.entries(d.controls||{}).map(([q,v])=>({q,status:v?.status})));
 const count=(status)=>controls.filter(c=>c.status===status).length;
 const items=[['Jornadas QC cargadas',dailyControls.length],['Evaluaciones conformes',count('CONFORME')],['No conformes',count('NO_CONFORME')],['Pendientes',count('PENDIENTE')]];
 const section=document.createElement('div');section.className='qc234-kpis';section.setAttribute('aria-label','Resumen de controles cargados');
 items.forEach(([label,value])=>{const card=document.createElement('div');card.className='qc234-kpi';const small=document.createElement('small');small.textContent=label;const strong=document.createElement('strong');strong.textContent=String(value);card.append(small,strong);section.append(card);});
 const note=document.createElement('p');note.className='qc234-kpi-note';note.textContent='Resumen de jornadas actualmente consultadas; no representa el histórico completo.';
 section.append(note);planner.querySelector('.qc-planner-head')?.after(section);
}
