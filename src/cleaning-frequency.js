// Calendario por fecha efectiva; sin reinicio por mes ni por semana civil.
export const PERIODIC_CLEANING={des:7,est:7,freezer:30,sterilizer:30,incubator:30,fridge2:30,fridge:30};
export const CLEANING_EPOCH='2026-01-01';
export const shiftCleaningDate=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export function cleaningSchedule(id,records,at){const days=PERIODIC_CLEANING[id];if(!days)return null;const dates=records.filter(r=>r.element===id&&r.moment==='UNICA'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')&&r.date<=at).map(r=>r.date).sort();const last=dates.at(-1)||null;const next=shiftCleaningDate(last||CLEANING_EPOCH,days);const remaining=Math.round((Date.parse(next+'T12:00:00Z')-Date.parse(at+'T12:00:00Z'))/86400000);return {days,last,next,remaining,state:remaining<0?'ATRASADA':remaining===0?'PENDIENTE':remaining<=2?'PRÓXIMA':'VIGENTE'};}
