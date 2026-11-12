// V1.0.80 — Evaluación conservadora. No confundir ausencia de evidencia con no conformidad.
// V1.0.97: Q1 se programa cada 2 días hábiles permitidos; la FASE se alterna
// por períodos de 15 días calendario, no por cada control ejecutado.
// El registro previo con fecha real y fase documentada sirve de referencia.
// La fase se calcula desde el ancla histórica del ciclo de 15 días,
// no desde el último registro: así un control intermedio no reinicia el ciclo.
export const qcPhaseFor=(history,date,id,kind='Q1')=>{
 const valid=history.flatMap(x=>{const c=x.controls?.[kind];return x.id!==id&&c&&/^\d{4}-\d{2}-\d{2}$/.test(c.date||'')&&['CONFORME','NO_CONFORME'].includes(c.status)&&['POSITIVO','NEGATIVO'].includes(c.phase)?[{date:c.date,phase:c.phase}]:[];});
 // Ancla aprobada Q1: 08/01/2026 positivo; 23/01/2026 negativo.
 // No se infiere un ancla equivalente para Q2 sin registros verificables.
 if(kind==='Q1')valid.push({date:'2026-01-08',phase:'POSITIVO'});
 const anchor=valid.sort((a,b)=>a.date.localeCompare(b.date))[0];
 if(!anchor)return '';
 const days=Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse(anchor.date+'T00:00:00Z'))/86400000);
 const periods=Math.floor(days/15);
 return ((periods%2)+2)%2===0?anchor.phase:(anchor.phase==='POSITIVO'?'NEGATIVO':'POSITIVO');
};
export const qcPhase=(history,date,id)=>qcPhaseFor(history,date,id,'Q1');
export const qcAtcc=(medium,phase)=>medium==='A-1 Medium'?(phase==='POSITIVO'?'11775':'29212'):(phase==='POSITIVO'?'11775':'14028');
export const qcResources=(media,reactions,day,medium,phase)=>{
 const names=medium==='Ambos medios'?['A-1 Medium','Fluorocult LMX']:medium?[medium]:[];
 return names.map(name=>{
  const prefix=name==='A-1 Medium'?'AC':'LMX';const atcc=qcAtcc(name,phase);
  const lots=media.filter(p=>(p.mediumId===prefix||String(p.mediumName||'').toLowerCase().includes(name==='A-1 Medium'?'a-1':'fluorocult'))&&['LIBERADO','LIBERADO_HISTORICO'].includes(p.status)&&p.qc==='CONFORME'&&(!p.performanceRequired||p.performance==='CONFORME')&&p.date<=day&&p.expiry>=day&&(!p.historicalReleaseDate||p.historicalReleaseDate<=day));
  const valid=reactions.filter(r=>String(r.atcc||'').replace(/\D/g,'')===atcc&&r.status==='APTA'&&(r.date||r.reactivationDate)<=day&&(r.validUntil||r.expiry)>=day);
  return {name,atcc,lots,valid};
 });
};
export const qcVerdict=(form,resources)=>{
 const v=k=>form.elements['Q1_'+k]?.value||'';const phase=v('phase');
 if(!resources.length)return {status:'PENDIENTE',reason:'Seleccione el medio realmente ensayado.'};
 const missing=resources.filter(r=>!r.lots.length||!r.valid.length);
 if(missing.length)return {status:'PENDIENTE',reason:'Faltan recursos verificables para '+missing.map(r=>r.name+' (lote '+(r.lots.length?'✓':'ausente')+', cepa ATCC '+r.atcc+' '+(r.valid.length?'✓':'sin reactivación APTA')+')').join('; ')};
 if(!v('start35')||!v('end35')||!v('temp35'))return {status:'PENDIENTE',reason:'Registre la incubación real de 35 °C.'};
 const t=Number(v('temp35'));if(!Number.isFinite(t)||t<34.5||t>35.5)return {status:'NO_CONFORME',reason:'Temperatura 35 °C fuera del intervalo configurado.'};
 if(new Date(v('end35'))<=new Date(v('start35')))return {status:'NO_CONFORME',reason:'La finalización debe ser posterior al inicio.'};
 if(resources.some(r=>r.name==='A-1 Medium')){
  if(!v('start44')||!v('end44')||!v('temp44'))return {status:'PENDIENTE',reason:'Complete la segunda etapa de incubación A-1.'};
  const t44=Number(v('temp44'));if(t44<44||t44>45||new Date(v('end44'))<=new Date(v('start44')))return {status:'NO_CONFORME',reason:'Condición de 44,5 °C fuera del criterio configurado.'};
 }
 const expected=phase==='POSITIVO'?'SI':'NO';
 if(resources.some(r=>r.name==='A-1 Medium')){
  if(!v('gas')||!v('growth'))return {status:'PENDIENTE',reason:'Complete gas y crecimiento/turbidez del A-1 Medium.'};
  if(v('gas')!==expected||v('growth')!==expected)return {status:'NO_CONFORME',reason:'Observaciones A-1 discordantes con la fase '+phase+'.'};
 }
 if(resources.some(r=>r.name==='Fluorocult LMX')){
  const both=resources.some(r=>r.name==='A-1 Medium');
  const color=v('color');
  const fluorescence=v('fluorescence');
  if(!color||!fluorescence)return {status:'PENDIENTE',reason:'Complete color azul-verde y fluorescencia del LMX.'};
  if(color!==expected||fluorescence!==expected)return {status:'NO_CONFORME',reason:'Reacciones LMX discordantes con la fase '+phase+'.'};
 }
 return {status:'CONFORME',reason:'Recursos vigentes y observaciones compatibles con los criterios configurados. Revisar evidencia de tiempos y método antes de liberación.'};
};
