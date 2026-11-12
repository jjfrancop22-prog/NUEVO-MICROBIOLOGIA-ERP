// V1.0.237: consulta puntual y de solo lectura del documento oficial de la jornada.
// La consulta ocurre exclusivamente al pulsar "Consultar detalle oficial".
import {db} from './firebase';
import {doc,getDoc} from 'firebase/firestore';
export function enhanceQcExpediente237(root){
 const modal=document.querySelector('.qc236-backdrop');
 if(!modal||modal.dataset.qc237Ready)return;
 modal.dataset.qc237Ready='1';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const format=v=>{if(v==null||v==='')return 'No registrado';if(typeof v?.toDate==='function')return v.toDate().toLocaleString('es-EC');if(Array.isArray(v))return v.map(format).join(' · ');if(typeof v==='object')return Object.entries(v).map(([k,x])=>`${k}: ${format(x)}`).join(' | ');return String(v)};
 const keys=['status','date','medium','phase','matrix','nmp','start35','end35','temp35','start44','end44','temp44','gas','growth','color','fluorescence','notes','observations','observacion','responsible','analyst','evaluatedBy','evaluatedAt','updatedAt','createdAt','lot','lots','strain','strains','resources'];
 const labels={status:'Estado',date:'Fecha real',medium:'Medios controlados',phase:'Fase',matrix:'Matriz',nmp:'NMP observado',start35:'Inicio 35 °C',end35:'Fin 35 °C',temp35:'Temperatura 35 °C',start44:'Inicio 44,5 °C',end44:'Fin 44,5 °C',temp44:'Temperatura 44,5 °C',gas:'Gas',growth:'Crecimiento',color:'Color',fluorescence:'Fluorescencia',notes:'Observaciones',observations:'Observaciones',observacion:'Observaciones',responsible:'Responsable',analyst:'Analista',evaluatedBy:'Evaluado por',evaluatedAt:'Fecha evaluación',updatedAt:'Última actualización',createdAt:'Creación',lot:'Lote',lots:'Lotes',strain:'Cepa',strains:'Cepas',resources:'Recursos'};
 let request=0;
 modal.addEventListener('click',async e=>{
  if(!e.target.closest('.qc236-open'))return;
  const row=e.target.closest('tr');
  const id=row?.querySelector('[data-daily]')?.dataset.daily;
  const body=modal.querySelector('.qc236-body');
  if(!body||!id)return;
  const panel=document.createElement('section');panel.className='qc236-panel qc237-panel';
  panel.innerHTML='<h3>Registro oficial de Firebase</h3><p class="qc236-muted">Consulta individual bajo demanda. No modifica evaluaciones ni recursos.</p><button type="button" class="qc237-load">Consultar detalle oficial</button><div class="qc237-details" role="status" aria-live="polite"></div>';
  setTimeout(()=>{if(!modal.hidden)modal.querySelector('.qc236-body')?.append(panel);},0);
  const load=panel.querySelector('.qc237-load'),details=panel.querySelector('.qc237-details');
  load.addEventListener('click',async()=>{
   const token=++request;load.disabled=true;details.textContent='Consultando registro oficial…';
   try{
    const snap=await getDoc(doc(db,'microDailyQuality',id));
    if(token!==request||!panel.isConnected)return;
    if(!snap.exists()){details.textContent='No se encontró el registro de esta jornada.';return;}
    const data=snap.data(),controls=data.controls||{};
    const summary=['date','parameter','updatedAt','createdAt'].filter(k=>data[k]!=null).map(k=>`<div><b>${esc(labels[k]||k)}</b><span>${esc(format(data[k]))}</span></div>`).join('');
    const cards=['Q1','Q2','Q3'].map(q=>{
     const c=controls[q];if(!c)return `<section class="qc237-control"><h4>${q}</h4><p>Sin evaluación registrada.</p></section>`;
     const fields=keys.filter(k=>c[k]!==undefined&&c[k]!==null&&c[k]!=='').map(k=>`<div><b>${esc(labels[k]||k)}</b><span>${esc(format(c[k]))}</span></div>`).join('');
     return `<section class="qc237-control"><h4>${q} · ${esc(format(c.status||'PENDIENTE'))}</h4><div class="qc237-fields">${fields||'<p>Sin detalles adicionales registrados.</p>'}</div></section>`;
    }).join('');
    details.innerHTML=`<div class="qc237-fields">${summary}</div><div class="qc237-controls">${cards}</div><p class="qc236-muted">Se muestran únicamente los campos existentes del documento oficial. Los recursos y lotes no vinculados a esta jornada no se infieren.</p>`;
   }catch(err){if(token===request&&panel.isConnected)details.textContent='No se pudo consultar el detalle oficial: '+(err?.code||err?.message||'error de conexión')+'. El resumen de la jornada permanece disponible.';}
   finally{if(token===request&&panel.isConnected)load.disabled=false;}
  });
 },true);
 modal.addEventListener('click',e=>{if(e.target.closest('.qc236-close')||e.target===modal)request++;});
}
