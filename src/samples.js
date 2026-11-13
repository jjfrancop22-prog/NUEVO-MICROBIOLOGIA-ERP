import { enhanceQcAnalytics } from './qc-analytics-238.js';
import { enhanceQcExpediente } from './qc-expediente-236.js';
import { enhanceQcExpediente237 } from './qc-expediente-237.js';
import { openQcOperation, showQcLoadedIndicators } from './qc-operations-234.js';
import { enhanceQcHistory } from './qc-history-235.js';
import { enhanceQcPlanner } from './qc-premium-233.js';
import {qcPhase,qcPhaseFor,qcResources,qcVerdict} from './qc-intelligence';
import {db} from './firebase';
import {collection,doc,query,orderBy,limit,onSnapshot,runTransaction,serverTimestamp,getDoc,getDocs,setDoc,arrayUnion,getCountFromServer,startAfter,where} from 'firebase/firestore';
let dailyControls=[];let unsubDaily=null;
// V1.0.255: ventana viva pequeña + historial paginado bajo demanda.
const SAMPLE_PAGE_SIZE=10;
const SAMPLE_HISTORY_BATCH=100;
const APP_VERSION="1.0.293";
const METRIC_CACHE_KEY='microSamples_globalMetrics_v282';
// El resumen remoto no está provisionado ni autorizado en las reglas actuales.
// No abrir listeners a documentos inaccesibles: evita permission-denied y lecturas fallidas.
const SUMMARY_PATH=null;
let summaryUnsubscribe=null;let summaryVerified=false;
function saveMetricCache(){try{sessionStorage.setItem(METRIC_CACHE_KEY,JSON.stringify({total:sampleTotal,...globalMetrics}));}catch(_){}}
// Los indicadores globales solo provienen de agregaciones confirmadas por Firebase.
// El historial paginado NUNCA debe reemplazarlos por cifras parciales.
function resolveMetricsFromCompleteHistory(){
 // Respaldo verificado: solo cuando Firestore entregó la última página del historial.
 // Nunca publicar el tamaño de una ventana parcial como total global.
 if(!historyExhausted || historyError || !recentSnapshotReady)return;
 const all=new Map([...historicalSamples,...pendingSamples,...recentSamples].map(r=>[r.id,r]));
 const rows=[...all.values()];
 // Si existe un conteo remoto, comprobar integridad del historial antes de usarlo.
 // Si el conteo agregado falló, la consulta histórica COMPLETA es una fuente válida.
 if(sampleTotal!==null && rows.length!==sampleTotal)return;
 if(sampleTotal===null)sampleTotal=rows.length;
 if(globalMetrics.finished===null)globalMetrics.finished=rows.filter(r=>r.status==='FINISHED').length;
 if(globalMetrics.duplicates===null)globalMetrics.duplicates=rows.filter(r=>!!r.parentId).length;
 if(sampleTotal!==null && globalMetrics.finished!==null && globalMetrics.duplicates!==null){
  metricError='';saveMetricCache();
 }
}

function cachedMetrics(){try{return JSON.parse(sessionStorage.getItem(METRIC_CACHE_KEY)||'{}')}catch{return {}}}
const initialMetrics=cachedMetrics();
let globalMetrics={finished:null,duplicates:null};
let historyAutoRunning=false;
let pendingReady={RECEIVED:false,ASSIGNED:false};
let recentSnapshotReady=false;
let historyError="";
let historyAutoStarted=false;
let sampleTotal=null,sampleListenerToken=0;
let metricsRefreshing=false;
let metricError="";
let recentSamples=[],historicalSamples=[],pendingSamples=[],historicalCursor=null;
let historyLoading=false,historyExhausted=false,unsubPending=null;
let countRefreshTimer=null,countRefreshSeq=0;
function refreshSampleCount(el,user,profile,{immediate=false}={}){
 if(countRefreshTimer)clearTimeout(countRefreshTimer);
 const token=sampleListenerToken,seq=++countRefreshSeq;
 countRefreshTimer=setTimeout(async()=>{
  countRefreshTimer=null;
  const tasks=[
   ['total',collection(db,'microSamples')],
   ['finished',query(collection(db,'microSamples'),where('status','==','FINISHED'))]
  ];
  metricsRefreshing=true;
  const results=await Promise.allSettled(tasks.map(([,ref])=>getCountFromServer(ref)));
  if(token!==sampleListenerToken||seq!==countRefreshSeq)return;
  metricsRefreshing=false;
  const errors=[];
  results.forEach((result,i)=>{
   const name=tasks[i][0];
   if(result.status==='fulfilled'){
    const value=result.value.data().count;
    if(name==='total')sampleTotal=value;
    else globalMetrics[name]=value;
   }else{
    console.warn('Indicador global '+name+' no disponible:',result.reason);
    errors.push(name);
   }
  });
  // El conteo de duplicados usa el historial completo ya cargado; evita una consulta
  // por desigualdad sobre parentId que puede requerir índice o excluir documentos.
  resolveMetricsFromCompleteHistory();
  metricError=errors.length && (sampleTotal===null || globalMetrics.finished===null)?'Conteo remoto pendiente: '+errors.join(', ')+'.':'';
  saveMetricCache();
  if(el.isConnected)display(el,user,profile);
 },immediate?0:1200);
}
function subscribeSummary(el,user,profile){
 if(!SUMMARY_PATH)return;
 if(summaryUnsubscribe){summaryUnsubscribe();summaryUnsubscribe=null;}
 summaryVerified=false;
 summaryUnsubscribe=onSnapshot(doc(db,...SUMMARY_PATH),snap=>{
  if(!el.isConnected)return;
  if(snap.exists()){
   const v=snap.data();
   if(Number.isInteger(v.total)&&v.total>=0)sampleTotal=v.total;
   if(Number.isInteger(v.finished)&&v.finished>=0)globalMetrics.finished=v.finished;
   if(Number.isInteger(v.duplicates)&&v.duplicates>=0)globalMetrics.duplicates=v.duplicates;
   summaryVerified=true;saveMetricCache();display(el,user,profile);
  }
 },err=>console.warn('Resumen no disponible; se utiliza historial:',err));
}

function updateLocalSample(id,patch){
 const apply=rows=>rows.map(r=>r.id===id?{...r,...patch}:r);
 recentSamples=apply(recentSamples);historicalSamples=apply(historicalSamples);pendingSamples=apply(pendingSamples);
 mergeSampleWindows();
}
const mergeSampleWindows=()=>{
 const byId=new Map();
 for(const r of [...historicalSamples,...pendingSamples,...recentSamples])byId.set(r.id,r);
 records=[...byId.values()].sort((a,b)=>{
  const ta=a.createdAt?.seconds??0,tb=b.createdAt?.seconds??0;
  return tb-ta||String(b.id).localeCompare(String(a.id));
 });
};
async function loadSampleHistory(el,user,profile){
 if(historyLoading||historyExhausted||!historicalCursor)return false;
 historyLoading=true;
 try{
  const q=query(collection(db,'microSamples'),orderBy('createdAt','desc'),startAfter(historicalCursor),limit(SAMPLE_HISTORY_BATCH));
  const snap=await getDocs(q);
  historicalCursor=snap.docs.at(-1)||historicalCursor;
  if(snap.size<SAMPLE_HISTORY_BATCH)historyExhausted=true;
  const old=new Map(historicalSamples.map(r=>[r.id,r]));
  for(const d of snap.docs)old.set(d.id,{id:d.id,...d.data()});
  historicalSamples=[...old.values()];mergeSampleWindows();
  historyError='';
  return true;
 }catch(e){historyError='No se pudo completar la consulta histórica: '+e.message;console.warn(historyError);return false;}
 finally{historyLoading=false;}
}
async function ensureAnalyticalHistory(el,user,profile){
 if(historyAutoRunning||historyExhausted||!historicalCursor)return;
 historyAutoRunning=true;const token=sampleListenerToken;
 try{
  while(token===sampleListenerToken&&!historyExhausted&&historicalCursor){
   const ok=await loadSampleHistory(el,user,profile);
   if(!ok)break; // Nunca reintentar indefinidamente si Firebase falla.
  }
 }finally{
  if(token===sampleListenerToken){historyAutoRunning=false;mergeSampleWindows();resolveMetricsFromCompleteHistory();if(el.isConnected)display(el,user,profile);}
 }
}
const dailyKey=(date,parameter)=>date+'__'+({'Coliformes fecales':'fecales','Coliformes totales':'totales','E. coli':'ecoli'}[parameter]||'unknown');
// V1.0.255: valores iniciales desde planificación, editables; la jornada QC nace exclusivamente de la fecha REAL del ensayo finalizado.
// La fecha prevista de asignación nunca constituye evidencia de ejecución.
const controlDate=r=>r.status==='FINISHED'?(r.analysis?.date||''):'';
// Jornadas previstas visibles para planificación; solo FINISHED constituye ejecución QC.
const dailyRows=()=>{const map=new Map();const ensure=(date,parameter)=>{const id=dailyKey(date,parameter);if(!map.has(id))map.set(id,{id,date,parameter,codes:new Set(),executedCodes:new Set(),plannedCodes:new Set(),plannedItems:[]});return map.get(id);};for(const r of records){if(!['ASSIGNED','FINISHED'].includes(r.status))continue;const date=r.status==='FINISHED'?controlDate(r):r.plannedDate;if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))continue;for(const parameter of r.parameters||[]){const row=ensure(date,parameter);row.codes.add(r.code);if(r.status==='FINISHED')row.executedCodes.add(r.code);else{row.plannedCodes.add(r.code);row.plannedItems.push({id:r.id,code:r.code,time:r.plannedTime||'',analyst:r.analyst||''});}}}return [...map.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.parameter.localeCompare(b.parameter));};
// V1.0.255: Planificador de recursos QC. Lectura puntual, sin listeners adicionales.
let plannerMedia=[],plannerReactions=[],plannerLoaded=false,plannerError='',plannerLoading=false,plannerAutoRequested=false;
let plannerFetchPromise=null;
async function loadPlannerResources(el,user,profile,{force=false}={}){
 if(plannerFetchPromise)return plannerFetchPromise;
 if(plannerLoaded&&!force)return;
 plannerLoading=true;plannerError='';plannerAutoRequested=true;
 plannerFetchPromise=(async()=>{
  try{
   const [m,r]=await Promise.all([getDocs(collection(db,'microMediaPreparations')),getDocs(collection(db,'microStrainReactivations'))]);
   plannerMedia=m.docs.map(d=>({id:d.id,...d.data()}));plannerReactions=r.docs.map(d=>({id:d.id,...d.data()}));plannerLoaded=true;
  }catch(e){plannerError='No fue posible consultar los recursos: '+(e?.message||String(e));plannerLoaded=false;}
  finally{plannerLoading=false;plannerFetchPromise=null;if(el.isConnected&&sampleViewMode==='quality')display(el,user,profile);}
 })();
 return plannerFetchPromise;
}

