// Capa de presentación: no cambia criterios, resultados ni persistencia.
export function enhancePerformance250(root,view){
 if(view!=='performance'||!root)return;
 const overlay=root.querySelector('.media-249-overlay');
 const form=overlay?.querySelector('#performance-form');
 if(!form)return;
 overlay.classList.add('media-250-overlay');
 const dialog=overlay.querySelector('.media-249-dialog');
 dialog?.classList.add('media-250-dialog');
 const body=overlay.querySelector('.media-249-body');
 const tests=[...form.querySelectorAll('.media-performance-test')];
 if(!tests.length)return;
 const labels={PRODUCTIVIDAD:'Productividad',SELECTIVIDAD:'Selectividad',ESPECIFICIDAD:'Especificidad'};
 const titleOf=t=>(t.querySelector('h3')?.textContent||'').split(/\s/)[0].trim().toUpperCase();
 const bar=document.createElement('div');bar.className='media-250-toolbar';
 bar.innerHTML='<div class="media-250-intro"><strong>Evaluación documentada por etapas</strong><small>Seleccione una prueba, registre sus observaciones y revise la conclusión automática. Los requisitos microbiológicos originales se mantienen.</small></div><nav class="media-250-steps" aria-label="Pruebas de rendimiento"></nav><div class="media-250-summary" aria-live="polite"></div>';
 form.before(bar);
 const nav=bar.querySelector('nav'),summary=bar.querySelector('.media-250-summary');
 const safe=t=>labels[t]||t;
 tests.forEach((test,index)=>{
  const name=titleOf(test);test.dataset.media250Test=name;
  test.querySelector('h3')?.classList.add('media-250-test-title');
  const button=document.createElement('button');button.type='button';button.className='media-250-step';button.dataset.index=index;button.innerHTML=`<span class="media-250-step-number">${String(index+1).padStart(2,'0')}</span><span>${safe(name)}</span><small>Por completar</small>`;
  nav.append(button);
 });
 let current=0;
 const footer=document.createElement('div');footer.className='media-250-footer';footer.innerHTML='<button type="button" data-media250-prev class="media-250-secondary">← Anterior</button><span class="media-250-position"></span><button type="button" data-media250-next class="media-250-primary">Siguiente prueba →</button>';
 tests.at(-1).after(footer);
 const select=index=>{current=Math.max(0,Math.min(tests.length-1,index));tests.forEach((t,i)=>{t.hidden=i!==current;});[...nav.children].forEach((b,i)=>{b.classList.toggle('active',i===current);b.setAttribute('aria-current',i===current?'step':'false')});footer.querySelector('[data-media250-prev]').disabled=current===0;footer.querySelector('[data-media250-next]').disabled=current===tests.length-1;footer.querySelector('.media-250-position').textContent=`Prueba ${current+1} de ${tests.length}`;body?.scrollTo({top:0,behavior:'smooth'});};
 nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>select(Number(b.dataset.index))));
 footer.querySelector('[data-media250-prev]').onclick=()=>select(current-1);
 footer.querySelector('[data-media250-next]').onclick=()=>select(current+1);
 const update=()=>{
  let complete=0;
  tests.forEach((test,i)=>{
   const name=test.dataset.media250Test;
   const conclusion=test.querySelector('[data-performance-conclusion]')?.value||'PENDIENTE';
   const reactivation=form.elements[`reactivation_${name}`]?.value;
   const fields=[...test.querySelectorAll('select[name^="visual_"]')];
   const observed=fields.length&&fields.every(f=>f.value&&f.value!=='NO_EVALUABLE');
   const ready=conclusion==='CONFORME'||conclusion==='NO_CONFORME';
   if(ready)complete++;
   const button=nav.children[i];button.classList.toggle('done',ready);button.classList.toggle('blocked',!reactivation);
   button.querySelector('small').textContent=ready?(conclusion==='CONFORME'?'Conforme':'No conforme'):!reactivation?'Falta reactivación':observed?'Revisar criterios':'Por completar';
  });
  summary.innerHTML=`<strong>${complete} de ${tests.length} pruebas concluidas</strong><span>${complete===tests.length?'Revise y guarde la evaluación documentada.':'Las pruebas pendientes no se aprueban automáticamente.'}</span>`;
 };
 form.addEventListener('input',()=>queueMicrotask(update));form.addEventListener('change',()=>queueMicrotask(update));
 // Antes de guardar, localizar la primera prueba sin evidencias; el guardado sigue siendo validado por media.js.
 form.addEventListener('submit',e=>{
  const incomplete=tests.findIndex(t=>!['CONFORME','NO_CONFORME'].includes(t.querySelector('[data-performance-conclusion]')?.value||''));
  if(incomplete>=0){e.preventDefault();e.stopImmediatePropagation();select(incomplete);update();const first=tests[incomplete].querySelector('select[name^="reactivation_"]:not(:disabled)');if(first&&!first.value)first.focus();else tests[incomplete].querySelector('select[name^="visual_"]:not(:disabled)')?.focus();summary.querySelector('span').textContent='Complete las evidencias y criterios de la prueba seleccionada antes de guardar.';}
 },true);
 select(0);update();
}
