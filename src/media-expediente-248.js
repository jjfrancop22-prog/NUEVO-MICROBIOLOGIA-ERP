// Expediente de solo lectura, elaborado exclusivamente con los documentos ya recibidos.
// No agrega lecturas ni escrituras a Firestore y no modifica las validaciones operativas.
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const printable=value=>value===null||value===undefined||value===''?'No registrado':String(value);
const item=(label,value)=>`<div class="media-248-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(printable(value))}</strong></div>`;
export function enhanceMedia248(root,view,preparations){
 if(!root)return;
 root.classList.add('media-pro-248');
 const eyebrow=root.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='RECURSOS MICROBIOLÓGICOS · V1.0.255';
 const tabs=root.querySelector('.product-tabs');if(tabs)tabs.setAttribute('aria-label','Etapas de medios de cultivo');
 if(view==='register'){
  const rows=Array.from(root.querySelectorAll('tr[data-media-record]'));
  const heading=root.querySelector('.media-register-table thead tr');if(heading){const th=document.createElement('th');th.textContent='Expediente';heading.append(th);}
  rows.forEach((tr,i)=>{const p=preparations[i];if(!p)return;const td=document.createElement('td');const button=document.createElement('button');button.type='button';button.className='media-248-detail-btn';button.textContent='Ver expediente';button.addEventListener('click',()=>openDossier(root,p));td.append(button);tr.append(td);});
  const head=root.querySelector('.media-register-head');if(head){const hint=document.createElement('p');hint.className='media-248-hint';hint.textContent='Consulte la trazabilidad de cada preparación sin alterar sus evaluaciones ni volver a descargar documentos.';head.append(hint);}
 }
 if(view==='qc'||view==='performance'||view==='release'){
  const card=root.querySelector('.media-card');if(card){const bar=document.createElement('div');bar.className='media-248-stagebar';const title=document.createElement('strong');title.textContent=({qc:'Control QC',performance:'Rendimiento',release:'Liberación'})[view];const desc=document.createElement('span');desc.textContent=({qc:'Verifique cada preparación y conserve la evidencia original.',performance:'Revise los ensayos requeridos y la cobertura documental existente.',release:'Confirme QC, rendimiento y vigencia antes de liberar.'})[view];bar.append(title,desc);card.prepend(bar);}
 }
}
function openDossier(root,p){
 root.querySelector('.media-248-backdrop')?.remove();
 const overlay=document.createElement('div');overlay.className='media-248-backdrop';
 const dialog=document.createElement('section');dialog.className='media-248-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Expediente de preparación');
 const codes=Array.isArray(p.unitCodes)?p.unitCodes:[];
 const section=(title,content)=>`<section class="media-248-section"><h3>${title}</h3><div class="media-248-grid">${content}</div></section>`;
 dialog.innerHTML=`<header class="media-248-header"><div><small>LAB-PSI · TRAZABILIDAD DOCUMENTAL</small><h2>Expediente de preparación</h2><p>${escapeHtml(printable(p.canonicalCode||p.code||p.id))} · ${escapeHtml(printable(p.mediumName))}</p></div><button type="button" class="media-248-close" aria-label="Cerrar expediente">✕</button></header><div class="media-248-body"><div class="media-248-alert">Consulta de solo lectura basada en los datos disponibles. Las evaluaciones pendientes no se interpretan como aprobadas.</div>${section('01 · Identificación',item('Código',p.canonicalCode||p.code)+item('Medio',p.mediumName)+item('Tipo',p.type)+item('Fecha de preparación',p.date)+item('Responsable',p.responsibleCode)+item('Registrado por',p.actorCode))}${section('02 · Producto comercial y preparación',item('ID del frasco comercial',p.lotId)+item('Volumen preparado (mL)',p.volume)+item('Masa descontada (g)',p.mass)+item('Cantidad de unidades',p.count)+item('Vencimiento',p.expiry)+item('Unidades documentadas',codes.length?codes.join(' · '):'No registradas'))}${section('03 · Evaluaciones',item('Estado QC',p.qc)+item('Fecha de QC',p.qcEvaluationDate)+item('Responsable QC',p.qcEvaluatedBy)+item('pH medido',p.measuredPh)+item('Ausencia de turbidez',p.noTurbidity)+item('Ausencia de microorganismos',p.noMicroorganisms)+item('Esterilidad',p.sterility)+item('Apariencia',p.appearance)+item('Rendimiento',p.performanceRequired?p.performance:'No requerido según configuración')+item('Origen de rendimiento',p.performanceInheritedFrom))}${section('04 · Liberación y observaciones',item('Estado de preparación',p.status)+item('Liberación histórica',p.historicalReleaseDate)+item('Liberado por',p.releasedBy)+item('Observaciones QC',p.qcNotes)+item('Evidencia / notas de rendimiento',p.evidence)+item('ID del documento',p.id))}<p class="media-248-footnote">Los campos sin información se indican como «No registrado». Esta vista no modifica existencias, fechas, controles ni autorizaciones.</p></div><footer class="media-248-footer"><button type="button" class="media-248-close media-248-close-main">Cerrar expediente</button></footer>`;
 overlay.append(dialog);root.append(overlay);
 const previous=document.activeElement;
 const close=()=>{document.removeEventListener('keydown',onKey);overlay.remove();if(previous?.isConnected)previous.focus();};
 const onKey=e=>{if(e.key==='Escape')close();};
 dialog.querySelectorAll('.media-248-close').forEach(b=>b.addEventListener('click',close));
 overlay.addEventListener('mousedown',e=>{if(e.target===overlay)close();});
 document.addEventListener('keydown',onKey);dialog.querySelector('.media-248-close').focus();
}