const plannerDay=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Guayaquil'});
const plannerAddDays=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const plannerNextQ1=day=>{let next=plannerAddDays(day,2);while(![2,3,4].includes(new Date(next+'T12:00:00Z').getUTCDay()))next=plannerAddDays(next,1);return next;};
// V1.0.255: Q2 anclado al primer control documentado, no a la fecha de ejecución más reciente.
// La fecha objetivo permanece en la secuencia original de 15 días.
const q2Schedule=(today)=>{
 const dates=dailyControls.flatMap(x=>{const c=x.controls?.Q2;return c&&['CONFORME','NO_CONFORME'].includes(c.status)&&/^\d{4}-\d{2}-\d{2}$/.test(c.date||'')?[c.date]:[];}).sort();
 if(!dates.length)return {target:today,windowStart:today,windowEnd:today,weekend:false,anchor:null};
 const anchor=dates[0],last=dates[dates.length-1];let target=plannerAddDays(anchor,15);
 // Avanzar únicamente por ciclos anclados; una ejecución anticipada/tardía no desplaza el calendario.
 let safety=0;while(target<=last&&safety++<20000)target=plannerAddDays(target,15);
 const weekday=new Date(target+'T12:00:00Z').getUTCDay();
 const weekend=weekday===0||weekday===6;
 const windowStart=weekend?plannerAddDays(target,weekday===6?-2:-3):target;
 const windowEnd=weekend?plannerAddDays(target,weekday===6?3:2):target;
 return {target,windowStart,windowEnd,weekend,anchor};
};
const qcDayLabel=day=>['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][new Date(day+'T12:00:00Z').getUTCDay()];
const qcDisplayDate=day=>day.split('-').reverse().join('/');
const plannerLast=q=>dailyControls.flatMap(x=>{const c=x.controls?.[q];return c&&['CONFORME','NO_CONFORME'].includes(c.status)&&c.date?[c]:[];}).sort((a,b)=>b.date.localeCompare(a.date))[0];
// V1.0.255: Q1 requiere muestra prevista y día martes/miércoles/jueves.
// La fecha prevista es planificación, nunca evidencia de ejecución.
const q1Allowed=day=>[2,3,4].includes(new Date(day+'T12:00:00Z').getUTCDay());
// Viernes: excepcionalmente habilitado solo con análisis FINISHED en la jornada.
const q1EligibleRow=row=>q1Allowed(row.date)||(new Date(row.date+'T12:00:00Z').getUTCDay()===5&&row.executedCodes.size>0);
const q1SuggestedDate=target=>{for(let n=0;n<7;n++){const day=plannerAddDays(target,n);const row=dailyRows().find(r=>r.date===day);if(q1Allowed(day)||(new Date(day+'T12:00:00Z').getUTCDay()===5&&row?.executedCodes.size>0))return day;}return target;};
// V1.0.255: fecha objetivo inmutable; una jornada REAL dentro de ±2 días puede ejecutar Q1.
// Nunca se convierte una muestra prevista en ejecución ni se mueve el calendario por esta propuesta.
const q1ExecutedCandidate=(target,today,lastDate='')=>dailyRows().filter(r=>
 r.executedCodes.size>0 && r.date<=today && r.date>lastDate &&
 r.date>=plannerAddDays(target,-2) && r.date<=plannerAddDays(target,2) && q1EligibleRow(r) &&
 !['CONFORME','NO_CONFORME'].includes(dailyControls.find(c=>c.id===r.id)?.controls?.Q1?.status)
).sort((a,b)=>Math.abs((new Date(a.date+'T12:00:00Z')-new Date(target+'T12:00:00Z'))/86400000)-Math.abs((new Date(b.date+'T12:00:00Z')-new Date(target+'T12:00:00Z'))/86400000)||a.date.localeCompare(b.date))[0]||null;
const q1Plan=base=>{const rows=dailyRows();const planned=rows.filter(r=>(r.plannedCodes.size>0||r.executedCodes.size>0)&&r.date>=base&&q1EligibleRow(r)).sort((a,b)=>a.date.localeCompare(b.date));return {date:planned[0]?.date||base,hasPlanned:!!planned.length,plannedCount:planned[0]?.plannedCodes.size||0};};
// V1.0.255: la frecuencia es orientativa, no impide adelantar un control.
// Los semáforos de jornadas sin registro no deben insinuar una obligación antes del vencimiento.
const qcDueForDate=(q,date)=>{const prior=dailyControls.flatMap(x=>{const c=x.controls?.[q];return c&&['CONFORME','NO_CONFORME'].includes(c.status)&&c.date&&c.date<date?[c.date]:[];}).sort().at(-1);if(!prior)return true;if(q==='Q2')return date>=plannerAddDays(prior,15);if(q==='Q1')return q1SuggestedDate(plannerAddDays(prior,2))<=date;return true;};
// V1.0.255: Q3 se debe a cada jornada REAL con muestras finalizadas, no a una frecuencia fija desde el último QC.
// Los registros por parámetro se conservan separados para respetar el modelo microDailyQuality.
const q3Jornadas=()=>dailyRows().filter(r=>r.executedCodes.size>0).map(r=>{
 const control=dailyControls.find(c=>c.id===r.id)?.controls?.Q3;
 return {...r,q3Status:control?.status||'SIN_EVALUACION',q3HasDocument:!!control};
}).sort((a,b)=>a.date.localeCompare(b.date)||a.parameter.localeCompare(b.parameter));
// V1.0.279: identificar medios por parámetros REALMENTE ejecutados en una fecha.
const qcMediaForDate=date=>{
 const parameters=new Set(dailyRows().filter(r=>r.date===date&&r.executedCodes.size).map(r=>r.parameter));
 const a1=parameters.has('Coliformes fecales');
 const lmx=parameters.has('Coliformes totales')||parameters.has('E. coli');
 return {a1,lmx,count:Number(a1)+Number(lmx),label:a1&&lmx?'Ambos medios':a1?'A-1 Medium':lmx?'Fluorocult LMX':'',parameters:[...parameters]};
};
const q3Pendientes=()=>q3Jornadas().filter(r=>r.q3HasDocument && ['PENDIENTE','PENDIENTE_EVALUACION'].includes(r.q3Status));
const q3SinEvaluacion=()=>q3Jornadas().filter(r=>r.q3Status==='SIN_EVALUACION');
const q3Planificadas=()=>dailyRows().filter(r=>r.plannedCodes.size>0&&!r.executedCodes.size).sort((a,b)=>a.date.localeCompare(b.date));
const plannerSection=()=>{
 const today=plannerDay();
 const config=[['Q1','Control positivo / negativo',2,'🧪'],['Q3','Esterilidad de medios',1,'🧫'],['Q2','Muestra fortificada · NMP',15,'🔬']];
 const cards=config.map(([q,title,interval,icon])=>{
  const last=plannerLast(q), pending=q==='Q3'?q3Pendientes():[], unreviewed=q==='Q3'?q3SinEvaluacion():[], planned=q==='Q3'?q3Planificadas():[];
  const q2=q==='Q2'?q2Schedule(today):null;
  const base=q==='Q3'?(pending[0]?.date||unreviewed.filter(r=>r.date>=plannerAddDays(today,-30))[0]?.date||planned[0]?.date||today):q2?q2.target:(last?(q==='Q1'?plannerNextQ1(last.date):plannerAddDays(last.date,interval)):today);
  const plan=q==='Q1'?q1Plan(base):null, q1Candidate=q==='Q1'?q1ExecutedCandidate(base,today,last?.date||''):null, next=q==='Q1'?q1SuggestedDate(base):(plan?.date||base);
  // V1.0.255: sugerencia visual Q2 sin desplazar la fecha objetivo ni alterar ciclos.
  const q2Suggested=q2?(q2.weekend?plannerAddDays(q2.target,new Date(q2.target+'T12:00:00Z').getUTCDay()===6?2:1):q2.target):null;
  const due=(q2?q2.windowStart:next)<=today;
  const phase=q==='Q1'?qcPhase(dailyControls,next,''):q==='Q2'?qcPhaseFor(dailyControls,next,'','Q2'):'BLANCO';
  const resources=plannerLoaded?(q==='Q3'?qcResources(plannerMedia,[],next,'Ambos medios','POSITIVO'):qcResources(plannerMedia,plannerReactions,q1Candidate?.date||next,'Ambos medios',q==='Q2'?'POSITIVO':phase)):[];
  const warnings=[];
  for(const r of resources){if(!r.lots.length)warnings.push({text:r.name+': falta lote liberado y vigente',page:'media'});if(q!=='Q3'&&!r.valid.length)warnings.push({text:r.name+': falta reactivación APTA · ATCC '+r.atcc,page:'strains',atcc:r.atcc});}
  const ready=plannerLoaded&&!warnings.length;
  const matching=dailyRows().filter(r=>r.date>=(q2?q2.windowStart:base)&&r.date<=today&&(q2?r.date<=q2.windowEnd:true)&&r.executedCodes.size>0&&(q!=='Q1'||q1EligibleRow(r)));
  const hasExecution=q==='Q3'?(pending.length>0||unreviewed.some(r=>r.date===base)):q==='Q1'?!!q1Candidate:matching.length>0;
  const eligible=q!=='Q1'||hasExecution;
  const status=q==='Q3'?(pending.length?'PENDIENTE DOCUMENTADO':unreviewed.length?'REVISAR JORNADAS':planned.length?'PREVISTO':'AL DÍA'):q==='Q2'&&today>q2.windowEnd&&!hasExecution?'ATRASADO':q==='Q1'&&!eligible?'SIN MUESTRA':!due?'PROGRAMADO':!hasExecution?'SIN EJECUCIÓN':!plannerLoaded?'VERIFICANDO':ready?'LISTO':'REVISAR RECURSOS';
  const tone=status==='AL DÍA'||status==='LISTO'?'ok':status==='PROGRAMADO'||status==='PREVISTO'?'info':status==='ATRASADO'||status==='SIN EJECUCIÓN'?'late':status==='REVISAR RECURSOS'?'blocked':'warn';
  const label=q==='Q3'?(pending.length?'Pendiente documentado':unreviewed.length?'Próxima jornada / revisión':'Próxima jornada prevista'):q==='Q2'?'Fecha objetivo fija':'Próximo control';
  const details=q==='Q3'?`<div class="qc150-detail"><strong>Jornadas ejecutadas pendientes</strong>${pending.length?`<div class="qc150-journals">${pending.map(r=>`<button type="button" class="qc150-journal qc279-journal-button" data-qc-q3-date="${esc(r.date)}" data-qc-q3-id="${esc(r.id)}"><span>${esc(qcDisplayDate(r.date))} · ${esc(r.parameter)} · ${esc(qcMediaForDate(r.date).label||'Sin medio identificado')}</span><span class="qc150-mini">Abrir Q3 ↗</span></button>`).join('')}</div>`:'<p class="qc150-muted">Sin jornadas reales pendientes.</p>'}${unreviewed.length?`<p class="qc150-muted"><strong>${unreviewed.length} jornadas ejecutadas sin evaluación Q3:</strong> no se consideran pendientes confirmados hasta verificar el expediente.</p><div class="qc150-journals">${unreviewed.map(r=>`<button type="button" class="qc150-journal qc279-journal-button" data-qc-q3-date="${esc(r.date)}" data-qc-q3-id="${esc(r.id)}"><span>${esc(qcDisplayDate(r.date))} · ${esc(r.parameter)} · Sin evaluación documentada</span><span class="qc150-mini">Revisar ↗</span></button>`).join('')}</div>`:''}${planned.length?`<p class="qc150-muted">${planned.length} jornada(s) previstas sin ejecución confirmada.</p>`:''}</div>`:q==='Q2'?`<div class="qc150-detail"><strong>Calendario de Q2</strong><p>Objetivo: ${esc(qcDisplayDate(q2.target))} (${esc(qcDayLabel(q2.target))}).</p>${q2.weekend?`<p>Ventana excepcional: ${esc(qcDisplayDate(q2.windowStart))} – ${esc(qcDisplayDate(q2.windowEnd))}. Días hábiles: jueves, viernes, lunes y martes.</p>`:'<p>Sin ajuste por fin de semana.</p>'}<p class="qc150-muted">El ciclo siguiente siempre parte de la fecha objetivo, no de la ejecución.</p></div>`:`<div class="qc150-detail"><strong>Programación Q1</strong><p>Fase: ${esc(phase)}. Frecuencia de 2 días calendario; martes a jueves con análisis, viernes solo si existe análisis ejecutado. Lunes y fines de semana no programables.</p>${plan.hasPlanned?`<p>${plan.plannedCount} muestra(s) previstas para ${esc(qcDisplayDate(next))}.</p>`:'<p>No hay muestra prevista en una jornada habilitada.</p>'}${q1Candidate?`<p>🟢 Jornada ejecutada propuesta: ${esc(qcDisplayDate(q1Candidate.date))} (${q1Candidate.executedCodes.size} muestra(s)). Ventana ±2 días respecto a ${esc(qcDisplayDate(base))}.</p>`:`<p>Ventana de ejecución: ${esc(qcDisplayDate(plannerAddDays(base,-2)))} – ${esc(qcDisplayDate(plannerAddDays(base,2)))}. Sin jornada ejecutada elegible.</p>`}</div>`;
  const strainNames={'29212':'Enterococcus faecalis','14028':'Salmonella Typhimurium','11775':'Escherichia coli','13883':'Klebsiella pneumoniae'};const warningDetail=warnings.length?`<details class="qc150-disclosure"><summary>⚠ Ver recursos faltantes <b>${warnings.length}</b></summary><div class="qc150-warnings">${warnings.map(w=>`<div class="qc-planner-warning"><span>${esc(w.page==='strains'?w.text.replace('ATCC '+w.atcc,(strainNames[String(w.atcc)]||'Cepa de referencia')+' · ATCC '+w.atcc):w.text)}</span><button type="button" class="secondary" data-qc-go="${w.page}" data-qc-atcc="${esc(w.atcc||'')}">${w.page==='media'?'Ir a medios':'Reactivar cepa →'}</button></div>`).join('')}</div></details>`:plannerLoaded?'<span class="qc150-resource-ok">✓ Recursos verificados</span>':'<span class="qc150-muted">Consultando recursos…</span>';
  const lastDate=last?.date?qcDisplayDate(last.date):'Sin evaluación concluida';
  const nextDate=q==='Q3'&&!pending.length&&unreviewed.length?'Por determinar':qcDisplayDate(next);
  const resourceText=!plannerLoaded?'Verificando disponibilidad':warnings.length?`${warnings.length} requisito(s) por resolver`:'Recursos verificados';
  const actionText=q==='Q3'&&unreviewed.length&&!pending.length?'Revisar jornadas sin evaluación':status==='LISTO'?'Registrar evaluación':status==='PROGRAMADO'||status==='PREVISTO'?'Esperar ejecución':'Revisar programación y recursos';
  const historicalAlert=q==='Q3'&&unreviewed.some(r=>r.date==='2026-04-21')?'<div class="qc287-audit">21/04/2026: existe una jornada ejecutada sin evaluación Q3 reconocida en los datos cargados. Revisar su expediente antes de clasificarla como pendiente.</div>':'';
  return `<article class="qc-planner-card qc150-card qc150-${tone}"><div class="qc-planner-title"><strong>${icon} ${q} · ${esc(title)}</strong><span class="qc-planner-pill qc150-pill">${esc(status)}</span></div><div class="qc287-timeline"><div><small>Última evaluación concluida</small><strong>${esc(lastDate)}</strong></div><div><small>${label}</small><strong>${esc(nextDate)}</strong></div></div><div class="qc287-resource"><span>Recursos</span><b>${esc(resourceText)}</b></div><div class="qc287-actionhint"><span>Acción requerida</span><strong>${esc(actionText)}</strong></div>${historicalAlert}<div class="qc-planner-date qc150-date qc287-legacy-date"><small>${label}</small><strong>${esc(qcDisplayDate(next))}</strong><small>${q==='Q3'?`${pending.length} pendiente(s) explícitos · ${unreviewed.length} sin evaluación · ${planned.length} prevista(s)`:last?'Último control: '+esc(qcDisplayDate(last.date)):'Sin control anterior documentado'}</small></div><div class="qc150-summary">${q==='Q3'?`<span class="qc150-stat"><b>${pending.length}</b> pendientes documentados</span><span class="qc150-stat"><b>${unreviewed.length}</b> sin evaluación</span><span class="qc150-stat"><b>${planned.length}</b> previstas</span>`:q==='Q2'?`<span class="qc150-stat">${q2.weekend?'🟡 Ajuste por fin de semana':'📅 Fecha ordinaria'}</span>${`<span class="qc150-stat">🟢 Ejecución sugerida: ${esc(qcDisplayDate(q2Suggested))}</span>`+(q2.weekend?`<span class="qc150-stat">${esc(qcDisplayDate(q2.windowStart))} – ${esc(qcDisplayDate(q2.windowEnd))}</span>`:'')}`:`<span class="qc150-stat">${esc(phase)}</span><span class="qc150-stat">${q1Candidate?'🟢 Ejecución sugerida: '+qcDisplayDate(q1Candidate.date):plan.hasPlanned?plan.plannedCount+' muestra(s) previstas':'Sin muestra prevista'}</span>`}</div><details class="qc150-disclosure"><summary>Ver ${q==='Q3'?'jornadas':'programación'} <span aria-hidden="true">⌄</span></summary>${details}</details><div class="qc150-bottom">${warningDetail}<button type="button" class="secondary qc150-action" data-qc-evaluate="${q}" data-qc-base="${base}" data-qc-candidate="${q1Candidate?.id||''}" ${!ready||!hasExecution||!eligible?'disabled':''}>${q==='Q3'?'Evaluar Q3':'Registrar '+q}</button></div></article>`;
 });
 return `<section class="card sample-section qc-planner qc150-planner" aria-label="Planificador inteligente de controles"><div class="qc-planner-head"><div><h2>Planificador QC inteligente</h2><p>Fechas objetivo, ejecución real y recursos en un solo lugar.</p></div><button type="button" class="secondary" id="qc-planner-refresh">↻ Actualizar recursos</button></div>${plannerError?`<p class="qc-planner-error">${esc(plannerError)}</p>`:''}<div class="qc-planner-grid">${cards.join('')}</div><details class="qc150-help"><summary>ⓘ Criterios de programación QC</summary><p>Q1: cada 2 días calendario; martes a jueves como días ordinarios y viernes solo con análisis ejecutado; lunes y fines de semana no programables. Q2: ciclo fijo de 15 días; ventana jueves–martes solo cuando la fecha objetivo cae en fin de semana. Q3: una evaluación por jornada real y parámetro con ensayos ejecutados. Una muestra prevista no acredita ejecución ni conformidad.</p></details></section>`;
};
const dailySection=editable=>`<section class="card sample-section micro-modern-section"><div class="micro-section-header"><div><span class="micro-section-eyebrow">CONTROL DE CALIDAD · Q1 / Q2 / Q3</span><h2>Jornadas analíticas</h2><p>Seguimiento de controles asociados a fechas reales de ejecución.</p></div><span class="micro-section-chip">Trazabilidad QC</span></div><p>Se muestran las jornadas programadas según la fecha prevista y las ejecutadas según la fecha real del ensayo. Solo las ejecutadas habilitan la evaluación Q1/Q2/Q3; las programadas son informativas y no acreditan ejecución. Los criterios de frecuencia y de medios se validan en el planificador QC.</p><div class="sample-table-wrap"><table class="sample-table"><thead><tr><th>Fecha</th><th>Parámetro</th><th>Muestras</th><th>Actividad</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Registro</th></tr></thead><tbody>${dailyRows().map(row=>{const c=dailyControls.find(x=>x.id===row.id);const done=row.executedCodes.size>0;const badge=q=>q==='Q1'&&!q1EligibleRow(row)?'🔵 NO PROGRAMABLE':!done?(row.date<plannerDay()?'🟠 PROGRAMACIÓN ATRASADA':'🔵 PROGRAMADO'):c?.controls?.[q]?.status==='CONFORME'?'🟢 CONFORME':c?.controls?.[q]?.status==='NO_CONFORME'?'🔴 NO CONFORME':c?.controls?.[q]?.status==='NO_APLICA'?'🔵 NO APLICA':q==='Q1'&&!q1EligibleRow(row)?'🔵 NO PROGRAMABLE':!qcDueForDate(q,row.date)?'🔵 NO PROGRAMADO':'🟡 SIN EVALUAR';return `<tr><td>${esc(row.date)}</td><td>${esc(row.parameter)}</td><td>${esc([...row.executedCodes].join(', '))}${row.plannedItems.length?`<div class="qc-planned-links">${row.plannedItems.map(item=>`<button type="button" class="secondary qc-open-planned" data-qc-open-sample="${esc(item.id)}" title="${esc(item.time+' · '+item.analyst)}">${esc(item.code)}</button>`).join('')}</div>`:''}</td><td>${done?`<strong>${row.executedCodes.size} ejecutada(s)</strong>${row.plannedCodes.size?`<br><small>${row.plannedCodes.size} programada(s)</small>`:''}`:`<span class="sample-status">${row.date<plannerDay()?'🟠 PROGRAMACIÓN ATRASADA':'🔵 PROGRAMADA'} · ${row.plannedCodes.size} muestra(s)</span>`}</td><td>${badge('Q1')}</td><td>${badge('Q2')}</td><td>${badge('Q3')}</td><td>${editable&&done?`<button type="button" class="secondary" data-daily="${esc(row.id)}">${c?'Ver / actualizar':'Evaluar jornada'}</button>`:done?'Solo lectura':'Pendiente de ejecución'}</td></tr>`;}).join('')||'<tr><td colspan="8">No hay jornadas de análisis registradas.</td></tr>'}</tbody></table></div><p class="qc-date-guidance">La fecha real del ensayo determina la jornada; recepción y programación permanecen en el expediente. Los controles compartidos entre métodos requieren autorización documental. Un registro histórico no genera consumos actuales.</p><div id="micro-daily-editor"></div></section>`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// Tabla 9221 B, transcripción verificada de las imágenes suministradas.
// Las combinaciones no presentes NO se interpolan ni se estiman.
// Standard Methods 9221:IV, 5 tubos por dilución (10, 1 y 0,1 mL).
// La tabla normativa contiene 95 combinaciones frecuentes, no las 216 posibles.
// Las combinaciones atípicas se estiman mediante máxima verosimilitud (no se atribuyen a la tabla).
const NMP_555 = new Map(`0 0 0 <1.8 - 6.8
0 0 1 1.8 .090 6.8
0 1 0 1.8 .090 6.9
0 1 1 3.6 .70 10
0 2 0 3.7 .70 10
0 2 1 5.5 1.8 15
0 3 0 5.6 1.8 15
1 0 0 2.0 .10 10
1 0 1 4.0 .70 10
1 0 2 6.0 1.8 15
1 1 0 4.0 .71 12
1 1 1 6.1 1.8 15
1 1 2 8.1 3.4 22
1 2 0 6.1 1.8 15
1 2 1 8.2 3.4 22
1 3 0 8.3 3.4 22
1 3 1 10 3.5 22
1 4 0 10 3.5 22
2 0 0 4.5 .79 15
2 0 1 6.8 1.8 15
2 0 2 9.1 3.4 22
2 1 0 6.8 1.8 17
2 1 1 9.2 3.4 22
2 1 2 12 4.1 26
2 2 0 9.3 3.4 22
2 2 1 12 4.1 26
2 2 2 14 5.9 36
2 3 0 12 4.1 26
2 3 1 14 5.9 36
2 4 0 15 5.9 36
3 0 0 7.8 2.1 22
3 0 1 11 3.5 23
3 0 2 13 5.6 35
3 1 0 11 3.5 26
3 1 1 14 5.6 36
3 1 2 17 6.0 36
3 2 0 14 5.7 36
3 2 1 17 6.8 40
3 2 2 20 6.8 40
3 3 0 17 6.8 40
3 3 1 21 6.8 40
3 3 2 24 9.8 70
3 4 0 21 6.8 40
3 4 1 24 9.8 70
3 5 0 25 9.8 70
4 0 0 13 4.1 35
4 0 1 17 5.9 36
4 0 2 21 6.8 40
4 0 3 25 9.8 70
4 1 0 17 6.0 40
4 1 1 21 6.8 42
4 1 2 26 9.8 70
4 1 3 31 10 70
4 2 0 22 6.8 50
4 2 1 26 9.8 70
4 2 2 32 10 70
4 2 3 38 14 100
4 3 0 27 9.9 70
4 3 1 33 10 70
4 3 2 39 14 100
4 4 0 34 14 100
4 4 1 40 14 100
4 4 2 47 15 120
4 5 0 41 14 100
4 5 1 48 15 120
5 0 0 23 6.8 70
5 0 1 31 10 70
5 0 2 43 14 100
5 0 3 58 22 150
5 1 0 33 10 100
5 1 1 46 14 120
5 1 2 63 22 150
5 1 3 84 34 220
5 2 0 49 15 150
5 2 1 70 22 170
5 2 2 94 34 230
5 2 3 120 36 250
5 2 4 150 58 400
5 3 0 79 22 220
5 3 1 110 34 250
5 3 2 140 52 400
5 3 3 170 70 400
5 3 4 210 70 400
5 4 0 130 36 400
5 4 1 170 58 400
5 4 2 220 70 440
5 4 3 280 100 710
5 4 4 350 100 710
5 4 5 430 150 1100
5 5 0 240 70 710
5 5 1 350 100 1100
5 5 2 540 150 1700
5 5 3 920 220 2600
5 5 4 1600 400 4600
5 5 5 >1600 700 -`.trim().split('\n').map(line=>{const [a,b,c,value,low,high]=line.split(' ');return [`${a}-${b}-${c}`,{value,low,high,source:'TABLE'}];}));
// Estimación de máxima verosimilitud para patrones no incluidos en la tabla.
// P(positivo) = 1-exp(-lambda * volumen), lambda en organismos/mL.
function nmpEstimate555(tubes){
 const volumes=[10,1,0.1];
 const score=lambda=>tubes.reduce((sum,k,i)=>{const x=lambda*volumes[i];return sum+volumes[i]*(k/Math.expm1(x)-(5-k));},0);
 let lo=1e-12,hi=1;
 while(score(hi)>0&&hi<1e12)hi*=2;
 for(let i=0;i<110;i++){const mid=(lo+hi)/2;if(score(mid)>0)lo=mid;else hi=mid;}
 const estimate=(lo+hi)*50;
 return {value:String(Number(estimate.toPrecision(2))),low:'-',high:'-',source:'ESTIMATED'};
}
const NMP_10 = [
 ['<1.1','-','3.4'],['1.1','0.051','5.9'],['2.2','0.37','8.2'],['3.6','0.91','9.7'],
 ['5.1','1.6','13'],['6.9','2.5','15'],['9.2','3.3','19'],['12','4.8','24'],
 ['16','5.8','34'],['23','8.1','53'],['>23','13','-']
].map(([value,low,high])=>({value,low,high}));
function nmpLookup(type,tubes){
 const potable=['Agua potable','Agua de consumo'].includes(type);
 if(potable){const n=tubes[0];return Number.isInteger(n)&&n>=0&&n<=10&&tubes.slice(1).every(x=>x===null)?NMP_10[n]:null;}
 return tubes.every(x=>Number.isInteger(x)&&x>=0&&x<=5)?NMP_555.get(tubes.join('-'))||nmpEstimate555(tubes):null;
}
function scaledNmp(value,factor){if(!value||!(factor>0))return '—';const match=String(value).match(/^([<>]?)([\d.]+)$/);if(!match)return '—';return match[1]+(Number(match[2])*factor).toLocaleString('es-EC',{maximumFractionDigits:5});}

const parameters=['Coliformes fecales','Coliformes totales','E. coli'];
let unsub=null,records=[],selected='',message='',editingCode=null,editingOfficial=null,catalog={companies:[],branches:[],descriptions:[]};
const field=(name,label,type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" ${extra}></label>`;
// V1.0.255: reloj 24 horas accesible; mantiene los campos Firestore sampleTime/receivedTime.
const easyTime=(name,label)=>`<label class="sample-easy-time">${label}<span class="sample-time-controls"><select data-time-hour="${name}" aria-label="Hora ${label}" required><option value="">Hora</option>${Array.from({length:24},(_,i)=>`<option value="${String(i).padStart(2,'0')}">${String(i).padStart(2,'0')}</option>`).join('')}</select><span class="sample-time-separator">:</span><select data-time-minute="${name}" aria-label="Minutos ${label}" required>${Array.from({length:12},(_,i)=>`<option value="${String(i*5).padStart(2,'0')}" ${i===0?'selected':''}>${String(i*5).padStart(2,'0')}</option>`).join('')}</select></span><input type="hidden" name="${name}" value=""></label>`;
const bindEasyTime=form=>{
 const sync=name=>{const hour=form.querySelector(`[data-time-hour="${name}"]`),minute=form.querySelector(`[data-time-minute="${name}"]`),hidden=form.elements[name];if(!hour||!minute||!hidden)return;hidden.value=hour.value!==''&&minute.value!==''?`${hour.value}:${minute.value}`:'';};
 for(const name of ['sampleTime','receivedTime']){for(const part of ['hour','minute'])form.querySelector(`[data-time-${part}="${name}"]`)?.addEventListener('change',()=>sync(name));}
};
const setEasyTime=(form,name,value)=>{const match=/^(\d{2}):(\d{2})/.exec(value||'');const h=form.querySelector(`[data-time-hour="${name}"]`),m=form.querySelector(`[data-time-minute="${name}"]`);if(h)h.value=match?.[1]||'';if(m){const minute=match?.[2]||'00';if(match && !Array.from(m.options).some(o=>o.value===minute)){const option=document.createElement('option');option.value=minute;option.textContent=minute+' (histórico)';m.appendChild(option);}m.value=minute;}if(form.elements[name])form.elements[name].value=match?`${match[1]}:${match[2]}`:'';};
const select=(name,label,options)=>`<label>${label}<select name="${name}">${options.map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>`;
const opts=values=>[['','Seleccione'],...values.map(v=>[v,v])];
const now=()=>new Date().toISOString().slice(0,10);
function allowed(profile){return ['ADMIN','JEFE'].includes(profile.role)||profile.permissions?.samples==='WRITE';}
function numericNmp(v){
 // Los resultados NMP históricos usan formato es-EC: 1.600 = 1600,
 // mientras que 1,8 / 1.8 representan un decimal. No confundir miles con decimales.
 const raw=String(v??'').trim().replace(/\s/g,'');
 if(!raw || /^[<>≤≥]/.test(raw))return null;
 let normalized=raw;
 if(/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw)){
  normalized=raw.replace(/\./g,'').replace(',','.');
 }else if(/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw)){
  normalized=raw.replace(/,/g,'');
 }else if(/^\d+(?:,\d+)?$/.test(raw)){
  normalized=raw.replace(',','.');
 }
 return /^\d+(?:\.\d+)?$/.test(normalized)?Number(normalized):null;
}
// Diferencia logarítmica decimal entre NMP cuantificables positivos.
// Resultados censurados (<, >) no admiten un cálculo puntual verificable.
function duplicateEvaluations(items){
 return items.filter(r=>r.parentId).flatMap(r=>{
  const parent=items.find(x=>x.id===r.parentId);
  return (r.parameters||[]).map(parameter=>{
   const first=parent?.analysis?.nmpResults?.[parameter]?.result;
   const second=r.analysis?.nmpResults?.[parameter]?.result;
   const parse=v=>{const t=String(v??'').trim().replace(',','.');if(/^<\s*1\.8$/.test(t))return {value:1.8,substituted:true};return {value:numericNmp(v),substituted:false};};
   const x=parse(first),y=parse(second),ready=parent?.status==='FINISHED'&&r.status==='FINISHED';
   const unsupported=[first,second].some(v=>/^[<>≤≥]/.test(String(v??'').trim())&&!/^<\s*1[,.]8$/.test(String(v??'').trim()));
   const pki=ready&&!unsupported&&x.value>0&&y.value>0?Math.abs(Math.log10(x.value)-Math.log10(y.value)):null;
   const estimated=x.substituted||y.substituted;
   const category=pki===null?'':pki<=0.10?'EXCELENTE':pki<=0.20?'ACEPTABLE':pki<=0.30?'EN SEGUIMIENTO':'NO CONFORME';
   const verdict=!ready?'PENDIENTE':pki===null?'NO EVALUABLE':estimated?`${category} · ESTIMADO (<1,8→1,8)`:category;
   return {parent,r,parameter,first,second,pki,estimated,verdict,category};
  });
 });
}
// Exportaciones generadas desde la misma instantánea local que alimenta el panel.
const exportHeaders=['Código','Origen','Tipo de muestra','Parámetro','Empresa','Sucursal','Descripción','Fecha recepción','Hora recepción','Fecha análisis','Analista','Tabla NMP','Tubos positivos','Factor dilución','NMP/100 mL','IC 95% inferior','IC 95% superior','Estado'];
function exportRows(items,parameter='',query=''){
 return items.filter(r=>r.status==='FINISHED').flatMap(r=>(r.parameters||[]).filter(p=>(!parameter||p===parameter)&&(!query||[r.code,r.parentId?'DUPLICADO':'ORIGINAL',r.type,p,r.company,r.branch,r.analyst,r.receivedDate,r.analysis?.date,r.analysis?.nmpResults?.[p]?.result].some(v=>String(v??'').toLocaleLowerCase('es').includes(query)))).map(p=>{const n=r.analysis?.nmpResults?.[p]||{};return [r.code,r.parentId?'DUPLICADO':'ORIGINAL',r.type,p,r.company||'',r.branch||'',r.description||'',r.receivedDate||'',r.receivedTime||'',r.analysis?.date||'',r.analyst||'',n.table||'',(r.analysis?.tubes?.[p]||[]).filter(x=>x!==null).join(' / '),n.dilution??'',n.result||'',n.lower||'',n.upper||'',r.status];}));
}
function exportSelection(el){
 const month=el.querySelector('#micro-month')?.value||'',year=el.querySelector('#micro-year')?.value||'',type=el.querySelector('#micro-type')?.value||'',company=el.querySelector('#micro-company')?.value||'';
 const parameter=el.querySelector('#micro-export-parameter')?.value||'';
 const query=(el.querySelector('#micro-results-search')?.value||'').trim().toLocaleLowerCase('es');
 const items=records.filter(r=>{
  const date=String(r.analysis?.date||r.receivedDate||'');
  const matched=(!month||date.slice(5,7)===month)&&(!year||date.slice(0,4)===year)&&(!type||r.type===type)&&(!company||r.company===company);
  if(!matched)return false;
  const parameters=(r.parameters||[]).filter(p=>!parameter||p===parameter);
  if(!parameters.length)return false;
  return !query||parameters.some(p=>[r.code,r.parentId?'DUPLICADO':'ORIGINAL',r.type,p,r.company,r.branch,r.analyst,r.receivedDate,r.analysis?.date,r.analysis?.nmpResults?.[p]?.result].some(v=>String(v??'').toLocaleLowerCase('es').includes(query)));
 });
 return {parameter,items,query};
}
function exportName(parameter,ext){return 'LAB_PSI_MICROBIOLOGIA_'+(parameter?parameter.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').toUpperCase():'TODOS_LOS_PARAMETROS')+'_'+new Date().toISOString().slice(0,10)+'.'+ext;}
async function downloadMicroExcel(el){
 const {parameter,items,query}=exportSelection(el),rows=exportRows(items,parameter,query);if(!rows.length){feedback(el,'No hay resultados finalizados para exportar con estos filtros.');return;}
 const evaluations=duplicateEvaluations(items).filter(e=>!parameter||e.parameter===parameter);
 const table=(head,data)=>`<table border="1"><thead><tr>${head.map(v=>`<th style="background:#d8eee7;font-weight:bold">${esc(v)}</th>`).join('')}</tr></thead><tbody>${data.map(row=>`<tr>${row.map(v=>`<td>${esc(v===null||v===undefined?'':v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>body{font-family:Arial}h2{color:#146d57}td,th{padding:5px}</style></head><body><h2>LAB-PSI | RESULTADOS MICROBIOLÓGICOS</h2><p>Parámetro: ${esc(parameter||'Todos')} · Emisión: ${esc(new Date().toLocaleString('es-EC'))}</p><h3>Resultados por muestra</h3>${table(exportHeaders,rows)}<h3>Control de duplicados · Δlog10</h3>${table(['Original','Duplicado','Parámetro','NMP original','NMP duplicado','PKI','Evaluación'],evaluations.map(e=>[e.parent?.code||'',e.r.code,e.parameter,e.first||'',e.second||'',e.pki===null?'':(e.estimated?'≈':'')+e.pki.toFixed(4),e.verdict]))}<p>Índice Δlog10 = |log10(NMP original) − log10(NMP duplicado)|. Los valores <1,8 se sustituyen por 1,8 solo para evaluación orientativa y se marcan ESTIMADO. Los límites requieren validación documental.</p></body></html>`;
 const blob=new Blob(['\ufeff',html],{type:'application/vnd.ms-excel;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=exportName(parameter,'xls');document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
}
function downloadMicroPdf(el){
 const {parameter,items,query}=exportSelection(el),rows=exportRows(items,parameter,query);if(!rows.length){feedback(el,'No hay resultados finalizados para exportar con estos filtros.');return;}
 const evaluations=duplicateEvaluations(items).filter(e=>!parameter||e.parameter===parameter),fmtCell=v=>esc(v===null||v===undefined?'—':v);
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>LAB-PSI · Informe microbiológico</title><style>@page{size:A4 landscape;margin:13mm}body{font-family:Arial,sans-serif;color:#203633;font-size:10px}header{border-bottom:3px solid #147660;padding-bottom:12px;margin-bottom:16px}h1{font-size:22px;margin:0;color:#135c4d}h2{font-size:15px;margin-top:22px;color:#135c4d}small{color:#526762}.summary{display:flex;gap:12px;margin:15px 0}.tile{border:1px solid #cbded9;padding:12px;border-radius:8px;min-width:120px}.tile b{display:block;font-size:18px;color:#12654f}table{width:100%;border-collapse:collapse;font-size:8px;table-layout:auto}th{background:#e9f3f0;text-align:left}td,th{border-bottom:1px solid #dce6e3;padding:6px 4px;vertical-align:top}tr{break-inside:avoid}footer{margin-top:20px;border-top:1px solid #ddd;padding-top:9px;color:#64736f}.note{padding:10px;background:#f4f8f7;border-left:3px solid #147660}@media print{button{display:none}}</style></head><body><header><h1>LAB-PSI | Consolidado microbiológico</h1><small>Parámetro: ${fmtCell(parameter||'Todos')} · Emisión: ${fmtCell(new Date().toLocaleString('es-EC'))} · Datos sincronizados disponibles en la sesión</small></header><div class="summary"><div class="tile">Resultados<b>${rows.length}</b></div><div class="tile">Muestras finalizadas<b>${items.filter(r=>r.status==='FINISHED').length}</b></div><div class="tile">Duplicados<b>${items.filter(r=>r.parentId).length}</b></div><div class="tile">PKI calculados<b>${evaluations.filter(e=>e.pki!==null).length}</b></div></div><h2>Resultados por muestra y parámetro</h2><table><thead><tr>${exportHeaders.map(h=>`<th>${fmtCell(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${fmtCell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table><h2>Control de duplicados</h2><table><thead><tr><th>Original</th><th>Duplicado</th><th>Parámetro</th><th>NMP original</th><th>NMP duplicado</th><th>PKI</th><th>Evaluación</th></tr></thead><tbody>${evaluations.map(e=>`<tr>${[e.parent?.code,e.r.code,e.parameter,e.first,e.second,e.pki===null?'—':(e.estimated?'≈':'')+e.pki.toFixed(3),e.verdict].map(v=>`<td>${fmtCell(v)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="7">Sin duplicados para este filtro.</td></tr>'}</tbody></table><p class="note">Índice Δlog10 = |log10(NMP original) − log10(NMP duplicado)|. Los resultados <1,8 se sustituyen por 1,8 exclusivamente para evaluación orientativa, marcada ESTIMADO; no son valores cuantificados. Los límites internos requieren validación documental.</p><footer>LAB-PSI · Informe operativo generado desde el ERP. No sustituye un informe de ensayo autorizado.</footer><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));<\/script></body></html>`;
 const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),win=window.open(url,'_blank');if(!win){URL.revokeObjectURL(url);feedback(el,'Permita ventanas emergentes para imprimir o guardar el PDF.');return;}setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function consolidatedSection(items){
 const finished=items.filter(r=>r.status==='FINISHED');
 const results=finished.flatMap(r=>(r.parameters||[]).map(p=>({r,p,n:r.analysis?.nmpResults?.[p]})));
 const duplicates=items.filter(r=>r.parentId),evaluations=duplicateEvaluations(items);
 const evaluated=evaluations.filter(e=>e.pki!==null&&!e.estimated);
 const compliant=evaluations.filter(e=>e.pki!==null&&e.pki<=0.30);
 const fmt=v=>v===undefined||v===null||v===''?'—':esc(v);
 const pct=(n,total)=>total?Math.round(n/total*100):0;
 const statuses=[['Resultados listos',finished.length],['Pendientes',items.filter(r=>r.status==='ASSIGNED').length],['Sin ingreso oficial',items.filter(r=>r.status==='RECEIVED').length]];
 const performance=[['Excelente',evaluations.filter(e=>e.category==='EXCELENTE').length],['Aceptable',evaluations.filter(e=>e.category==='ACEPTABLE').length],['En seguimiento',evaluations.filter(e=>e.category==='EN SEGUIMIENTO').length],['No conforme',evaluations.filter(e=>e.category==='NO CONFORME').length],['No evaluable',evaluations.filter(e=>e.pki===null).length]];
 const bar=(label,n,total)=>`<div class="micro-bar-row"><span>${esc(label)}</span><div class="micro-bar-track"><div class="micro-bar-fill ${label==='En seguimiento'?'micro-bar-warning':label==='No conforme'?'micro-bar-danger':label==='No evaluable'?'micro-bar-muted':''}" style="width:${pct(n,total)}%"></div></div><strong>${n}</strong></div>`;
 const options=(values)=>values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
 const years=[...new Set(items.map(r=>String(r.analysis?.date||r.receivedDate||'').slice(0,4)).filter(Boolean))].sort().reverse();
 const companies=[...new Set(items.map(r=>r.company).filter(Boolean))].sort();
 const types=[...new Set(items.map(r=>r.type).filter(Boolean))].sort();
 return `<section class="card sample-section micro-modern-section"><div class="micro-section-header"><div><span class="micro-section-eyebrow">INFORMES · INDICADORES</span><h2>Resultados y NMP</h2><p>Consulte resultados confirmados, filtre el histórico y exporte informes sin alterar los expedientes.</p></div><span class="micro-section-chip">Consolidado analítico</span></div><div class="micro-export-tools"><label>Informe por parámetro <select id="micro-export-parameter"><option value="">Todos los parámetros</option>${parameters.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select></label><button type="button" id="micro-export-excel">⬇ Excel detallado</button><button type="button" class="secondary" id="micro-export-pdf">🖨 PDF detallado</button></div><p>Resultados confirmados en Firebase. Los filtros y gráficos se calculan en el navegador sin nuevas lecturas.</p>
 <div class="micro-quicksearch"><label>⌕ Buscar en resultados cargados <input id="micro-results-search" type="search" autocomplete="off" placeholder="Código, empresa, sucursal, parámetro o analista…"></label><span id="micro-results-count" role="status"></span></div><div class="micro-filters"><label>Mes<select id="micro-month"><option value="">Todos</option>${Array.from({length:12},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}">${new Intl.DateTimeFormat('es',{month:'long'}).format(new Date(2026,i,1))}</option>`).join('')}</select></label><label>Año<select id="micro-year"><option value="">Todos</option>${options(years)}</select></label><label>Tipo de muestra<select id="micro-type"><option value="">Todos</option>${options(types)}</select></label><label>Empresa<select id="micro-company"><option value="">Todas</option>${options(companies)}</select></label><button type="button" class="secondary" id="micro-clear-filters">Limpiar filtros</button></div>
 <div id="micro-filtered-summary"><div class="sample-kpis"><div class="card"><small>Originales</small><h2 data-metric="originals">${items.filter(r=>!r.parentId).length}</h2></div><div class="card"><small>Analizadas</small><h2 data-metric="finished">${finished.length}</h2></div><div class="card"><small>Pendientes</small><h2 data-metric="pending">${items.filter(r=>r.status!=='FINISHED').length}</h2></div><div class="card"><small>Duplicados</small><h2 data-metric="duplicates">${duplicates.length}</h2></div><div class="card"><small>Duplicados evaluados</small><h2 data-metric="evaluated">${evaluated.length}</h2></div></div>
 <div class="sample-kpis"><div class="card"><small>Cumplimiento de duplicados evaluables</small><h2 data-metric="compliance">${evaluated.length?pct(compliant.length,evaluated.length)+'%':'—'}</h2></div><div class="card"><small>NMP &lt;1,8</small><h2 data-metric="low">${results.filter(x=>String(x.n?.result||'').startsWith('<')).length}</h2></div><div class="card"><small>NMP &gt;200</small><h2 data-metric="high">${results.filter(x=>numericNmp(x.n?.result)>200).length}</h2></div><div class="card"><small>Promedio NMP cuantificable</small><h2 data-metric="average">—</h2></div><div class="card"><small>Máximo NMP cuantificable</small><h2 data-metric="maximum">—</h2></div></div>
 <div class="micro-charts"><div class="micro-chart"><h3>Estado analítico</h3><div id="micro-status-bars">${statuses.map(([name,n])=>bar(name,n,items.length)).join('')}</div></div><div class="micro-chart"><h3>Desempeño de duplicados</h3><div id="micro-performance-bars">${performance.map(([name,n])=>bar(name,n,evaluations.length)).join('')}</div><small>Semáforo orientativo interno: ≤0,10 excelente; ≤0,20 aceptable; ≤0,30 seguimiento; >0,30 no conforme. Requiere validación documental.</small></div></div></div>
 <div class="sample-table-wrap"><table class="sample-table"><thead><tr><th>Código</th><th>Origen</th><th>Tipo</th><th>Parámetro</th><th>Empresa</th><th>Sucursal</th><th>Recepción</th><th>Fecha análisis</th><th>Analista</th><th>Tubos positivos</th><th>Factor</th><th>NMP/100 mL</th><th>Estado</th></tr></thead><tbody id="micro-results-body">${results.map(({r,p,n})=>`<tr data-result-id="${esc(r.id)}"><td><b>${esc(r.code)}</b></td><td>${r.parentId?'DUPLICADO':'ORIGINAL'}</td><td>${fmt(r.type)}</td><td>${esc(p)}</td><td>${fmt(r.company)}</td><td>${fmt(r.branch)}</td><td>${fmt(r.receivedDate)} ${fmt(r.receivedTime)}</td><td>${fmt(r.analysis?.date)}</td><td>${fmt(r.analyst)}</td><td>${fmt((r.analysis?.tubes?.[p]||[]).join(' / '))}</td><td>${fmt(n?.dilution)}</td><td><b>${fmt(n?.result)}</b></td><td><span class="sample-status sample-ok">FINALIZADO</span></td></tr>`).join('')||'<tr><td colspan="13">No hay resultados finalizados.</td></tr>'}</tbody></table></div></section>
 <section class="card sample-section micro-modern-section"><div class="micro-section-header"><div><span class="micro-section-eyebrow">ASEGURAMIENTO DE CALIDAD</span><h2>Control de duplicados · Δlog10</h2><p>Comparación de resultados entre muestras originales y duplicadas.</p></div><span class="micro-section-chip">Evaluación por parámetro</span></div><div class="micro-duplicate-summary"><span><strong>${evaluations.length}</strong> comparaciones</span><span><strong>${evaluations.filter(e=>e.pki!==null).length}</strong> calculadas</span><span><strong>${evaluations.filter(e=>e.pki===null).length}</strong> pendientes</span></div><p>Δlog10 = |log10(NMP original) − log10(NMP duplicado)|. Para visualización, &lt;1,8 se sustituye por 1,8 y se identifica como ESTIMADO; no equivale a un valor medido. Semáforo interno: ≤0,10 excelente; ≤0,20 aceptable; ≤0,30 seguimiento; &gt;0,30 no conforme. Validar límites antes de aprobación formal.</p><div class="sample-table-wrap"><table class="sample-table"><thead><tr><th>Original</th><th>Duplicado</th><th>Parámetro</th><th>V1 NMP</th><th>V2 NMP</th><th>PKI</th><th>Evaluación</th></tr></thead><tbody>${evaluations.map(e=>`<tr><td>${fmt(e.parent?.code)}</td><td>${fmt(e.r.code)}</td><td>${fmt(e.parameter)}</td><td>${fmt(e.first)}</td><td>${fmt(e.second)}</td><td>${e.pki===null?'—':(e.estimated?'≈':'')+e.pki.toFixed(3)}</td><td><span class="sample-status ${e.category==='EXCELENTE'||e.category==='ACEPTABLE'?'sample-ok':e.category==='NO CONFORME'?'sample-danger':e.category==='EN SEGUIMIENTO'?'sample-warning':''}">${esc(e.verdict)}</span></td></tr>`).join('')||'<tr><td colspan="7">Sin duplicados.</td></tr>'}</tbody></table></div></section>`;
}
function attachTablePagination(root){
 root.querySelectorAll('.sample-section .sample-table-wrap').forEach(wrap=>{
  const table=wrap.querySelector('table'),body=table?.tBodies?.[0];
  // La tabla de jornadas QC ya tiene un único paginador inteligente (qc-history-235).
  // No agregar un segundo paginador que oculte filas de forma contradictoria.
  if(wrap.closest('.sample-section')?.querySelector('#micro-daily-editor'))return;
  if(!body||wrap.dataset.paged)return;
  const rows=[...body.rows];if(rows.length<=5)return;
  wrap.dataset.paged='1';
  let size=10,page=1;
  const nav=document.createElement('div');nav.className='micro-table-pager';
  nav.innerHTML='<label>Mostrar <select aria-label="Filas por página"><option value="10" selected>10</option><option value="25">25</option><option value="50">50</option></select> registros</label><span class="micro-page-summary"></span><button type="button" class="secondary micro-prev">◀ Anterior</button><button type="button" class="secondary micro-next">Siguiente ▶</button>';
  wrap.after(nav);
  const select=nav.querySelector('select'),prev=nav.querySelector('.micro-prev'),next=nav.querySelector('.micro-next'),summary=nav.querySelector('.micro-page-summary');
  function update(){
   const visible=rows.filter(r=>!r.dataset.filteredOut);
   const pages=size===Infinity?1:Math.max(1,Math.ceil(visible.length/size));page=Math.min(page,pages);
   const start=size===Infinity?0:(page-1)*size,end=size===Infinity?visible.length:start+size;
   rows.forEach(r=>{r.hidden=true;});visible.slice(start,end).forEach(r=>{r.hidden=false;});
   summary.textContent=visible.length?`${start+1}–${Math.min(end,visible.length)} de ${visible.length}`:'Sin registros';
   prev.disabled=page<=1;next.disabled=page>=pages;
  }
  select.onchange=()=>{size=select.value==='all'?Infinity:Number(select.value);page=1;update();};
  prev.onclick=()=>{page--;update();};next.onclick=()=>{page++;update();};
  wrap.microPaginationRefresh=()=>{page=1;update();};update();
 });
}
function bindConsolidated(el){
 const ids=['month','year','type','company'];
 const quick=el.querySelector('#micro-results-search');
 const inputs=ids.map(k=>el.querySelector('#micro-'+k));
 const parameterInput=el.querySelector('#micro-export-parameter');
 const filtered=()=>records.filter(r=>{
  const date=String(r.analysis?.date||r.receivedDate||'');
  return (!inputs[0].value||date.slice(5,7)===inputs[0].value)&&(!inputs[1].value||date.slice(0,4)===inputs[1].value)&&(!inputs[2].value||r.type===inputs[2].value)&&(!inputs[3].value||r.company===inputs[3].value);
 });
 function refresh(){
  const {items:data,parameter}=exportSelection(el),ids=new Set(data.map(r=>r.id));
  const query=(quick?.value||'').trim().toLocaleLowerCase('es');
  let matchingRows=0;
  const selectedRows=exportRows(data,parameter,query);
  const matchingCodes=new Set(selectedRows.map(row=>String(row[0])));
  const fin=data.filter(r=>r.status==='FINISHED'&&matchingCodes.has(String(r.code)));
  const matched=data.filter(r=>matchingCodes.has(String(r.code)));
  const ev=duplicateEvaluations(matched).filter(e=>!parameter||e.parameter===parameter);
  const ok=ev.filter(e=>e.pki!==null&&!e.estimated);
  const nums=selectedRows.map(row=>numericNmp(row[14])).filter(n=>n!==null);
  const set=(key,value)=>{const node=el.querySelector(`[data-metric="${key}"]`);if(node)node.textContent=value;};
  set('originals',matched.filter(r=>!r.parentId).length);set('finished',fin.length);
  set('pending',0);set('duplicates',matched.filter(r=>r.parentId).length);set('evaluated',ok.length);
  set('compliance','—');set('low',selectedRows.filter(row=>String(row[14]||'').startsWith('<')).length);
  set('high',nums.filter(n=>n>200).length);
  set('average',nums.length?(nums.reduce((a,b)=>a+b,0)/nums.length).toLocaleString('es-EC',{maximumFractionDigits:2}):'—');
  set('maximum',nums.length?Math.max(...nums).toLocaleString('es-EC'):'—');
  const bars=(arr,total)=>arr.map(([name,n])=>`<div class="micro-bar-row"><span>${esc(name)}</span><div class="micro-bar-track"><div class="micro-bar-fill ${name==='Aceptable'?'micro-bar-warning':name==='Rechazado'?'micro-bar-danger':name==='No evaluable'?'micro-bar-muted':''}" style="width:${total?Math.round(n/total*100):0}%"></div></div><strong>${n}</strong></div>`).join('');
  el.querySelector('#micro-status-bars').innerHTML=bars([['Resultados listos',fin.length],['Pendientes',data.filter(r=>r.status==='ASSIGNED').length],['Sin ingreso oficial',data.filter(r=>r.status==='RECEIVED').length]],data.length);
  el.querySelector('#micro-performance-bars').innerHTML=bars([['Δlog calculado',ok.length],['No evaluable',ev.filter(e=>e.pki===null).length]],ev.length);
  el.querySelectorAll('#micro-results-body tr[data-result-id]').forEach(row=>{const match=selectedRows.some(result=>String(result[0])===row.cells[0]?.textContent.trim()&&String(result[3])===row.cells[3]?.textContent.trim());row.dataset.filteredOut=match?'':'1';row.hidden=!match;if(match)matchingRows++;});
  const count=el.querySelector('#micro-results-count');if(count)count.textContent=`${matchingRows} resultados coincidentes · exportación con los mismos filtros · datos cargados`;
  el.querySelector('#micro-results-body')?.closest('.sample-table-wrap')?.microPaginationRefresh?.();
 }
 el.querySelector('#micro-export-excel').onclick=()=>downloadMicroExcel(el).catch(err=>feedback(el,'Error al exportar Excel: '+err.message));el.querySelector('#micro-export-pdf').onclick=()=>downloadMicroPdf(el);inputs.forEach(input=>input.addEventListener('change',refresh));parameterInput?.addEventListener('change',refresh);quick?.addEventListener('input',refresh);el.querySelector('#micro-clear-filters').onclick=()=>{inputs.forEach(input=>input.value='');if(parameterInput)parameterInput.value='';if(quick)quick.value='';refresh();};refresh();
}

let sampleViewMode="samples";
let activeSampleTab="reception";
const sampleTabIcons={reception:"📥",official:"📋",analysis:"🧪",consolidated:"📁",results:"📊",duplicates:"🔬",qc:"🛡️"};
// V1.0.255: lectura exclusivamente local del historial ya cargado; sin consultas adicionales.
function showSampleTrace(r){
 const existing=document.getElementById('psi-trace-dialog');if(existing)existing.remove();
 const history=Array.isArray(r.history)?r.history:[];
 const stages=[['RECEIVED','Recepción'],['ASSIGNED','Ingreso oficial'],['FINISHED','Análisis finalizado']];
 const current=stages.findIndex(([state])=>state===r.status);
 const stageHtml=stages.map(([state,label],i)=>`<div class="psi-trace-step ${i<=current?'is-done':''} ${i===current?'is-current':''}"><span class="psi-trace-dot">${i<current?'✓':i===current?'●':i+1}</span><span>${label}</span></div>`).join('');
 const rows=history.map(h=>`<li><strong>${esc(h.action||'Evento')}</strong><span>${esc(h.at||'Fecha no registrada')}</span><small>${esc(h.uid||'Usuario no registrado')}</small></li>`).join('');
 const dialog=document.createElement('dialog');dialog.id='psi-trace-dialog';dialog.className='psi-trace-dialog';
 dialog.innerHTML=`<div class="psi-trace-header"><div><small>EXPEDIENTE · TRAZABILIDAD</small><h2>Muestra ${esc(r.code||'')}</h2><p>${esc(r.type||'')} · ${r.parentId?'Duplicado':'Original'}</p></div><button type="button" class="secondary psi-trace-close" aria-label="Cerrar trazabilidad">✕</button></div><div class="psi-trace-body"><h3>Seguimiento del proceso</h3><div class="psi-trace-steps">${stageHtml}</div><h3>Historial de movimientos</h3>${rows?`<ol class="psi-trace-history">${rows}</ol>`:'<p>No hay movimientos históricos disponibles en este expediente.</p>'}<p class="psi-trace-note">Información del expediente cargado. No modifica datos ni genera consultas a Firebase.</p></div><div class="psi-trace-footer"><button type="button" class="secondary psi-trace-close">Cerrar</button></div>`;
 document.body.appendChild(dialog);dialog.querySelectorAll('.psi-trace-close').forEach(btn=>btn.addEventListener('click',()=>dialog.close()));dialog.addEventListener('close',()=>dialog.remove());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});dialog.showModal();
}
const sampleTabNames={reception:"Recepción",official:"Ingreso oficial",analysis:"Análisis",consolidated:"Registro general",results:"Resultados y NMP",duplicates:"Control de duplicados",qc:"Control de calidad Q1/Q2/Q3"};
function display(el,user,profile){
 // Mantener el formulario analítico montado durante actualizaciones Firebase:
 // recrearlo mientras está abierto destruye sus eventos y los datos escritos.
 if(document.querySelector('#psi-analysis-workspace[open]'))return;
 const editable=allowed(profile);
 const pending=records.filter(r=>r.status==='RECEIVED'&&!r.parentId);
 const assigned=records.filter(r=>r.status==='ASSIGNED');
 el.innerHTML=`<div class="eyebrow">GESTIÓN ANALÍTICA · V${APP_VERSION}</div><h1>Registro de muestras y duplicados</h1><p class="intro">Recepción → ingreso oficial → análisis. Original y duplicado conservan expedientes independientes.</p><div class="sample-kpis"><div class="card"><small>Muestras totales</small><h2>${sampleTotal??'…'}</h2></div><div class="card"><small>Pendientes de ingreso</small><h2>${pendingReady.RECEIVED?pending.length:"…"}</h2></div><div class="card"><small>Pendientes de análisis</small><h2>${pendingReady.ASSIGNED?assigned.length:"…"}</h2></div><div class="card"><small>Duplicados</small><h2>${globalMetrics.duplicates??"…"}</h2></div></div><div class="sample-info">Total registrado: ${sampleTotal??"verificando…"} · Registros cargados para consulta: ${records.length}${sampleTotal!==null&&records.length<sampleTotal?' de '+sampleTotal:''}. ${metricError?metricError+" ":""}${historyError?historyError:historyAutoRunning?"Consulta histórica activa; indicadores globales independientes.":historyExhausted?"Historial disponible; cambios recientes sincronizados.":"Indicadores globales independientes de los registros visibles."}</div><div class="sample-info">El responsable de recepción registra los datos primarios una sola vez. El ingreso oficial asigna la muestra. El duplicado hereda los datos de origen, pero su análisis y cierre son independientes.</div><div id="sample-feedback" role="status" class="sample-feedback">${esc(message)}</div>
 <section class="card sample-section"><div class="reception-heading"><div><span class="reception-kicker">ETAPA 01 · GESTIÓN DE MUESTRAS</span><h2>Recepción de muestras</h2><p>Complete todos los campos para registrar la recepción. El código debe ser único.</p></div><span class="reception-required">Campos obligatorios excepto observaciones</span></div><form id="sample-reception" class="sample-grid reception-form"><div class="reception-group-title">01 · Identificación y parámetros</div>${field('code','Código de muestra','text','required maxlength="35" placeholder="Ej. 2130"')}${select('type','Tipo de muestra',opts(['Agua residual','Agua potable','Agua de consumo','Agua natural','Cliente','Agua superficial','Agua de piscina','Alimento','Otra']))}<fieldset class="sample-parameters reception-parameters"><legend>Parámetros solicitados <span class="required-star">*</span></legend>${parameters.map((p,i)=>`<label class="sample-check"><input type="checkbox" name="parameter" value="${esc(p)}" ${i===0?'checked':''}> ${esc(p)}</label>`).join('')}</fieldset><div class="reception-group-title">02 · Muestreo y recepción</div>${field('receivedDate','Fecha de ingreso','date',`required value="${now()}"`)}${easyTime('sampleTime','Hora de toma')}${select('sampledBy','Iniciales de toma de muestra',opts(['Cliente','AC','VV','JN','JJF','JF','LP','RR','FT','RM']))}${easyTime('receivedTime','Hora de recepción')}<div class="reception-group-title">03 · Condiciones y observaciones</div>${select('receivedBy','Recibido por',opts(['ME','NS','LP','JF','JJF']))}${select('storage','Temperatura de almacenamiento',opts(['<10 °C','2–8 °C','Ambiente','Otra']))}${field('notes','Observaciones (opcional)','text','maxlength="400" placeholder="Agregue una observación únicamente si corresponde"')}<div class="sample-actions"><span class="reception-hint">* Verifique los datos antes de confirmar.</span><button ${!editable?'disabled':''}>Guardar recepción</button></div></form></section>
 <section class="card sample-section"><div class="workflow-heading"><div><span class="workflow-kicker">CONSULTA · TRAZABILIDAD</span><h2>Registro general de muestras</h2><p>Consulte el estado, los resultados y las acciones disponibles para cada expediente.</p></div><span class="workflow-badge">${sampleTotal===null?'Verificando total…':sampleTotal+' registros en total'}</span></div><div class="sample-table-wrap"><table class="sample-table"><thead><tr><th>Código</th><th>Tipo</th><th>Parámetros</th><th>Recepción</th><th>Ingreso oficial</th><th>Estado del análisis</th><th>Duplicado</th><th>Acciones</th></tr></thead><tbody>${records.length?records.map(r=>`<tr><td><b>${esc(r.code)}</b>${r.parentId?'<br><small>Duplicado</small>':''}</td><td>${esc(r.type)}</td><td>${esc((r.parameters||[]).join(', '))}</td><td>${esc(r.receivedDate)} ${esc(r.receivedTime)}</td><td>${r.status==='RECEIVED'?'<span class="sample-status">PENDIENTE</span>':`<span class="sample-status sample-ok">INGRESADA · ${esc(r.company||'')}</span>`}</td><td><span class="sample-status ${r.status==='FINISHED'?'sample-ok':''}">${r.status==='RECEIVED'?'SIN ASIGNAR':r.status==='ASSIGNED'?'PENDIENTE ANÁLISIS':'ANÁLISIS FINALIZADO'}</span></td><td>${r.parentId?'—':records.some(x=>x.parentId===r.id)?esc(r.code+'-R'):'—'}</td><td><div class="sample-row-actions">${r.status==='RECEIVED'&&editable?`<button class="secondary" data-action="official" data-id="${esc(r.id)}">📥 Ingreso oficial</button><button class="secondary" data-action="edit" data-id="${esc(r.id)}">✏️ Editar</button>`:''}${r.status!=='RECEIVED'&&editable?`<button class="secondary" data-action="edit-official" data-id="${esc(r.id)}">✏️ Editar ingreso</button>`:''}${r.status!=='RECEIVED'?`<button class="secondary" data-action="analyze" data-id="${esc(r.id)}">${r.status==='FINISHED'?'🔒 Ver análisis':'🧪 Abrir análisis'}</button>`:''}<button class="secondary" data-action="trace" data-id="${esc(r.id)}">📋 Trazabilidad</button> ${!r.parentId&&r.status!=='RECEIVED'&&editable?`<button class="secondary" data-action="duplicate" data-id="${esc(r.id)}" ${records.some(x=>x.parentId===r.id)?'disabled':''}>Generar -R</button>`:''}</div></td></tr>`).join(''):'<tr><td colspan="8">No hay muestras registradas.</td></tr>'}</tbody></table></div></section>
 <section class="card sample-section"><div class="workflow-heading"><div><span class="workflow-kicker">ETAPA 02 · ASIGNACIÓN</span><h2>Ingreso oficial de muestras</h2><p>Seleccione una muestra recibida y programe su ensayo. Los datos de recepción se conservan sin duplicarlos.</p></div><span class="workflow-badge">${pending.length} pendientes</span></div><form id="sample-assignment" class="sample-grid">${select('id','Muestra pendiente',opts(pending.map(r=>r.code)))}${field('plannedDate','Fecha prevista de ensayo','date','required')}${field('plannedTime','Hora prevista de ensayo','time','required')}${select('analyst','Analista previsto',[['','Seleccione'],['LP','LP — Lizbeth Prieto'],['NS','NS — Nidia Sánchez']])}${field('company','Empresa','text','required maxlength="100" list="micro-companies" autocomplete="off"')}${field('branch','Sucursal','text','maxlength="100" list="micro-branches" autocomplete="off"')}${field('description','Descripción de la muestra','text','maxlength="300" list="micro-descriptions" autocomplete="off"')}<div class="sample-actions"><button ${!editable?'disabled':''} id="official-submit">Ingresar oficialmente y asignar</button><button type="button" class="secondary" id="official-cancel" hidden>Cancelar edición</button></div></form><datalist id="micro-companies">${catalog.companies.map(v=>`<option value="${esc(v)}">`).join('')}</datalist><datalist id="micro-branches">${catalog.branches.map(v=>`<option value="${esc(v)}">`).join('')}</datalist><datalist id="micro-descriptions">${catalog.descriptions.map(v=>`<option value="${esc(v)}">`).join('')}</datalist><p class="sample-catalog-note">Sugerencias compartidas: los valores se incorporan al confirmar el ingreso oficial. Puede escribir nuevos valores.</p></section>
 <section class="card sample-section micro-pending-section"><div class="micro-pending-head"><div><h2>3. Análisis pendientes <span class="micro-pending-total">${assigned.length}</span></h2><p>Seleccione el código para abrir directamente el expediente. Se agrupan por la fecha prevista del ingreso oficial; la fecha real del ensayo se confirma en el análisis.</p></div><label class="micro-pending-filter">Fecha prevista<select id="micro-pending-date"><option value="">Todas las fechas (${assigned.length})</option>${[...new Set(assigned.map(r=>r.plannedDate||'SIN_FECHA'))].sort().map(d=>`<option value="${esc(d)}">${d==='SIN_FECHA'?'Sin fecha prevista':esc(d)} · ${assigned.filter(r=>(r.plannedDate||'SIN_FECHA')===d).length}</option>`).join('')}</select></label></div><div class="micro-pending-groups">${[...new Set(assigned.map(r=>r.plannedDate||'SIN_FECHA'))].sort().map(d=>`<div class="micro-pending-group" data-pending-date="${esc(d)}"><div class="micro-pending-group-title"><strong>📅 ${d==='SIN_FECHA'?'Sin fecha prevista':esc(d)}</strong><span>${assigned.filter(r=>(r.plannedDate||'SIN_FECHA')===d).length} muestra(s)</span></div><div class="micro-pending-codes">${assigned.filter(r=>(r.plannedDate||'SIN_FECHA')===d).sort((a,b)=>String(a.plannedTime||'').localeCompare(String(b.plannedTime||''))).map(r=>`<button type="button" class="micro-pending-code" data-action="analyze" data-id="${esc(r.id)}" title="${esc([r.company,r.branch,r.analyst,r.plannedTime].filter(Boolean).join(' · '))}"><strong>${esc(r.code)}</strong><small>${esc(r.plannedTime||'Sin hora')} · ${esc(r.analyst||'Sin analista')}${r.parentId?' · R':''}</small></button>`).join('')}</div></div>`).join('')||'<p>No hay análisis pendientes.</p>'}</div><div id="analysis-panel"></div></section>
 ${sampleViewMode==='quality'?plannerSection():''}
 ${dailySection(editable)}
 ${consolidatedSection(records)}`;

 if(sampleViewMode!=="quality"){
   const sections=[...el.querySelectorAll('section.sample-section')];
   // Se mantienen montados todos los formularios: los cambios de pestaña no crean suscripciones.
   const tabFor=(section,i)=>['reception','consolidated','official','analysis','qc','results','duplicates'][i]||null;
   sections.forEach((section,i)=>{const tab=tabFor(section,i);if(tab)section.dataset.sampleTab=tab;else section.hidden=true;});
   const tabs=document.createElement('nav');tabs.className='micro-workflow-tabs';tabs.setAttribute('aria-label','Etapas de gestión de muestras');
   tabs.innerHTML=Object.entries(sampleTabNames).map(([key,label],i)=>`<button type="button" class="micro-workflow-tab" data-tab="${key}" aria-pressed="false"><span class="micro-tab-icon" aria-hidden="true">${sampleTabIcons[key]}</span><span class="micro-tab-label">${label}</span><strong>${key==='official'?(pendingReady.RECEIVED?pending.length:'…'):key==='analysis'?(pendingReady.ASSIGNED?assigned.length:'…'):key==='consolidated'?(sampleTotal??'…'):key==='results'?(globalMetrics.finished??'…'):key==='duplicates'?(globalMetrics.duplicates??'…'):key==='qc'?dailyRows().length:(sampleTotal??'…')}</strong></button>`).join('');
   const info=el.querySelector('.sample-info');info?.after(tabs);
   const toolbar=document.createElement('div');toolbar.className='micro-nav-toolbar';toolbar.innerHTML='<div class="micro-nav-heading"><strong>Centro de gestión analítica</strong><small>Seleccione un módulo para trabajar</small></div><label class="micro-nav-search">⌕ <input type="search" placeholder="Buscar módulo…" aria-label="Buscar módulo" autocomplete="off"></label>';
   tabs.before(toolbar);
   const navSearch=toolbar.querySelector('input');navSearch.addEventListener('input',()=>{const q=navSearch.value.trim().toLocaleLowerCase('es');tabs.querySelectorAll('[data-tab]').forEach(b=>{b.hidden=!!q&&!b.textContent.toLocaleLowerCase('es').includes(q);});});
   // V1.0.255: filtro y paginación exclusivamente sobre filas ya cargadas.
   // No modifica la búsqueda histórica ni añade consultas Firestore.
   const generalSection=sections.find(section=>section.dataset.sampleTab==='consolidated');
   const generalTable=generalSection?.querySelector('.sample-table');
   if(generalTable){
     const body=generalTable.tBodies[0];
     const rows=[...body.querySelectorAll('tr')].filter(row=>row.querySelectorAll('td').length>1);
     const controls=document.createElement('div');controls.className='psi-general-controls';
     controls.innerHTML='<label class="psi-general-search">⌕ <input type="search" placeholder="Filtrar registros cargados por código, tipo, parámetro o estado" aria-label="Filtrar registros cargados"></label><label class="psi-general-size">Mostrar <select aria-label="Registros por página"><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label><span class="psi-general-count" role="status"></span><div class="psi-general-pages"><button type="button" class="secondary" data-page="prev" aria-label="Página anterior">‹</button><span class="psi-general-page-label"></span><button type="button" class="secondary" data-page="next" aria-label="Página siguiente">›</button></div>';
     generalTable.closest('.sample-table-wrap')?.before(controls);
     const search=controls.querySelector('input'),size=controls.querySelector('select');let page=0;
     const paint=()=>{
       const query=search.value.trim().toLocaleLowerCase('es');
       const matches=rows.filter(row=>row.textContent.toLocaleLowerCase('es').includes(query));
       const perPage=Number(size.value),pages=Math.max(1,Math.ceil(matches.length/perPage));page=Math.min(page,pages-1);
       const visible=new Set(matches.slice(page*perPage,(page+1)*perPage));
       rows.forEach(row=>{row.hidden=!visible.has(row);row.style.display=visible.has(row)?'':'none';});
       controls.querySelector('.psi-general-count').textContent=`${matches.length} coincidencia(s) de ${rows.length} registros cargados`;
       controls.querySelector('.psi-general-page-label').textContent=`${page+1} / ${pages}`;
       controls.querySelector('[data-page="prev"]').disabled=page===0;
       controls.querySelector('[data-page="next"]').disabled=page>=pages-1;
     };
     search.addEventListener('input',()=>{page=0;paint()});size.addEventListener('change',()=>{page=0;paint()});
     controls.querySelector('[data-page="prev"]').addEventListener('click',()=>{page=Math.max(0,page-1);paint()});
     controls.querySelector('[data-page="next"]').addEventListener('click',()=>{page++;paint()});paint();
   }
   const qcSection=sections.find(section=>section.dataset.sampleTab==='qc');
   if(qcSection){qcSection.classList.add('micro-qc-enhanced');const table=qcSection.querySelector('.sample-table');if(table){table.querySelectorAll('tbody tr').forEach(tr=>{const cells=tr.querySelectorAll('td');if(cells.length<8)return;const badgeText=[4,5,6].map(i=>cells[i]?.textContent||'');const red=badgeText.some(x=>x.includes('NO CONFORME'));const yellow=badgeText.some(x=>x.includes('SIN EVALUAR'));tr.classList.toggle('micro-row-danger',red);tr.classList.toggle('micro-row-warning',!red&&yellow);});}const summary=document.createElement('div');summary.className='micro-qc-legend';summary.innerHTML='<span class="micro-light micro-light-ok">● Conforme</span><span class="micro-light micro-light-pending">● Sin evaluar</span><span class="micro-light micro-light-danger">● No conforme</span><span class="micro-light micro-light-na">● No aplica</span>';qcSection.querySelector('p')?.after(summary);}

   const selectTab=(tab,scroll=false)=>{
     activeSampleTab=sampleTabNames[tab]?tab:'reception';
     if(['results','duplicates','consolidated'].includes(activeSampleTab))queueMicrotask(()=>ensureAnalyticalHistory(el,user,profile));
     sections.forEach(section=>{if(section.dataset.sampleTab)section.hidden=section.dataset.sampleTab!==activeSampleTab;});
     tabs.querySelectorAll('[data-tab]').forEach(button=>{const active=button.dataset.tab===activeSampleTab;button.setAttribute('aria-pressed',String(active));button.classList.toggle('is-active',active);});
     if(scroll)tabs.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
   };
   tabs.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>selectTab(button.dataset.tab)));
   el._selectSampleTab=selectTab;
   selectTab(activeSampleTab);
   el.querySelectorAll('.sample-kpis>.card').forEach((card,i)=>{const tab=['consolidated','official','analysis','duplicates'][i];card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-label','Abrir '+sampleTabNames[tab]);const open=()=>selectTab(tab,true);card.addEventListener('click',open);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});});
 }
 if(sampleViewMode==='quality'){
   const sections=[...el.querySelectorAll('section.sample-section')];
   sections.forEach(section=>{if(!section.classList.contains('qc-planner')&&!section.querySelector('#micro-daily-editor'))section.hidden=true;});
   const heading=el.querySelector('h1');if(heading)heading.textContent='Controles de calidad · jornadas analíticas';
   const eyebrow=el.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='CONTROL DE CALIDAD · Q1 + Q2 + Q3';
   const intro=el.querySelector('.intro');if(intro)intro.textContent='Registros por fecha real de análisis. Esta vista utiliza el mismo expediente y las mismas evaluaciones de Firebase que Registro de muestras; no duplica controles.';
   [...el.children].forEach(child=>{if(child.classList?.contains('sample-kpis')||child.classList?.contains('sample-info'))child.hidden=true;});
 }
 if(sampleViewMode==='quality'){
  enhanceQcPlanner(el);
  showQcLoadedIndicators(el,dailyControls);
  enhanceQcHistory(el);
  enhanceQcAnalytics(el);
  enhanceQcExpediente(el);
  enhanceQcExpediente237(el);
  const refresh=el.querySelector('#qc-planner-refresh');if(refresh){refresh.disabled=plannerLoading;refresh.textContent=plannerLoading?'Consultando…':'Actualizar recursos';refresh.onclick=()=>{void loadPlannerResources(el,user,profile,{force:true});};}
  if(!plannerAutoRequested&&!plannerLoaded&&!plannerLoading){plannerAutoRequested=true;void loadPlannerResources(el,user,profile);}
  el.querySelectorAll('[data-qc-go]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.qcGo==='strains'&&b.dataset.qcAtcc){sessionStorage.setItem('micro_reactivation_context',JSON.stringify({atcc:b.dataset.qcAtcc,medium:'Control de calidad',test:'Q1',origin:'qc-planner'}));}window.dispatchEvent(new CustomEvent('micro:navigate',{detail:{page:b.dataset.qcGo,atcc:b.dataset.qcAtcc||''}}));}));
  el.querySelectorAll('[data-qc-q3-id]').forEach(b=>b.addEventListener('click',()=>{
   const id=b.dataset.qcQ3Id;
   const open=el.querySelector(`[data-daily="${CSS.escape(id)}"]`);
   if(open){open.dataset.qcPreferred='Q3';open.click();delete open.dataset.qcPreferred;}
  }));
  el.querySelectorAll('[data-qc-evaluate]').forEach(b=>b.addEventListener('click',()=>{const base=b.dataset.qcBase||'';const q=b.dataset.qcEvaluate;const row=q==='Q1'?q1ExecutedCandidate(base,plannerDay(),plannerLast('Q1')?.date||''):dailyRows().filter(r=>r.executedCodes.size&&(q==='Q3'?q3Pendientes().some(p=>p.id===r.id):r.date>=base&&r.date<=plannerDay())).sort((a,c)=>a.date.localeCompare(c.date))[0];if(row){el.querySelector(`[data-daily="${CSS.escape(row.id)}"]`)?.click();const tab=el.querySelector(`#micro-daily-editor [data-qc234="${q}"]`);if(tab)tab.click();}else{plannerError='No hay una jornada ejecutada hoy. Registre primero el análisis real de las muestras.';display(el,user,profile);}}));
 }
 el.querySelectorAll('[data-qc-open-sample]').forEach(button=>button.addEventListener('click',()=>{const r=records.find(x=>x.id===button.dataset.qcOpenSample);if(!r||r.status!=='ASSIGNED')return;analysis(el,r,user,profile,editable);}));
 el.querySelectorAll('[data-daily]').forEach(button=>button.addEventListener('click',()=>{const row=dailyRows().find(x=>x.id===button.dataset.daily);if(!row||!row.executedCodes.size)return;const old=dailyControls.find(x=>x.id===row.id);const preferredQc=button.dataset.qcPreferred||'Q1';const mediaHint=qcMediaForDate(row.date);const panel=el.querySelector('#micro-daily-editor');const controlFields=['Q1','Q2','Q3'].map(q=>`<fieldset class="qc-detail"><legend>${q} · ${q==='Q1'?'Control positivo / negativo':q==='Q2'?'Muestra fortificada':'Esterilidad de medios'}</legend><p class="qc-help">${q==='Q1'?'Registre la fase y los resultados observados para cada medio realmente ensayado.':q==='Q2'?'Registre la matriz, el NMP y los resultados observados. La conformidad requiere verificar los límites del método.':'El blanco debe permanecer sin crecimiento observable. Verifique lote vigente y condiciones reales antes de aprobar.'}</p><label>Aplicabilidad<select name="${q}_status"><option value="PENDIENTE">Pendiente de evaluación</option><option value="CONFORME">Ejecutado · conforme</option><option value="NO_CONFORME">Ejecutado · no conforme</option><option value="NO_APLICA">No aplica (justificar)</option></select></label><label>Fecha real de ejecución<input type="date" name="${q}_date" value="${esc(old?.controls?.[q]?.date||row.date)}"></label><label>Medio(s) efectivamente controlados<select name="${q}_medium"><option value="">Seleccione</option><option>A-1 Medium</option><option>Fluorocult LMX</option><option>Ambos medios</option></select></label>${q==='Q3'?'':`<label>Fase<select name="${q}_phase"><option value="">Seleccione</option><option value="POSITIVO">Positivo</option><option value="NEGATIVO">Negativo</option></select></label>`}${q==='Q2'?'<label>Matriz fortificada<input name="Q2_matrix" placeholder="Ej. Agua destilada"></label><label>NMP observado / 100 mL<input name="Q2_nmp" type="number" min="0" step="any" placeholder="Resultado NMP"></label>':''}<label>Hora inicio 35 °C<input type="datetime-local" name="${q}_start35"></label><label>Hora fin 35 °C<input type="datetime-local" name="${q}_end35"></label><label>Temperatura real 35 °C<input type="number" name="${q}_temp35" min="0" max="60" step="0.1" placeholder="35.0"></label><label>Hora inicio 44,5 °C (si aplica)<input type="datetime-local" name="${q}_start44"></label><label>Hora fin 44,5 °C (si aplica)<input type="datetime-local" name="${q}_end44"></label><label>Temperatura real 44,5 °C (si aplica)<input type="number" name="${q}_temp44" min="0" max="60" step="0.1" placeholder="44.5"></label><label>${q==='Q3'?'Crecimiento observado': 'Formación de gas'}<select name="${q}_gas"><option value="">Sin registrar</option><option value="SI">Sí</option><option value="NO">No</option></select></label>${q==='Q3'?'':`<label>Crecimiento / turbidez<select name="${q}_growth"><option value="">Sin registrar</option><option value="SI">Sí</option><option value="NO">No</option></select></label><label>Color azul-verde LMX (si aplica)<select name="${q}_color"><option value="">No evaluado</option><option value="SI">Sí</option><option value="NO">No</option></select></label><label>Fluorescencia LMX (si aplica)<select name="${q}_fluorescence"><option value="">No evaluado</option><option value="SI">Sí</option><option value="NO">No</option></select></label>`}<label>Observaciones y justificación<input name="${q}_notes" maxlength="500" placeholder="Desviaciones y observaciones"></label><output class="qc-conclusion" data-conclusion="${q}">Conclusión: pendiente de datos</output></fieldset>`).join('');panel.innerHTML=`<form id="daily-form" class="sample-grid"><div><strong>Jornada ejecutada: ${esc(row.parameter)} · ${esc(row.date)}</strong><p>Muestras ejecutadas: ${esc([...row.executedCodes].join(', '))}</p><p>Registrar una evaluación no equivale a comprobar automáticamente los criterios microbiológicos. Verifique las observaciones y los recursos en el planificador Q1/Q2/Q3.</p></div>${controlFields}<div class="sample-actions"><button type="submit">Guardar evaluación de jornada</button><button type="button" class="secondary" id="daily-cancel">Cancelar</button></div><p id="daily-message" role="status"></p></form>`;const form=panel.querySelector('form');
// V1.0.255: observaciones dentro del formulario original; sin panel duplicado.
// Los campos principales representan A-1 cuando se seleccionan ambos medios.
// Para LMX se muestran los mismos campos inmediatamente debajo de los originales.
for(const q of ['Q1','Q2','Q3']){
 const medium=form.elements[q+'_medium'];
 const keys=q==='Q3'?['gas']:['gas','growth','color','fluorescence'];
 const oldResults=old?.controls?.[q]?.mediumResults||{};
 const lmxFields={};
 for(const key of keys){
   const original=form.elements[q+'_'+key];if(!original)continue;
   const label=original.closest('label');
   const extra=label.cloneNode(true);
   const field=extra.querySelector('select');
   field.name=q+'_LMX_'+key;
   field.value=oldResults.LMX?.[key]??'';
   extra.dataset.lmxInline=q;
   extra.firstChild.textContent=(key==='gas'?(q==='Q3'?'Crecimiento observado':'Formación de gas'):key==='growth'?'Crecimiento / turbidez':key==='color'?'Color azul-verde': 'Fluorescencia')+' · Fluorocult LMX';
   label.after(extra);lmxFields[key]=field;
 }
 const refresh=()=>{
   const selection=medium.value;
   const both=selection==='Ambos medios';
   for(const label of form.querySelectorAll('[data-lmx-inline="'+q+'"]')){
     const field=label.querySelector('select');const key=field?.name?.split('_').pop();
     label.hidden=true;
   }
   for(const key of keys){const label=form.elements[q+'_'+key]?.closest('label');if(!label)continue;
     label.hidden=q!=='Q3'&&((key==='gas'||key==='growth')?selection==='Fluorocult LMX':(key==='color'||key==='fluorescence')?selection==='A-1 Medium':false);
     label.firstChild.textContent=(key==='gas'?(q==='Q3'?'Crecimiento observado':'Formación de gas'):key==='growth'?'Crecimiento / turbidez':key==='color'?'Color azul-verde LMX':'Fluorescencia LMX');
   }

 };
 medium.addEventListener('change',refresh);refresh();
 // Restaurar datos anteriores del panel retirado sin perder las evaluaciones individuales.
 if(oldResults.A1&&(!old?.controls?.[q]?.gas))for(const key of keys){const input=form.elements[q+'_'+key];if(input)input.value=oldResults.A1[key]??'';}
 if(oldResults.LMX&&old?.controls?.[q]?.medium==='Fluorocult LMX')for(const key of keys){const input=form.elements[q+'_'+key];if(input)input.value=oldResults.LMX[key]??input.value;}
}

const q2History=dailyControls.filter(x=>x.id!==row.id&&x.controls?.Q2?.date&&['CONFORME','NO_CONFORME'].includes(x.controls.Q2.status)&&x.controls.Q2.date<row.date).sort((a,b)=>b.controls.Q2.date.localeCompare(a.controls.Q2.date));
const q2Last=q2History[0]?.controls?.Q2;
// Alternancia por último control Q2 documentado; sin histórico no se inventa la fase.
const q2AutoPhase=old?.controls?.Q2?.phase||qcPhaseFor(dailyControls,row.date,row.id,'Q2');
const phase=old?.controls?.Q1?.phase||qcPhase(dailyControls,row.date,row.id);
const phaseSelect=form.elements['Q1_phase'];phaseSelect.value=phase;phaseSelect.disabled=true;
const q2PhaseField=form.elements.Q2_phase;
if(q2AutoPhase){q2PhaseField.value=q2AutoPhase;q2PhaseField.disabled=true;}
const q2PhaseNote=document.createElement('p');q2PhaseNote.className='qc-help';
q2PhaseNote.textContent=q2AutoPhase?'Fase del ciclo quincenal: '+q2AutoPhase+'. Anclada al primer Q2 documentado; la ejecución no reinicia la alternancia.':'No existe un Q2 anterior válido para determinar alternancia. Seleccione la fase inicial conforme al programa aprobado.';
q2PhaseField.closest('label')?.append(q2PhaseNote);
const q2Tubes=document.createElement('div');q2Tubes.className='qc-tubes';
q2Tubes.innerHTML='<strong>Combinación de tubos · NMP automático</strong><p class="qc-help">Método fijo: 5 tubos de 10 mL, 5 tubos de 1 mL y 5 tubos de 0,1 mL. Ingrese únicamente los tubos positivos (0–5). La consulta usa la tabla NMP 5-5-5 incluida en el ERP; las combinaciones sin entrada verificada quedan pendientes.</p><div class="qc-tube-grid">'+[1,2,3].map((i)=>'<label>Serie '+i+' · '+['10','1','0,1'][i-1]+' mL · positivos de 5<input type="number" min="0" max="5" step="1" name="Q2_positive'+i+'" placeholder="0–5"></label>').join('')+'</div><output id="q2-tube-combination" role="status">Ingrese la combinación.</output>';
form.elements.Q2_nmp.closest('label')?.before(q2Tubes);
const nmpField=form.elements.Q2_nmp;nmpField.type='text';nmpField.readOnly=true;nmpField.placeholder='Se calcula automáticamente';
for(let i=1;i<=3;i++)form.elements['Q2_positive'+i].value=old?.controls?.Q2?.['positive'+i]??'';
function updateQ2Tubes(){
 const raw=[1,2,3].map(i=>form.elements['Q2_positive'+i].value);
 const valid=raw.every(x=>x!==''&&Number.isInteger(Number(x))&&Number(x)>=0&&Number(x)<=5);
 const out=form.querySelector('#q2-tube-combination');
 const entry=valid?NMP_555.get(raw.map(Number).join('-')):null;
 if(entry){nmpField.value=entry.value;out.textContent='Combinación '+raw.join('-')+' · NMP/100 mL: '+entry.value+' · Tabla 5-5-5 del ERP.';}
 else {nmpField.value='';out.textContent=valid?'Combinación '+raw.join('-')+' no disponible en la tabla incorporada. Requiere validación documental; no se estima el NMP.':'Complete los tres conteos de tubos positivos (0–5).';}
 out.dataset.valid=String(Boolean(entry));return Boolean(entry);
}
q2Tubes.addEventListener('input',()=>{updateQ2Tubes();form.dispatchEvent(new Event('change',{bubbles:true}));});updateQ2Tubes();
const statusSelect=form.elements['Q1_status'];statusSelect.disabled=true;
// V1.0.255: estado de Q1 informativo, nunca seleccionable manualmente.
const statusLabel=statusSelect.closest('label');
const statusBadge=document.createElement('output');statusBadge.className='qc-auto-state';statusBadge.setAttribute('role','status');
statusLabel?.append(statusBadge);statusSelect.hidden=true;
if(statusLabel)statusLabel.firstChild.textContent='Evaluación automática · Q1';

const resourceBox=document.createElement('div');resourceBox.className='qc-resource-check';resourceBox.setAttribute('role','status');
form.querySelector('fieldset.qc-detail').prepend(resourceBox);
let resourceMedia=[],resourceReactions=[],resourceLoaded=false,resourceError='';
const qcSections=[...form.querySelectorAll('fieldset.qc-detail')];
const qcTabs=document.createElement('nav');qcTabs.className='qc-tabs';qcTabs.setAttribute('aria-label','Seleccionar control de calidad');
qcTabs.innerHTML=['Q1','Q2','Q3'].map((q,i)=>`<button type="button" class="qc-tab" data-qc-tab="${q}" aria-pressed="${i===0}">${q} · ${q==='Q1'?'Positivo / negativo':q==='Q2'?'Muestra fortificada':'Esterilidad'}</button>`).join('');
qcSections[0]?.before(qcTabs);
function activateQc(q){qcSections.forEach((section,i)=>{section.hidden=['Q1','Q2','Q3'][i]!==q;});qcTabs.querySelectorAll('button').forEach(b=>{const active=b.dataset.qcTab===q;b.setAttribute('aria-pressed',String(active));b.classList.toggle('active',active);});}
qcTabs.addEventListener('click',e=>{const b=e.target.closest('[data-qc-tab]');if(b)activateQc(b.dataset.qcTab);});activateQc('Q1');
for(const q of ['Q1','Q2','Q3']){const c=old?.controls?.[q]||{};form.elements[q+'_status'].value=c.status||'PENDIENTE';if(form.elements[q+'_reference'])form.elements[q+'_reference'].value=c.reference||'';form.elements[q+'_notes'].value=c.notes||'';for(const k of ['medium','phase','matrix','nmp','start35','end35','temp35','start44','end44','temp44','gas','growth','color','fluorescence']){const f=form.elements[q+'_'+k];if(f&&!(q==='Q1'&&k==='phase')&&!(q==='Q2'&&k==='nmp'))f.value=c[k]??'';}}
// V1.0.255: restaurar la fase calculada DESPUÉS de hidratar el formulario.
// La hidratación anterior asignaba '' a Q2_phase y borraba la fase automática.
// Mostrar automáticamente los medios pertinentes sin alterar evaluaciones ya guardadas.
for(const q of ['Q1','Q2','Q3']){
 const field=form.elements[q+'_medium'];
 if(field&&!old?.controls?.[q]?.medium&&mediaHint.label){field.value=mediaHint.label;field.dispatchEvent(new Event('change',{bubbles:true}));}
 const section=field?.closest('fieldset');
 if(section){const badge=document.createElement('div');badge.className='qc279-media-hint';badge.textContent=`Medios identificados en ${row.date}: ${mediaHint.count} de 2 · ${mediaHint.label||'Sin medio identificable'} · ${mediaHint.parameters.join(' + ')||'Sin parámetros'}`;section.querySelector('.qc-help')?.after(badge);}
}
const q2EffectivePhase=old?.controls?.Q2?.phase||q2AutoPhase||'';
if(q2EffectivePhase){q2PhaseField.value=q2EffectivePhase;q2PhaseField.disabled=true;}
else {q2PhaseField.disabled=false;}
const q2Section=q2PhaseField.closest('fieldset');
const q2Legend=q2Section?.querySelector('legend');
const q2PhaseBanner=document.createElement('div');
q2PhaseBanner.className='qc-resource-check';
q2PhaseBanner.setAttribute('role','status');
function renderQ2Phase(){
 const current=q2PhaseField.value;
 const phaseLabel=current==='POSITIVO'?'POSITIVA':current==='NEGATIVO'?'NEGATIVA':'SIN DEFINIR';
 if(q2Legend)q2Legend.textContent='Q2 · Muestra fortificada — FASE '+phaseLabel;
 q2PhaseBanner.innerHTML='<strong>Q2 · Fase '+phaseLabel+'</strong><p>'+(current?'Fase del ciclo programado; no representa el resultado analítico ni la conformidad.':'Sin referencia histórica válida: seleccione la fase inicial según el programa aprobado.')+'</p>';
 q2PhaseBanner.style.borderLeftColor=current==='NEGATIVO'?'#2563eb':'#168568';
}
q2Section?.prepend(q2PhaseBanner);
q2PhaseField.addEventListener('change',renderQ2Phase);
renderQ2Phase();
updateQ2Tubes();// V1.0.255: planificación de incubación Q1; no sustituye el registro de tiempos reales.
// V1.0.255: temperaturas sugeridas; editables para registrar mediciones reales.
for(const q of ['Q1','Q2','Q3']){for(const [key,defaultValue] of [['temp35','35'],['temp44','44.5']]){const input=form.elements[q+'_'+key];if(input && (input.value===''||input.value==null))input.value=defaultValue;}}
// V1.0.255: Q2/Q3 reciben la misma planificación horaria inicial que Q1.
// Son horarios previstos, no evidencia de incubación efectivamente realizada.
for(const q of ['Q2','Q3']){
 const start=form.elements[q+'_start35'];
 const dateInput=form.elements[q+'_date'];
 const end35=form.elements[q+'_end35'];
 const start44=form.elements[q+'_start44'];
 const end44=form.elements[q+'_end44'];
 const z=n=>String(n).padStart(2,'0');
 const stamp=d=>`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
 const plus=(value,h)=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':stamp(new Date(d.getTime()+h*3600000));};
 const refresh=()=>{end35.value=plus(start.value,3);start44.value=end35.value;end44.value=plus(start.value,24);};
 const syncDate=()=>{if(!dateInput.value)return;const time=start.value.slice(11)||stamp(new Date()).slice(11);start.value=dateInput.value+'T'+time;refresh();};
 start.addEventListener('change',refresh);
 dateInput.addEventListener('change',syncDate);
 if(!start.value)syncDate();else refresh();
 for(const field of [end35,start44,end44]){field.readOnly=true;field.title='Horario previsto automático; confirmar tiempos reales según procedimiento.';}
 const note=document.createElement('p');note.className='qc-help';note.textContent='Horario previsto: 3 h a 35 °C + 21 h a 44,5 °C (24 h). Aplicar solo las etapas exigidas por el procedimiento del medio; registrar y verificar los tiempos reales.';
 start.closest('label')?.before(note);
 const medium=form.elements[q+'_medium'];
 const visibility=()=>{const lmx=medium.value==='Fluorocult LMX';for(const field of [start44,end44,form.elements[q+'_temp44']]){const label=field.closest('label');if(label)label.hidden=lmx;} };
 medium.addEventListener('change',visibility);visibility();
}
const q1TimeKeys=['start35','end35','start44','end44'];
const q1Fields=Object.fromEntries(q1TimeKeys.map(k=>[k,form.elements['Q1_'+k]]));
const localStamp=d=>{const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;};
const addHours=(value,h)=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':localStamp(new Date(d.getTime()+h*3600000));};
let q1StartEdited=Boolean(old?.controls?.Q1?.start35);
function updateQ1Schedule(){
 const start=q1Fields.start35.value;
 q1Fields.end35.value=start?addHours(start,3):'';
 q1Fields.start44.value=q1Fields.end35.value;
 q1Fields.end44.value=start?addHours(start,24):'';
 for(const k of ['end35','start44','end44']){q1Fields[k].readOnly=true;q1Fields[k].title='Horario previsto calculado automáticamente; no acredita la incubación real.';}
}
function syncQ1StartDate(){
 const day=form.elements.Q1_date.value;
 if(!day)return;
 const prior=q1Fields.start35.value;
 const time=prior?.slice(11)||localStamp(new Date()).slice(11);
 if(!q1StartEdited||!prior||prior.slice(0,10)!==day){q1Fields.start35.value=day+'T'+time;updateQ1Schedule();}
}
q1Fields.start35.addEventListener('input',()=>{q1StartEdited=true;updateQ1Schedule();});
form.elements.Q1_date.addEventListener('change',syncQ1StartDate);
if(!q1Fields.start35.value)syncQ1StartDate();
else updateQ1Schedule();
const q1ScheduleInfo=document.createElement('p');q1ScheduleInfo.className='qc-help';
q1ScheduleInfo.textContent='Horarios previstos: 3 h a 35 °C + 21 h a 44,5 °C (24 h totales). El inicio puede modificarse; las horas calculadas no acreditan los tiempos reales. Verificar el procedimiento aprobado.';
q1Fields.start35.closest('label')?.before(q1ScheduleInfo);
const updateMediumVisibility=()=>{
 const medium=form.elements.Q1_medium.value;
 for(const key of ['gas','growth','color','fluorescence']){
  const label=form.elements['Q1_'+key]?.closest('label');if(label)label.hidden=(key==='gas'||key==='growth')?medium==='Fluorocult LMX':medium==='A-1 Medium';
 }
 for(const key of ['color','fluorescence']){const label=form.elements['Q1_LMX_'+key]?.closest('label');if(label)label.hidden=true;}
 for(const key of ['start44','end44','temp44']){const label=form.elements['Q1_'+key]?.closest('label');if(label)label.hidden=medium==='Fluorocult LMX';}
};
const updateResources=()=>{updateMediumVisibility();
 const date=form.elements.Q1_date.value,medium=form.elements.Q1_medium.value;
 const resources=resourceLoaded?qcResources(resourceMedia,resourceReactions,date,medium,phase):[];
 const result=resourceLoaded?qcVerdict(form,resources):{status:'PENDIENTE',reason:resourceError||'Consultando recursos en Firebase…'};
 statusSelect.value=result.status;statusBadge.textContent=result.status+' · '+result.reason;statusBadge.dataset.state=result.status;
 resourceBox.innerHTML=`<strong>Q1 · Fase automática: ${esc(phase)}</strong><p>${esc(result.status)} · ${esc(result.reason)}</p>${resources.map(r=>`<p>${esc(r.name)} · ATCC ${esc(r.atcc)} · Lotes aptos: ${r.lots.length} · Reactivaciones APTAS: ${r.valid.length}${r.lots.length?` · ${esc(r.lots.map(p=>p.code||p.id).join(', '))}`:''}${r.valid.length?` · ${esc(r.valid.map(x=>x.code||x.id).join(', '))}`:''}</p>`).join('')}`;
 return result;
};
Promise.all([getDocs(collection(db,'microMediaPreparations')),getDocs(collection(db,'microStrainReactivations'))]).then(([m,r])=>{resourceMedia=m.docs.map(d=>({id:d.id,...d.data()}));resourceReactions=r.docs.map(d=>({id:d.id,...d.data()}));resourceLoaded=true;updateConclusions();}).catch(e=>{resourceError='No se pudo verificar Firebase: '+e.message;updateConclusions();});
// V1.0.255: Q2/Q3 comparten presentación y evaluación conservadora con Q1.
const autoPanels={};
for(const q of ['Q2','Q3']){
 const state=form.elements[q+'_status'];state.disabled=true;
 const label=state.closest('label');if(label){label.firstChild.textContent='Evaluación automática · '+q;state.hidden=true;const badge=document.createElement('output');badge.className='qc-auto-state';badge.setAttribute('role','status');label.append(badge);autoPanels[q]=badge;}
 if(q==='Q3'){
  const confirmation=document.createElement('label');confirmation.className='qc-incubation-confirm';confirmation.innerHTML='<span>Incubación real completada y verificada</span><select name="Q3_incubationConfirmed"><option value="">Pendiente de confirmación</option><option value="SI">Sí · completada conforme a los tiempos reales</option><option value="NO">No · incubación no completada o desviada</option></select><small>Los horarios automáticos son previstos; confirme solo después de completar la incubación.</small>';
  qcSections[2]?.append(confirmation);
  confirmation.querySelector('select').value=old?.controls?.Q3?.incubationConfirmed||'';
 }
 if(q==='Q2'){const confirmation=document.createElement('label');confirmation.className='qc-incubation-confirm';confirmation.innerHTML='<span>Incubación Q2 realizada</span><select name="Q2_incubationConfirmed"><option value="">Sin confirmar · guardar en proceso</option><option value="SI">Sí · tiempos reales comprobados</option><option value="NO">No · existe desviación</option></select><small>Puede guardar aunque esté pendiente. Los horarios calculados son previstos y no acreditan por sí solos la incubación.</small>';qcSections[1]?.append(confirmation);confirmation.querySelector('select').value=old?.controls?.Q2?.incubationConfirmed||'';const result=document.createElement('section');result.className='qc-q2-summary';result.dataset.q2Analytical='';result.setAttribute('role','status');qcSections[1]?.prepend(result);}
 const info=document.createElement('div');info.className='qc-resource-check';info.setAttribute('role','status');info.dataset.autoResources=q;
 qcSections[['Q1','Q2','Q3'].indexOf(q)]?.prepend(info);
}
// V1.0.255: Q3 registra cada blanco por separado, sin crear módulos nuevos.
const q3Shared=form.elements.Q3_gas?.closest('label');
const q3Choices=document.createElement('div');
q3Choices.className='qc-q3-individual';
q3Choices.innerHTML=['A1','LMX'].map((key)=>`<label data-q3-medium="${key}">${key==='A1'?'A-1 Medium':'Fluorocult LMX'} · Crecimiento observado<select name="Q3_growth_${key}"><option value="">Sin registrar</option><option value="NO">No · blanco estéril</option><option value="SI">Sí · crecimiento detectado</option></select></label>`).join('');
q3Shared?.after(q3Choices);
for(const key of ['A1','LMX']){const prior=old?.controls?.Q3?.mediumResults?.[key];form.elements['Q3_growth_'+key].value=prior?.gas||'';}
function syncQ3Fields(){
 const medium=form.elements.Q3_medium.value;
 const both=medium==='Ambos medios';
 if(q3Shared)q3Shared.hidden=both;
 for(const key of ['A1','LMX']){
  const label=q3Choices.querySelector(`[data-q3-medium="${key}"]`);
  label.hidden=!both;
 }
}
syncQ3Fields();
function evaluateSecondary(q){
 const v=k=>form.elements[q+'_'+k]?.value||'';
 const medium=v('medium'),day=v('date');
 let status='PENDIENTE',reason='Complete los datos del control.';
 const resources=resourceLoaded&&day&&medium?qcResources(resourceMedia,resourceReactions,day,medium,'POSITIVO'):[];
 const mediaOk=resources.length>0&&resources.every(r=>r.lots.length>0);
 const strainsOk=q==='Q3'||(resources.length>0&&resources.every(r=>r.valid.length>0));
 const selected=Boolean(medium&&day);
 const t35=Number(v('temp35'));
 const isA1=medium==='A-1 Medium'||medium==='Ambos medios';
 const t44=Number(v('temp44'));
 const timeOk=Boolean(v('start35')&&v('end35')&&new Date(v('end35'))>new Date(v('start35'))&&(!isA1||(v('start44')&&v('end44')&&new Date(v('end44'))>new Date(v('start44')))));
 const tempOk=Number.isFinite(t35)&&t35>=34.5&&t35<=35.5&&(!isA1||(Number.isFinite(t44)&&t44>=44&&t44<=45));
 if(v('status')==='NO_APLICA'){status=v('notes')?'NO_APLICA':'PENDIENTE';reason=status==='NO_APLICA'?'No aplica, con justificación.':'Justifique la no aplicabilidad.';}
 else if(!selected)reason='Seleccione fecha y medio.';
 else if(!resourceLoaded)reason=resourceError||'Verificando lotes en Firebase…';
 else if(!mediaOk)reason='No existe lote liberado y vigente para el medio y la fecha seleccionados.';
 else if(!strainsOk)reason='No existe reactivación APTA vigente de la cepa positiva.';
 else if(!timeOk)reason='Faltan horarios de incubación válidos; los horarios previstos no acreditan ejecución.';
 else if(!tempOk){status='NO_CONFORME';reason='Temperatura fuera del intervalo configurado.';}
 else if(q==='Q3'){
  if((medium==='Ambos medios' ? ['A1','LMX'].some(k=>v('growth_'+k)==='SI') : v('gas')==='SI')){status='NO_CONFORME';reason='Se observó crecimiento en al menos un blanco de esterilidad.';}
  else if((medium==='Ambos medios' ? ['A1','LMX'].every(k=>v('growth_'+k)==='NO') : v('gas')==='NO')){if(v('incubationConfirmed')==='SI'){status='CONFORME';reason='Sin crecimiento, lote vigente e incubación real confirmada.';}else if(v('incubationConfirmed')==='NO'){status='NO_CONFORME';reason='Incubación real no completada o desviada.';}else {status='PENDIENTE';reason='Sin crecimiento observado. Falta confirmar la incubación real.';}}
  else reason='Registre si se observó crecimiento.';
 }else{
  if(!v('matrix')||!updateQ2Tubes())reason='Registre matriz y combinación de tubos presente en la tabla NMP 5-5-5.';
  else if(!v('phase')||!v('gas')||!v('growth'))reason='Registre fase y observaciones.';
  else if(v('gas')!==(v('phase')==='POSITIVO'?'SI':'NO')||v('growth')!==(v('phase')==='POSITIVO'?'SI':'NO')){status='NO_CONFORME';reason='Observaciones incompatibles con la fase seleccionada.';}
  else {const rawNmp=v('nmp');const censored=rawNmp.startsWith('<')||rawNmp.startsWith('>');const n=Number(rawNmp.replace(/^[<>]/,''));const positive=v('phase')==='POSITIVO';if(!Number.isFinite(n)||n<0)reason='NMP inválido.';else if((positive&&!censored&&n>=1.8&&n<=20)||(!positive&&rawNmp.startsWith('<')&&n<=1.8)){const finalTime=new Date(isA1?v('end44'):v('end35'));if(v('incubationConfirmed')==='NO'){status='NO_CONFORME';reason='Incubación con desviación declarada.';}else if(finalTime.getTime()<=Date.now()&&v('incubationConfirmed')==='SI'){status='CONFORME';reason='NMP dentro del criterio configurado, combinación respaldada por tabla 5-5-5, recursos vigentes y horarios registrados finalizados.';}else{status='PENDIENTE';reason='NMP dentro del criterio y recursos aptos. Puede guardar ahora como pendiente; para liberar confirme la incubación real completada.';}}else {status='NO_CONFORME';reason='NMP fuera del límite interno '+(positive?'1,8–20':'<1,8')+' NMP/100 mL.';}}
 }
 form.elements[q+'_status'].value=status;
 // V1.0.255: indicadores independientes; no se altera la lógica de liberación.
 if(q==='Q2'){
  const raw=v('nmp').trim(),phase=v('phase');
  const match=/^([<>])?\s*(\d+(?:[.,]\d+)?)$/.exec(raw);
  const n=match?Number(match[2].replace(',','.')):NaN;
  const tubesValid=Boolean(v('matrix')&&v('positive1')!==''&&v('positive2')!==''&&v('positive3')!==''&&match);
  let analytical='PENDIENTE',analyticalText='Ingrese la matriz, fase y una combinación válida de tubos.';
  if(tubesValid&&phase&&Number.isFinite(n)&&n>=0){
   const pass=phase==='POSITIVO'?(!match[1]&&n>=1.8&&n<=20):(match[1]==='<'&&n<=1.8);
   analytical=pass?'CONFORME':'NO_CONFORME';
   analyticalText='Combinación '+[1,2,3].map(i=>v('positive'+i)).join('-')+' · '+raw+' NMP/100 mL · criterio '+(phase==='POSITIVO'?'1,8–20':'<1,8')+' NMP/100 mL.';
  }
  const resourceStatus=!resourceLoaded?'PENDIENTE':mediaOk&&strainsOk?'APTOS':'PENDIENTE';
  const resourceText=!resourceLoaded?(resourceError||'Consultando recursos…'):'Medio vigente: '+(mediaOk?'Sí':'No')+' · Reactivación vigente: '+(strainsOk?'Sí':'No');
  const target=panel.querySelector('[data-q2-analytical]');
  if(target){
   const tile=(title,value,description,state)=>'<div class="qc-q2-tile" data-state="'+esc(state)+'"><strong>'+esc(title)+'</strong><b>'+esc(value.replaceAll('_',' '))+'</b><small>'+esc(description)+'</small></div>';
   target.innerHTML=tile('1 · RESULTADO NMP',analytical,analyticalText,analytical)+tile('2 · RECURSOS',resourceStatus,resourceText,resourceStatus)+tile('3 · ESTADO DEL CONTROL',status,reason,status);
  }
 }
 if(autoPanels[q]){autoPanels[q].textContent=q==='Q2'?status.replaceAll('_',' '):status+' · '+reason;autoPanels[q].dataset.state=status;}
 const box=panel.querySelector('[data-auto-resources="'+q+'"]');if(box&&q!=='Q2')box.innerHTML='<strong>'+q+' · Evaluación automática: '+esc(status)+'</strong><p>'+esc(reason)+'</p><p>'+esc(medium||'Sin medio')+' · Lotes vigentes: '+(mediaOk?'SÍ':'NO')+(q==='Q2'?' · Reactivación positiva vigente: '+(strainsOk?'SÍ':'NO'):' · Blanco sin cepa')+'</p>';
 return {status,reason};
}
const updateConclusions=()=>{syncQ3Fields();updateResources();for(const q of ['Q2','Q3'])evaluateSecondary(q);for(const q of ['Q1','Q2','Q3']){const f=k=>form.elements[q+'_'+k]?.value||'',out=panel.querySelector(`[data-conclusion="${q}"]`);let verdict='PENDIENTE';if(f('status')==='NO_APLICA')verdict=f('notes')?'NO APLICA · justificado':'PENDIENTE · justificar';else if(f('medium')&&f('gas')&&(q==='Q3'||f('growth'))){if(q==='Q3')verdict=f('gas')==='NO'?'SIN CRECIMIENTO · verificar lote y tiempos':'CRECIMIENTO DETECTADO · NO CONFORME';else if(f('phase')){const positive=f('phase')==='POSITIVO';verdict=(f('gas')===(positive?'SI':'NO')&&f('growth')===(positive?'SI':'NO'))?'OBSERVACIONES COMPATIBLES':'REVISAR · resultados discordantes';}}out.textContent=q==='Q1'?'Evaluación preliminar: '+verdict+' · verificar método, incubación y lotes antes de liberar.':q==='Q2'?'':(autoPanels[q]?.textContent||'Evaluación pendiente');if(q==='Q2')out.hidden=true;}};form.addEventListener('change',updateConclusions);form.addEventListener('input',updateConclusions);updateConclusions();panel.querySelector('#daily-cancel').onclick=()=>panel.innerHTML='';form.onsubmit=async event=>{event.preventDefault();const msg=panel.querySelector('#daily-message');const controls={};for(const q of ['Q1','Q2','Q3']){const status=(q==='Q1'?updateResources().status:evaluateSecondary(q).status),reference=form.elements[q+'_reference']?.value.trim()||'',notes=form.elements[q+'_notes'].value.trim(),date=form.elements[q+'_date'].value;if(!date||(status==='NO_APLICA'&&!notes)){activateQc(q);msg.textContent=q+': complete fecha y, cuando corresponda, la justificación o referencia.';return;}const extra={};for(const k of ['medium','phase','matrix','nmp','start35','end35','temp35','start44','end44','temp44','gas','growth','color','fluorescence']){const input=form.elements[q+'_'+k];if(input)extra[k]=input.value;}if(q==='Q2'){extra.incubationConfirmed=form.elements.Q2_incubationConfirmed?.value||'';for(let i=1;i<=3;i++){extra['volume'+i]=[10,1,0.1][i-1];extra['total'+i]=5;extra['positive'+i]=form.elements['Q2_positive'+i].value;}extra.nmpTable='NMP_555';}if(q==='Q3')extra.incubationConfirmed=form.elements.Q3_incubationConfirmed?.value||'';if(['CONFORME','NO_CONFORME'].includes(status)&&!extra.medium){activateQc(q);msg.textContent=q+': seleccione el medio realmente controlado.';return;}if(status==='CONFORME'&&q==='Q3'&&(extra.medium==='Ambos medios'?['A1','LMX'].some(k=>form.elements['Q3_growth_'+k].value!=='NO'):extra.gas!=='NO')){activateQc('Q3');msg.textContent='Q3: no puede declararse conforme si existe crecimiento o falta la observación.';return;}if(status==='CONFORME'&&q!=='Q3'&&(!extra.phase||(extra.medium!=='Fluorocult LMX'&&(!extra.gas||!extra.growth))||(extra.medium==='Fluorocult LMX'&&(!extra.color||!extra.fluorescence)))){activateQc(q);msg.textContent=q+': registre fase, gas y crecimiento antes de declarar conformidad.';return;}if(q==='Q1'){extra.phase=phase;extra.resourceVerification=resourceLoaded?'VERIFICADO':'NO_VERIFICADO';if(!resourceLoaded&&status!=='PENDIENTE'){activateQc(q);msg.textContent='Q1: no se puede cerrar sin verificar recursos en Firebase.';return;}}const mediumResults={};
const selected=extra.medium;
const applicable=selected==='Ambos medios'?['A1','LMX']:selected==='A-1 Medium'?['A1']:selected==='Fluorocult LMX'?['LMX']:[];
for(const key of applicable){
 const result={status,gas:'',growth:'',color:'',fluorescence:'',notes};
 for(const field of ['gas','growth','color','fluorescence']){
  result[field]=form.elements[q+'_'+field]?.value||'';
 }
 const positive=extra.phase==='POSITIVO';
 if(q==='Q3'){result.gas=selected==='Ambos medios'?form.elements['Q3_growth_'+key].value:extra.gas;result.status=result.gas===''?'PENDIENTE':result.gas==='NO'?'CONFORME':'NO_CONFORME';}
 else {const required=key==='A1'?['gas','growth']:['color','fluorescence'];result.status=required.some(f=>!result[f])?'PENDIENTE':required.every(f=>result[f]===(positive?'SI':'NO'))?'CONFORME':'NO_CONFORME';}
 mediumResults[key]=result;
}
if(selected==='Ambos medios'&&status==='CONFORME'&&Object.values(mediumResults).some(v=>v.status!=='CONFORME')){
 activateQc(q);msg.textContent=q+': complete y verifique las observaciones de ambos medios en los campos originales.';return;
}
controls[q]={status,date,reference,notes,...extra,mediumResults};}
// V1.0.255: Q1 compartido cuando se documentan ambos medios; Q2 requiere
// NMP propio por ensayo y no debe heredarse de otra jornada.
const sharedControls=['Q1','Q3'].filter(q=>controls[q].medium==='Ambos medios'&&
 ['CONFORME','NO_CONFORME'].includes(controls[q].status)&&
 ['A1','LMX'].every(k=>['CONFORME','NO_CONFORME'].includes(controls[q].mediumResults?.[k]?.status)));
const sharedRows=sharedControls.length?dailyRows().filter(r=>r.id!==row.id&&r.date===row.date&&r.executedCodes.size>0&&
 ((r.parameter==='Coliformes fecales'&&row.parameter==='Coliformes totales')||
  (r.parameter==='Coliformes totales'&&row.parameter==='Coliformes fecales'))):[];
try{await runTransaction(db,async tx=>{
 const targets=[row,...sharedRows];
 // Firestore exige que todas las lecturas de una transacción precedan a las escrituras.
 const snapshots=[];
 for(const target of targets){const ref=doc(db,'microDailyQuality',target.id);snapshots.push({target,ref,snap:await tx.get(ref)});}
 for(const {target,ref,snap} of snapshots){
  const previous=snap.exists()?snap.data():null;
  const targetControls=target.id===row.id?controls:Object.fromEntries(['Q1','Q2','Q3'].map(q=>{
   const old=previous?.controls?.[q]||{status:'PENDIENTE',date:target.date,notes:'',mediumResults:{}};
   const canShare=sharedControls.includes(q)&&!['CONFORME','NO_CONFORME'].includes(old.status);
   return [q,canShare?{...controls[q],sharedFrom:row.id}:old];
  }));
  if(target.id!==row.id&&!sharedControls.some(q=>!['CONFORME','NO_CONFORME'].includes(previous?.controls?.[q]?.status)))continue;
  const payload={date:target.date,parameter:target.parameter,controls:targetControls,
   sampleCodes:[...target.executedCodes],
   status:Object.values(targetControls).some(x=>x.status==='NO_CONFORME')?'NO_CONFORME':Object.values(targetControls).every(x=>['CONFORME','NO_APLICA'].includes(x.status))?'CONFORME':'PENDIENTE',
   updatedBy:user.uid,updatedAt:serverTimestamp(),createdBy:previous?.createdBy||user.uid,
   createdAt:previous?.createdAt||serverTimestamp(),
   history:[...(previous?.history||[]).slice(-49),{controls:targetControls,uid:user.uid,at:new Date().toISOString()}]};
  tx.set(ref,payload,{merge:true});
 }
});msg.textContent='✓ Registro guardado en Firebase. Q3: '+controls.Q3.status.replaceAll('_',' ')+
 (sharedRows.length?' · Q1/Q3 compartidos con '+sharedRows.map(r=>r.parameter).join(', ')+'.':'')+
 ' Los controles pendientes pueden completarse después.';setTimeout(()=>{if(panel.isConnected)panel.querySelector('#daily-cancel')?.click();},650);}catch(err){msg.textContent='No se pudo guardar: '+err.message;}};openQcOperation(panel,form,row,preferredQc);}));
 const assignment=el.querySelector('#sample-assignment');
 const applyPlannedDate=()=>{const r=pending.find(x=>x.code===assignment.elements.id.value);assignment.elements.plannedDate.value=r?.receivedDate||'';assignment.elements.plannedTime.value=r?.receivedTime||'';};
 assignment.elements.id.addEventListener('change',applyPlannedDate);
 applyPlannedDate();
 assignment.querySelector('#official-cancel').onclick=()=>{editingOfficial=null;assignment.reset();assignment.elements.id.disabled=false;assignment.querySelector('#official-submit').textContent='Ingresar oficialmente y asignar';assignment.querySelector('#official-cancel').hidden=true;applyPlannedDate();};
 // Filtrado local sin consultas por pulsación; el catálogo solo se carga al abrir el módulo.
 const norm=v=>String(v||'').trim().replace(/\s+/g,' ');
 const suggestions=(key,term)=>[...new Set([...(catalog[key]||[]),...records.map(r=>r[key==='companies'?'company':key==='branches'?'branch':'description']).filter(Boolean)])].filter(v=>!term||v.toLocaleLowerCase().includes(term.toLocaleLowerCase())).slice(0,80);
 for(const [name,key,listId] of [['company','companies','micro-companies'],['branch','branches','micro-branches'],['description','descriptions','micro-descriptions']]){
   const input=assignment.elements[name],list=el.querySelector('#'+listId);
   input.addEventListener('input',()=>{list.innerHTML=suggestions(key,input.value).map(v=>`<option value="${esc(v)}"></option>`).join('');});
   list.innerHTML=suggestions(key,'').map(v=>`<option value="${esc(v)}"></option>`).join('');
 }
 attachTablePagination(el);
 bindConsolidated(el);
 bindEasyTime(el.querySelector('#sample-reception'));
 const receptionForm=el.querySelector('#sample-reception');
 if(receptionForm){
  for(const key of ['type','sampledBy','receivedBy','storage']){const control=receptionForm.elements[key];if(control)control.required=true;}
  const parameterInputs=[...receptionForm.querySelectorAll('[name="parameter"]')];
  const validateParameters=()=>{const valid=parameterInputs.some(input=>input.checked);parameterInputs[0]?.setCustomValidity(valid?'':'Seleccione al menos un parámetro.');return valid;};
  parameterInputs.forEach(input=>input.addEventListener('change',validateParameters));
  validateParameters();
 }
 el.querySelector('#sample-reception').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),code=String(f.get('code')).trim().toUpperCase();const pars=f.getAll('parameter');if(!e.target.reportValidity())return;for(const key of ['code','type','receivedDate','sampleTime','sampledBy','receivedTime','receivedBy','storage']){if(!String(f.get(key)||'').trim())return feedback(el,'Complete el campo obligatorio: '+key);}if(!f.get('sampleTime')||!f.get('receivedTime'))return feedback(el,'Seleccione hora y minutos de toma y recepción.');if(!pars.length)return feedback(el,'Seleccione al menos un parámetro.');if(!code||code.endsWith('-R'))return feedback(el,'Código inválido o reservado para duplicados.');if(editingCode&&code!==editingCode)return feedback(el,'No se puede cambiar el código de una muestra existente.');const wasEditing=!!editingCode;const saved=await action(el,async()=>{await runTransaction(db,async tx=>{const ref=doc(db,'microSamples',code),snap=await tx.get(ref);if(snap.exists()&&!editingCode)throw Error('El código ya existe.');if(editingCode&&(!snap.exists()||snap.data().status!=='RECEIVED'))throw Error('Solo puede editarse la recepción pendiente.');const payload={code,type:f.get('type'),parameters:pars,receivedDate:f.get('receivedDate'),sampleTime:f.get('sampleTime'),sampledBy:f.get('sampledBy'),receivedTime:f.get('receivedTime'),receivedBy:f.get('receivedBy'),storage:f.get('storage'),notes:f.get('notes'),status:'RECEIVED',parentId:null,createdBy:user.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),history:[{action:'RECEIVED',uid:user.uid,at:new Date().toISOString()}]};if(editingCode){delete payload.createdAt;delete payload.createdBy;payload.history=[...(snap.data().history||[]),{action:'RECEPTION_EDITED',uid:user.uid,at:new Date().toISOString()}];tx.update(ref,payload);}else tx.set(ref,payload);});editingCode=null;},'Recepción confirmada en Firebase.');if(saved){document.querySelector('#psi-sample-edit-workspace')?.close();if(!wasEditing)refreshSampleCount(el,user,profile,{immediate:true});}};
 el.querySelector('#sample-assignment').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),code=f.get('id');if(!code&&!editingOfficial)return feedback(el,'Seleccione una muestra pendiente.');if(!['LP','NS'].includes(f.get('analyst')))return feedback(el,'Seleccione LP o NS.');const company=norm(f.get('company')),branch=norm(f.get('branch')),description=norm(f.get('description'));if(!company)return feedback(el,'Ingrese la empresa.');const officialSaved=await action(el,async()=>{
   await runTransaction(db,async tx=>{const ref=doc(db,'microSamples',editingOfficial||code),s=await tx.get(ref);if(!s.exists()||(editingOfficial?s.data().status!=='ASSIGNED':s.data().status!=='RECEIVED'))throw Error('La muestra no está disponible para esta operación.');tx.update(ref,{status:'ASSIGNED',plannedDate:f.get('plannedDate'),plannedTime:f.get('plannedTime'),analyst:f.get('analyst'),company,branch,description,assignedBy:user.uid,updatedAt:serverTimestamp(),history:[...(s.data().history||[]),{action:editingOfficial?'OFFICIAL_ENTRY_EDITED':'ASSIGNED',uid:user.uid,at:new Date().toISOString()}]});});
   // El registro principal ya está confirmado: el catálogo auxiliar no bloquea el ingreso.
   try{const values={companies:arrayUnion(),branches:arrayUnion(),descriptions:arrayUnion()};if(company)values.companies=arrayUnion(company);if(branch)values.branches=arrayUnion(branch);if(description)values.descriptions=arrayUnion(description);await setDoc(doc(db,'microCatalogs','officialEntry'),values,{merge:true});for(const [key,value] of [['companies',company],['branches',branch],['descriptions',description]])if(value&&!catalog[key].some(v=>v.toLowerCase()===value.toLowerCase()))catalog[key].push(value);}catch(error){console.warn('Catálogo auxiliar no actualizado (ingreso oficial ya confirmado):',error);}
 },'Ingreso oficial confirmado en Firebase.');if(officialSaved){document.querySelector('#psi-sample-edit-workspace')?.close();editingOfficial=null;}};
 const pendingDateFilter=el.querySelector('#micro-pending-date');if(pendingDateFilter)pendingDateFilter.onchange=()=>el.querySelectorAll('[data-pending-date]').forEach(g=>g.hidden=!!pendingDateFilter.value&&g.dataset.pendingDate!==pendingDateFilter.value);
 el.querySelectorAll('[data-action]').forEach(b=>b.onclick=async()=>{const r=records.find(x=>x.id===b.dataset.id);if(!r)return;if(b.dataset.action==='edit-official'){if(!editable||r.status!=='ASSIGNED')return;editingOfficial=r.id;const form=el.querySelector('#sample-assignment');for(const k of ['plannedDate','plannedTime','analyst','company','branch','description'])form.elements[k].value=r[k]||'';form.elements.id.disabled=true;form.querySelector('#official-submit').textContent='Guardar cambios del ingreso';form.querySelector('#official-cancel').hidden=false;openSampleEditWorkspace(el,r,'official');return;}if(b.dataset.action==='official'){const form=el.querySelector('#sample-assignment');form.elements.id.value=r.code;form.elements.plannedDate.value=r.receivedDate||'';openSampleEditWorkspace(el,r,'official');return;}if(b.dataset.action==='edit'){if(r.status!=='RECEIVED'||!editable)return;editingCode=r.code;const form=el.querySelector('#sample-reception');for(const key of ['code','type','receivedDate','sampleTime','sampledBy','receivedTime','receivedBy','storage','notes'])if(form.elements[key])form.elements[key].value=r[key]||'';form.querySelectorAll('[name=parameter]').forEach(c=>c.checked=(r.parameters||[]).includes(c.value));setEasyTime(form,'sampleTime',r.sampleTime);setEasyTime(form,'receivedTime',r.receivedTime);form.elements.code.readOnly=true;form.querySelector('button[type=submit],button:not([type])').textContent='Guardar corrección de recepción';openSampleEditWorkspace(el,r,'reception');return;}if(b.dataset.action==='trace')return showSampleTrace(r);if(b.dataset.action==='analyze'){analysis(el,r,user,profile,editable);openAnalysisWorkspace(el,r);return;}if(b.dataset.action==='duplicate')await action(el,async()=>runTransaction(db,async tx=>{const orig=doc(db,'microSamples',r.id),dup=doc(db,'microSamples',r.code+'-R');const [s,d]=await Promise.all([tx.get(orig),tx.get(dup)]);if(!s.exists()||d.exists()||s.data().status==='RECEIVED')throw Error('Duplicado existente o muestra sin ingreso oficial.');const source=s.data();tx.set(dup,{...source,code:r.code+'-R',parentId:r.id,status:'ASSIGNED',analysis:null,createdBy:user.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),history:[{action:'DUPLICATE_CREATED',uid:user.uid,at:new Date().toISOString()}]});}),'Duplicado creado con expediente independiente.');});
}
function feedback(el,text){message=text;const node=el.querySelector('#sample-feedback');if(node)node.textContent=text;const modal=document.querySelector('#psi-sample-edit-workspace .psi-modal-status');if(modal)modal.textContent=text;}
async function action(el,fn,ok){try{await fn();feedback(el,ok);return true;}catch(err){feedback(el,`No se guardó: ${err.message||err.code}`);return false;}}
// Programación propuesta: fecales 3 h a 35 °C + 21 h a 44,5 °C;
// totales y E. coli 24 h a 35 °C. Los horarios reales siguen siendo editables.
const pad=n=>String(n).padStart(2,'0');
function addHours(date,time,h){if(!date||!time)return {date:'',time:''};const d=new Date(`${date}T${time}:00`);if(Number.isNaN(d.getTime()))return {date:'',time:''};d.setHours(d.getHours()+h);return {date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,time:`${pad(d.getHours())}:${pad(d.getMinutes())}`};}
// Vista de expediente: el formulario original se traslada temporalmente al diálogo.
// Se preservan sus listeners y su lógica de guardado, sin duplicar operaciones Firebase.
// Diálogo de edición: mueve el formulario real, conservando sus eventos y validaciones.
function openSampleEditWorkspace(el,record,kind){
 const form=el.querySelector(kind==='official'?'#sample-assignment':'#sample-reception');
 if(!form)return;
 document.querySelector('#psi-sample-edit-workspace')?.close();
 const parent=form.parentNode,anchor=document.createComment('PSI: ubicación original del formulario');
 parent.insertBefore(anchor,form);
 const dialog=document.createElement('dialog');dialog.id='psi-sample-edit-workspace';dialog.className='psi-228-dialog psi-229-dialog';
 const header=document.createElement('header');header.className='psi-228-dialog-head';
 const title=document.createElement('div');
 const kicker=document.createElement('small');kicker.textContent='LAB-PSI · EXPEDIENTE DE MUESTRA';
 const heading=document.createElement('h2');heading.textContent=(kind==='official'?'Ingreso oficial':'Edición de recepción')+' · '+(record.code||'');
 const description=document.createElement('p');description.textContent=[record.type,record.company,record.branch].filter(Boolean).join(' · ')||'Complete los campos obligatorios antes de guardar.';
 title.append(kicker,heading,description);
 const badge=document.createElement('span');badge.className='psi-231-sample-badge';badge.textContent=kind==='official'?'ASIGNACIÓN DE ENSAYO':'RECTIFICACIÓN DE RECEPCIÓN';title.append(badge);
 const close=document.createElement('button');close.type='button';close.className='secondary';close.textContent='✕ Cerrar';
 header.append(title,close);
 const body=document.createElement('div');body.className='psi-228-dialog-content psi-229-dialog-content';
 const note=document.createElement('p');note.className='psi-229-note';note.textContent='Los cambios se guardan mediante el procedimiento original del ERP. Cerrar no guarda modificaciones.';
 const section=document.createElement('div');section.className='psi-231-form-heading';section.innerHTML='<span class="psi-231-section-dot" aria-hidden="true"></span><div><strong>Datos del expediente</strong><small>Revise la información y confirme los cambios antes de guardar.</small></div>';
 body.append(note,section,form);const status=document.createElement('p');status.className='psi-modal-status';status.setAttribute('role','status');body.append(status);dialog.append(header,body);
 const restore=()=>{anchor.replaceWith(form);dialog.remove();if(kind==='official')form.querySelector('#official-cancel')?.click();else{form.reset();if(form.elements.code)form.elements.code.readOnly=false;const submit=form.querySelector('button[type=submit],button:not([type])');if(submit)submit.textContent='Registrar recepción';editingCode=null;}};
 close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',restore,{once:true});
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
 document.body.append(dialog);dialog.showModal();
}
function openAnalysisWorkspace(el,record){
 const panel=el.querySelector('#analysis-panel');
 if(!panel||!panel.firstElementChild)return;
 document.querySelector('#psi-analysis-workspace')?.close();
 const dialog=document.createElement('dialog');dialog.id='psi-analysis-workspace';dialog.className='psi-228-dialog';
 const header=document.createElement('header');header.className='psi-228-dialog-head';
 const label=document.createElement('div');label.innerHTML='<small>LAB-PSI · EXPEDIENTE ANALÍTICO</small><h2></h2><p></p>';
 label.querySelector('h2').textContent=record.code||'Muestra';
 label.querySelector('p').textContent=[record.company,record.branch,record.type,record.analyst].filter(Boolean).join(' · ');
 const close=document.createElement('button');close.type='button';close.className='secondary';close.textContent='✕ Cerrar';close.setAttribute('aria-label','Cerrar expediente');
 header.append(label,close);dialog.append(header);
 const content=document.createElement('div');content.className='psi-228-dialog-content';dialog.append(content);
 while(panel.firstChild)content.append(panel.firstChild);
 const restore=()=>{while(content.firstChild)panel.append(content.firstChild);dialog.remove();};
 close.onclick=()=>dialog.close();dialog.addEventListener('close',restore,{once:true});
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 document.body.append(dialog);dialog.showModal();
}
function analysis(el,r,user,profile,editable){
 selected=r.id;const box=el.querySelector('#analysis-panel');if(!box)return;
 const a=r.analysis||{},fecal=(r.parameters||[]).includes('Coliformes fecales'),other=(r.parameters||[]).some(p=>p!=='Coliformes fecales');
 const initialDate=a.date||a.fecal35Date||a.other35Date||r.plannedDate||now(),initialTime=a.fecal35Start||a.other35Start||r.plannedTime||'';
 const stage=(key,label,h,temp)=>`<div class="micro-stage" data-stage="${key}"><h3>${esc(label)}</h3><p>${esc(h)} horas a ${esc(temp)} °C · Fechas y horas editables</p><div class="sample-grid">${field(`${key}Date`,'Fecha de inicio','date',`value="${esc(a[`${key}Date`]||initialDate)}"`)}${field(`${key}Start`,'Hora de inicio','time',`value="${esc(a[`${key}Start`]||initialTime)}"`)}${field(`${key}EndDate`,'Fecha de finalización','date',`value="${esc(a[`${key}EndDate`]||'')}"`)}${field(`${key}End`,'Hora de finalización','time',`value="${esc(a[`${key}End`]||'')}"`)}</div><small class="stage-feedback"></small></div>`;
 box.innerHTML=`<div class="sample-analysis"><div class="workflow-heading"><div><span class="workflow-kicker">ETAPA 03 · PROCESAMIENTO ANALÍTICO</span><h2>Registro de análisis · ${esc(r.code)}</h2></div><span class="workflow-badge">${r.status==='FINISHED'?'Finalizado':'En proceso'}</span></div><p>${esc(r.company)} · ${esc(r.branch)} · ${esc(r.description)} · Analista ${esc(r.analyst)} · ${r.parentId?'Duplicado':'Original'}</p><p class="sample-info">${r.status==='FINISHED'?'Análisis finalizado. Registro bloqueado.':'La fecha y hora previstas se proponen como punto de partida y son editables. La fecha REAL confirmada al finalizar determina la jornada QC Q1/Q2/Q3; la programación original no se modifica.'}</p><form id="sample-analysis-form" class="sample-grid">${field('date','Fecha REAL de ensayo · base de QC Q1/Q2/Q3','date',`required value="${esc(initialDate)}"`)}${field('temp35','Temperatura registrada 35 °C','number',`step="0.1" value="${esc(a.temp35??35)}"`)}${fecal?stage('fecal35','Coliformes fecales · primera incubación',3,35)+field('temp44','Temperatura registrada 44,5 °C','number',`step="0.1" value="${esc(a.temp44??44.5)}"`)+stage('fecal44','Coliformes fecales · segunda incubación',21,44.5):''}${other?stage('other35','Coliformes totales / E. coli · incubación única',24,35):''}${(r.parameters||[]).map((p,i)=>`<fieldset class="sample-parameters"><legend>${esc(p)} · Tubos positivos</legend><div class="sample-grid">${(['Agua potable','Agua de consumo'].includes(r.type)?[['10 mL (10 tubos)',0,10]]:[['10 mL',0,5],['1 mL',1,5],['0,1 mL',2,5]]).map(([label,j,max])=>field(`p${i}_${j}`,label,'number',`min="0" max="${max}" step="1" value="${esc(a.tubes?.[p]?.[j]??'')}"`)).join('')}${field(`d${i}`,'Factor de dilución','number',`min="0.000001" step="any" value="${esc(a.dilutions?.[p]??1)}"`)}</div><div class="nmp-result" data-nmp="${i}" aria-live="polite">Ingrese tubos positivos para calcular el NMP.</div></fieldset>`).join('')}${field('notes','Observaciones','text',`maxlength="400" value="${esc(a.notes||'')}"`)}<div class="sample-actions"><button type="submit" ${!editable||r.status==='FINISHED'?'disabled':''}>💾 Guardar borrador</button><button type="button" class="secondary" id="analysis-validate">✓ Validar análisis</button><button type="button" class="secondary" id="analysis-finish" ${!editable||r.status==='FINISHED'?'disabled':''}>🔒 Finalizar análisis</button></div></form><p id="analysis-feedback" role="status"></p></div>`;
 const form=box.querySelector('form'),out=box.querySelector('#analysis-feedback');
 const stages=[...(fecal?[['fecal35',3],['fecal44',21]]:[]),...(other?[['other35',24]]:[])];
 const calculate=(key,h,force=false)=>{const sd=form.elements[`${key}Date`],st=form.elements[`${key}Start`],ed=form.elements[`${key}EndDate`],et=form.elements[`${key}End`];const value=addHours(sd.value,st.value,h);if(value.date&&(force||!ed.value))ed.value=value.date;if(value.time&&(force||!et.value))et.value=value.time;};
 // El cambio de fecha QC actualiza el inicio propuesto solo cuando no hay un horario histórico independiente.
 const qcDate=form.elements.date,firstKey=fecal?'fecal35':other?'other35':null;
 if(firstKey&&r.status!=='FINISHED'){
   qcDate.addEventListener('change',()=>{
     const previous=qcDate.dataset.previous||initialDate;
     for(const [key] of stages){
       const sd=form.elements[`${key}Date`];
       if(sd.value===previous){sd.value=qcDate.value;sd.dispatchEvent(new Event('change'));}
     }
     qcDate.dataset.previous=qcDate.value;
   });
   const firstDate=form.elements[`${firstKey}Date`];
   firstDate.addEventListener('change',()=>{if(qcDate.value!==firstDate.value){qcDate.value=firstDate.value;qcDate.dataset.previous=firstDate.value;}});
 }
 for(const [key,h] of stages){const sd=form.elements[`${key}Date`],st=form.elements[`${key}Start`];sd.addEventListener('change',()=>calculate(key,h,true));st.addEventListener('change',()=>calculate(key,h,true));calculate(key,h);}
 if(fecal){const sync=()=>{const d=form.elements.fecal35EndDate.value,t=form.elements.fecal35End.value;if(d&&t){form.elements.fecal44Date.value=d;form.elements.fecal44Start.value=t;calculate('fecal44',21,true);}};for(const k of ['fecal35Date','fecal35Start','fecal35EndDate','fecal35End'])form.elements[k].addEventListener('change',sync);if(!a.fecal44Date)sync();}
 const collect=()=>{const f=new FormData(form),tubes={},dilutions={};for(const [i,p] of r.parameters.entries()){tubes[p]=[0,1,2].map(j=>{const v=f.get(`p${i}_${j}`);return v===null||v===''?null:Number(v);});dilutions[p]=Number(f.get(`d${i}`));}const data={date:f.get('date'),temp35:f.get('temp35'),notes:f.get('notes'),tubes,dilutions};if(fecal)data.temp44=f.get('temp44');for(const [key] of stages)for(const suffix of ['Date','Start','EndDate','End'])data[key+suffix]=f.get(key+suffix);return data;};
 const validate=()=>{const d=collect(),issues=[];if(!d.date)issues.push('Fecha real de ensayo');if(firstKey&&d[firstKey+'Date']&&d.date!==d[firstKey+'Date'])issues.push('La fecha real de ensayo debe coincidir con el inicio de la primera incubación.');for(const [key,h] of stages){const sd=d[key+'Date'],st=d[key+'Start'],ed=d[key+'EndDate'],et=d[key+'End'];if(!sd||!st||!ed||!et)issues.push(`Horarios completos de ${key}`);else if(new Date(`${ed}T${et}`)<=new Date(`${sd}T${st}`))issues.push(`Fin posterior al inicio en ${key}`);}for(const p of r.parameters){if(!nmpLookup(r.type,d.tubes[p]))issues.push(`Combinación NMP no disponible o incompleta de ${p}`);if(!(d.dilutions[p]>0))issues.push(`Dilución de ${p}`);}return issues;};
 const updateNmp=()=>{const d=collect();for(const [i,p] of r.parameters.entries()){const target=form.querySelector(`[data-nmp="${i}"]`),entry=nmpLookup(r.type,d.tubes[p]);if(!target)continue;target.textContent=entry?`NMP/100 mL: ${scaledNmp(entry.value,d.dilutions[p])} · IC 95 %: ${scaledNmp(entry.low,d.dilutions[p])} – ${scaledNmp(entry.high,d.dilutions[p])} · ${entry.source==='ESTIMATED'?'Estimación estadística (combinación no tabulada)':'Tabla '+(['Agua potable','Agua de consumo'].includes(r.type)?'10 × 10 mL':'9221:IV · 5-5-5')} (base: ${entry.value})`:'⚠️ Complete los tubos o revise la combinación: no consta en la tabla verificada.';}};
 form.addEventListener('input',updateNmp);form.addEventListener('change',updateNmp);updateNmp();
 form.querySelector('#analysis-finish').onclick=async()=>{
 if(!editable||r.status==='FINISHED')return;
 const issues=validate();
 if(issues.length){out.textContent='⚠️ No se puede finalizar: '+issues.join(' · ');return;}
 if(!confirm('¿Confirma la fecha REAL de ensayo '+collect().date+' para vincular Q1/Q2/Q3, así como las incubaciones y resultados NMP? El análisis quedará bloqueado.'))return;
 const data=collect();
 data.nmpResults=Object.fromEntries(r.parameters.map(p=>{const entry=nmpLookup(r.type,data.tubes[p]);return [p,{table:['Agua potable','Agua de consumo'].includes(r.type)?'9221B_10x10':'9221B_555',base:entry.value,lower:entry.low,upper:entry.high,source:entry.source||'TABLE',dilution:data.dilutions[p],result:scaledNmp(entry.value,data.dilutions[p])}];}));
 const finishButton=form.querySelector('#analysis-finish');
 finishButton.disabled=true;
 finishButton.textContent='Guardando en Firebase…';
 out.textContent='Guardando análisis; espere la confirmación del servidor…';
 let committed=false;
 try{
  await runTransaction(db,async tx=>{
   const ref=doc(db,'microSamples',r.id),snap=await tx.get(ref);
   if(!snap.exists()||snap.data().status!=='ASSIGNED')throw Error('La muestra ya no está pendiente.');
   tx.update(ref,{status:'FINISHED',analysis:data,updatedAt:serverTimestamp(),history:[...(snap.data().history||[]),{action:'ANALYSIS_FINISHED',uid:user.uid,at:new Date().toISOString()}]});
  });
  committed=true;
 }catch(err){
  finishButton.disabled=false;
  finishButton.textContent='🔒 Finalizar análisis';
  out.textContent=(err.code==='permission-denied'||String(err.message).includes('permission'))?'⛔ Firebase rechazó el cierre (permission-denied). Verifique los permisos de muestras.':'No se pudo finalizar: '+err.message;
  return;
 }
 // Ninguna tarea posterior puede convertir una escritura confirmada en un error de guardado.
 if(committed){
  out.textContent='✓ Análisis '+r.code+' finalizado y confirmado en Firebase.';
  try{updateLocalSample(r.id,{status:'FINISHED',analysis:data});}catch(err){console.warn('Actualización local pendiente:',err);}
  // El conteo se vuelve a consultar al servidor; no anticipar números no confirmados.
  message='✓ Análisis '+r.code+' finalizado y confirmado en Firebase.';
  try{document.querySelector('#psi-analysis-workspace[open]')?.close();if(el.isConnected)display(el,user,profile);}catch(err){console.error('Error de presentación posterior al guardado:',err);if(out.isConnected)out.textContent=message;}
  try{refreshSampleCount(el,user,profile);}catch(err){console.warn('Conteo auxiliar pendiente:',err);}
 }
};
 form.querySelector('#analysis-validate').onclick=()=>{const issues=validate();updateNmp();out.textContent=issues.length?'⚠️ Pendiente: '+issues.join(' · '):'✓ Campos completos, combinación NMP disponible y cronología coherente.';};
 form.onsubmit=async e=>{e.preventDefault();if(!editable||r.status==='FINISHED')return;const data=collect();try{await runTransaction(db,async tx=>{const ref=doc(db,'microSamples',r.id),s=await tx.get(ref);if(!s.exists()||s.data().status!=='ASSIGNED')throw Error('El registro ya no admite cambios.');tx.update(ref,{analysis:data,updatedAt:serverTimestamp(),history:[...(s.data().history||[]),{action:'ANALYSIS_DRAFT',uid:user.uid,at:new Date().toISOString()}]});});out.textContent='✓ Borrador confirmado en Firebase. Los horarios reales siguen siendo editables.';}catch(err){out.textContent='Error: '+err.message;}};
 (form.closest('#psi-analysis-workspace')||box).scrollIntoView({behavior:'smooth',block:'nearest'});
}
function subscribeSamples(el,user,profile){
 const token=++sampleListenerToken;
 if(unsub){unsub();unsub=null;}
 if(unsubPending){unsubPending();unsubPending=null;}
 const refresh=()=>{if(token!==sampleListenerToken)return;mergeSampleWindows();resolveMetricsFromCompleteHistory();if(el.isConnected)display(el,user,profile);};
 unsub=onSnapshot(query(collection(db,'microSamples'),orderBy('createdAt','desc'),limit(SAMPLE_PAGE_SIZE)),snapshot=>{
  if(token!==sampleListenerToken)return;
  const previousRecentIds=recentSamples.map(r=>r.id).join("|");
  recentSamples=snapshot.docs.map(d=>({id:d.id,...d.data()}));
  const recentMembershipChanged=previousRecentIds!==recentSamples.map(r=>r.id).join("|");
  const wasRecentReady=recentSnapshotReady;recentSnapshotReady=true;
  // El cursor inicial corresponde a la última muestra de la primera página.
  // No desplazarlo con nuevas muestras mientras se navega el historial.
  if(!historicalCursor&&snapshot.docs.length)historicalCursor=snapshot.docs.at(-1);
  if(snapshot.docs.length<SAMPLE_PAGE_SIZE)historyExhausted=true;
  refresh();
  // La carga inicial se realiza una sola vez y en segundo plano, sin clics ni bucles de renderizado.
  if(!historyAutoStarted){historyAutoStarted=true;queueMicrotask(()=>ensureAnalyticalHistory(el,user,profile));}
  // Las altas de otras computadoras también actualizan el total, sin sondeo continuo.
  if(wasRecentReady&&recentMembershipChanged&&!snapshot.metadata.hasPendingWrites){
   // Mantener último valor confirmado mientras se verifica el conteo remoto.
   // No borrar las cifras durante la actualización: evita parpadeos 748 → … → 748.
   refreshSampleCount(el,user,profile,{immediate:true});
  }
 },err=>{if(token===sampleListenerToken)feedback(el,'Error de consulta: '+err.message);});
 // Los pendientes no deben desaparecer aunque queden fuera de la ventana reciente.
 // Dos consultas por estado; Firestore permite índices de campo único por defecto.
 const pendingByStatus={RECEIVED:[],ASSIGNED:[]};
 const unsubscribers=['RECEIVED','ASSIGNED'].map(status=>onSnapshot(
  query(collection(db,'microSamples'),where('status','==',status)),snapshot=>{
   if(token!==sampleListenerToken)return;
   pendingByStatus[status]=snapshot.docs.map(d=>({id:d.id,...d.data()}));
   pendingReady[status]=true;
   pendingSamples=[...pendingByStatus.RECEIVED,...pendingByStatus.ASSIGNED];refresh();
  },err=>{if(token===sampleListenerToken)feedback(el,'Error consultando pendientes: '+err.message);}
 ));
 unsubPending=()=>unsubscribers.forEach(fn=>fn());
}
export function stopSamples(){
 ++sampleListenerToken;
 ++countRefreshSeq;
 if(countRefreshTimer){clearTimeout(countRefreshTimer);countRefreshTimer=null;}
 if(unsub){unsub();unsub=null;}
 if(unsubPending){unsubPending();unsubPending=null;}
 if(unsubDaily){unsubDaily();unsubDaily=null;}
 if(summaryUnsubscribe){summaryUnsubscribe();summaryUnsubscribe=null;}
}
export function renderSamples(el,user,profile,mode="samples"){
 stopSamples();sampleViewMode=mode;
 dailyControls=[];records=[];recentSamples=[];historicalSamples=[];pendingSamples=[];historicalCursor=null;historyExhausted=false;historyLoading=false;sampleTotal=Number.isInteger(cachedMetrics().total)?cachedMetrics().total:null;globalMetrics={finished:Number.isInteger(cachedMetrics().finished)?cachedMetrics().finished:null,duplicates:Number.isInteger(cachedMetrics().duplicates)?cachedMetrics().duplicates:null};metricError="";pendingReady={RECEIVED:false,ASSIGNED:false};recentSnapshotReady=false;historyAutoRunning=false;historyAutoStarted=false;historyError='';
 plannerLoaded=false;plannerError='';plannerAutoRequested=false;plannerMedia=[];plannerReactions=[];message='';catalog={companies:[],branches:[],descriptions:[]};
 display(el,user,profile);
 refreshSampleCount(el,user,profile,{immediate:true});
 subscribeSummary(el,user,profile);
 getDoc(doc(db,'microCatalogs','officialEntry')).then(s=>{if(s.exists()){for(const k of Object.keys(catalog))catalog[k]=Array.isArray(s.data()[k])?s.data()[k]:[];if(el.isConnected)display(el,user,profile);}}).catch(err=>feedback(el,'No se pudo cargar el catálogo: '+err.message));
 unsubDaily=onSnapshot(query(collection(db,'microDailyQuality'),orderBy('date','desc'),limit(350)),snapshot=>{dailyControls=snapshot.docs.map(d=>({id:d.id,...d.data()}));if(el.isConnected)display(el,user,profile);},err=>feedback(el,'No se pudieron consultar los controles diarios: '+err.message));
 subscribeSamples(el,user,profile);
}
