import {db} from './firebase';
import {doc,getDoc} from 'firebase/firestore';
// V1.0.251 · Presentación de expedientes de liberación, sin alterar las escrituras.
export function enhanceRelease251(root, preparations, escapeHtml, displayCode, today){
  const panel=root?.querySelector('.release-head')?.parentElement;
  if(!panel || panel.dataset.release251==='1') return;
  panel.dataset.release251='1';
  const pending=panel.querySelector('.release-section .release-table');
  const history=panel.querySelector('#release-history-body');
  const toolbar=document.createElement('div'); toolbar.className='release251-toolbar';
  toolbar.innerHTML='<div><strong>Centro de decisiones y trazabilidad</strong><small>Consulte evidencias antes de confirmar. Las restricciones técnicas permanecen vigentes.</small></div><span>Consulta documental · sin escrituras</span>';
  panel.querySelector('.release-head')?.after(toolbar);
  const h=escapeHtml;
  const decorate=(tbody)=>{
    if(!tbody)return;
    tbody.querySelectorAll('tr').forEach(tr=>{
      if(tr.querySelector('[data-release251]')||tr.cells.length<8)return;
      const code=tr.cells[0]?.querySelector('strong')?.textContent?.trim();
      const prep=preparations.find(p=>displayCode(p)===code);
      if(!prep)return;
      const b=document.createElement('button');b.type='button';b.className='release251-view';b.dataset.release251=prep.id;b.textContent='Ver expediente';
      tr.cells[7].prepend(b);
    });
  };
  const dialog=document.createElement('dialog');dialog.className='release251-dialog';document.body.append(dialog);
  const dateValue=(v)=>{if(!v)return 'No registrado';try{let d;if(typeof v.toDate==='function')d=v.toDate();else if(typeof v.seconds==='number')d=new Date(v.seconds*1000);else if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)){const [y,m,day]=v.split('-');return `${day}/${m}/${y}`;}else if(typeof v==='string'&&/^(Timestamp\()?seconds=/.test(v)){const n=Number(v.match(/seconds=(\d+)/)?.[1]);d=new Date(n*1000);}else d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('es-EC',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);}catch{return 'No registrado';}};
  const people={JJF:'Jipson Franco',NS:'Nidia Sánchez',LP:'Lizbeth Prieto'};
  const nameValue=(p)=>p.releasedByName||p.releaseResponsibleName||p.responsibleName||people[p.releasedBy]||people[p.releaseBy]||null;
  const field=(label,value)=>`<div class="release251-field"><span>${h(label)}</span><strong>${h(value===undefined||value===null||value===''?'No registrado':value)}</strong></div>`;
  const open=(id)=>{
    const p=preparations.find(x=>x.id===id);if(!p)return;
    const expired=String(p.expiry||'')<today();
    const qc=p.qc||'PENDIENTE',perf=p.performanceRequired?(p.performance||'PENDIENTE'):'NO APLICA';
    const canRelease=qc==='CONFORME'&&(perf==='CONFORME'||perf==='NO APLICA');
    dialog.innerHTML=`<div class="release251-header"><div><small>LAB-PSI · MEDIOS DE CULTIVO</small><h2>Expediente de liberación</h2><p>${h(displayCode(p))} · ${h(p.mediumName||'')}</p></div><button type="button" data-close-release251 aria-label="Cerrar">✕</button></div><div class="release251-body"><div class="release251-alert">${expired?'Preparación vencida: no disponible para uso actual.':'Consulte las evidencias documentadas antes de tomar una decisión.'}</div><h3>01 · Identificación y origen</h3><div class="release251-grid">${field('Preparación',displayCode(p))}${field('Medio',p.mediumName)}${field('Frasco comercial',p.lotId)}${field('Fecha de preparación',dateValue(p.date))}${field('Vencimiento',dateValue(p.expiry))}${field('Unidades preparadas',p.count)}</div><h3>02 · Evidencias microbiológicas</h3><div class="release251-grid">${field('Control QC',qc)}${field('Rendimiento',perf)}${field('Fecha de evaluación QC',dateValue(p.qcEvaluationDate))}${field('Evaluación de rendimiento',dateValue(p.performanceDate||p.performanceEvaluationDate))}${field('Observaciones QC',p.qcObservations||p.qcNotes)}${field('Observaciones de rendimiento',p.performanceObservations||p.performanceNotes)}</div><h3>03 · Decisión y vigencia</h3><div class="release251-grid">${field('Estado documental',p.status)}${field('Fecha de liberación',dateValue(p.releasedAt||p.releaseDate))}${field('Responsable',nameValue(p)||'Consultando responsable…')}${field('Requisitos técnicos',canRelease?'QC y rendimiento conformes':'Existen controles pendientes o no conformes')}${field('Vigencia actual',expired?'Vencido':'Según estado documental')}${field('Observaciones',p.releaseNotes||p.observations)}</div><div class="release251-footnote">Este expediente es de solo lectura. No autoriza ni libera lotes; las decisiones se registran mediante las funciones originales del ERP.</div></div><div class="release251-footer"><button type="button" data-close-release251>Cerrar expediente</button></div>`;
    dialog.querySelectorAll('[data-close-release251]').forEach(b=>b.onclick=()=>dialog.close());
    if(!dialog.open)dialog.showModal();
    const uid=p.releasedBy||p.releaseBy;
    if(!nameValue(p)&&uid&&typeof uid==='string'){
      const target=[...dialog.querySelectorAll('.release251-field')].find(e=>e.querySelector('span')?.textContent==='Responsable')?.querySelector('strong');
      getDoc(doc(db,'users',uid)).then(snap=>{if(!target||!target.isConnected)return;const u=snap.exists()?snap.data():{};target.textContent=u.name||u.fullName||u.displayName||u.userName||u.userCode||'No identificado en usuarios';target.title='Identificador de auditoría: '+uid;}).catch(()=>{if(target?.isConnected){target.textContent='No disponible (verificar permisos)';target.title='UID: '+uid;}});
    }
  };
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-release251]');if(b)open(b.dataset.release251);});
  decorate(pending?.tBodies?.[0]);decorate(history);
  if(history){const observer=new MutationObserver(()=>decorate(history));observer.observe(history,{childList:true});}
}
