import {watchAlertQuery} from './shared-alert-listeners.js';
import {collection,onSnapshot} from 'firebase/firestore';
import {PERIODIC_CLEANING,cleaningSchedule} from './cleaning-frequency.js';
// Alertas calculadas a partir de registros existentes; sin escrituras ni duplicados.
const localToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateOf=e=>String(e.date||e.receivedDate||e.plannedDate||e.createdAt?.toDate?.()?.toISOString()?.slice(0,10)||'');
const isBroth=e=>e.type==='CALDO'||/caldo|broth|bhi|fluorocult|a-1/i.test(String(e.mediumName||''));
const code=e=>String(e.code||e.canonicalCode||e.id||'');
const equipmentNames={des:'Autoclave de descontaminación',est:'Autoclave de esterilización',freezer:'Congelador',sterilizer:'Esterilizador',incubator:'Incubadora',fridge2:'Nevera 2 EI-344',fridge:'Nevera EI-61'};
export function watchCleaningAlerts(db,notify){
 const names=['microCleaningRecords','microSamples','microMediaPreparations','microStrainPreparations','microStrainReactivations'];
 const state=Object.fromEntries(names.map(n=>[n,[]]));const ready=new Set();const failed=new Set();let stopped=false;
 const publish=()=>{
  if(stopped||!ready.has('microCleaningRecords'))return;
  const today=localToday(),records=state.microCleaningRecords;
  const periodic=Object.keys(PERIODIC_CLEANING).map(id=>{
   const schedule=cleaningSchedule(id,records,today);
   return {id,name:equipmentNames[id],record:id==='des'||id==='est'?'PG0419':'PG0420',unit:'limpieza',date:schedule.next,dueDate:schedule.next,count:1,codes:[schedule.last?'Última: '+schedule.last:'Sin registro anterior'],state:schedule.state,remaining:schedule.remaining,days:schedule.days};
  }).filter(a=>a.remaining<=2);
  const groups=[
   {source:'microSamples',id:'hood',name:'Cabina de flujo laminar',record:'PG0422',unit:'muestras',eligible:e=>e.status==='FINISHED'||!!e.analysis},
   {source:'microMediaPreparations',id:'balance',name:'Balanza + pHmetro',record:'PG0420',unit:'preparaciones',eligible:isBroth},
   {source:'microStrainPreparations',id:'turb',name:'Turbidímetro / densitómetro',record:'PG0420',unit:'cepas',eligible:()=>true}
  ];
  // Control diario prioritario: dos momentos independientes, únicamente lunes a viernes.
  // El cierre no se ofrece como acción exigible hasta registrar el inicio.
  const dayOfWeek=new Date(today+'T12:00:00').getDay();
  const areaRecords=records.filter(r=>r.element==='area'&&r.date===today);
  const hasStart=areaRecords.some(r=>r.moment==='INICIO');
  const hasEnd=areaRecords.some(r=>r.moment==='FINAL');
  const areaDaily=(dayOfWeek!==0&&dayOfWeek!==6)?[
   ...(!hasStart?[{id:'area',moment:'INICIO',name:'Pisos y superficies · Inicio de jornada',record:'PG0418',unit:'control',date:today,dueDate:today,count:1,codes:['Inicio pendiente'],state:'PENDIENTE',remaining:0,priority:0}]:[]),
   ...(hasStart&&!hasEnd?[{id:'area',moment:'FINAL',name:'Pisos y superficies · Final de jornada',record:'PG0418',unit:'control',date:today,dueDate:today,count:1,codes:['Cierre pendiente'],state:'PENDIENTE',remaining:0,priority:0}]:[])
  ]:[];
  const daily=[];
  for(const g of groups){
   if(!ready.has(g.source))continue;
   const rows=state[g.source].filter(e=>dateOf(e)===today&&g.eligible(e));
   if(g.id==='turb'&&ready.has('microStrainReactivations'))rows.push(...state.microStrainReactivations.filter(e=>dateOf(e)===today));
   if(!rows.length)continue;
   const done=g.id==='balance'?['balance','ph'].every(id=>records.some(r=>r.element===id&&r.date===today)):records.some(r=>r.element===g.id&&r.date===today&&r.moment==='UNICA');
   if(!done)daily.push({id:g.id,name:g.name,record:g.record,unit:g.unit,date:today,dueDate:today,count:rows.length,codes:[...new Set(rows.map(code))],state:'PENDIENTE',remaining:0});
  }
  notify([...areaDaily,...periodic,...daily],{failed:[...failed],ready:[...ready]});
 };
 const stops=names.map(name=>watchAlertQuery(collection(db,name),snap=>{state[name]=snap.docs.map(d=>({id:d.id,...d.data()}));ready.add(name);failed.delete(name);publish()},err=>{console.warn('Alertas de limpieza:',name,err);failed.add(name);ready.delete(name);publish()}));
 return ()=>{stopped=true;stops.forEach(stop=>stop())};
}
