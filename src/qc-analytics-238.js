// V1.0.238 — Estadísticas sobre las jornadas ya consultadas, sin lecturas adicionales.
export function enhanceQcAnalytics(root){
 const section=root.querySelector('#micro-daily-editor')?.closest('section.sample-section');
 const table=section?.querySelector('table.sample-table');
 const toolbar=section?.querySelector('.qc235-toolbar');
 if(!table?.tBodies[0]||!toolbar)return;
 const rows=[...table.tBodies[0].rows].filter(r=>r.cells.length>=7);
 const panel=document.createElement('section');panel.className='qc238-panel';
 panel.innerHTML=`<div class="qc238-title"><div><small>INTELIGENCIA DE CALIDAD · Q1 / Q2 / Q3</small><h3>Comparativo de jornadas consultadas</h3><p>Los indicadores siguen los filtros de búsqueda, fecha y estado. Cada control se contabiliza por separado.</p></div><span class="qc238-scope">Datos cargados · sin consultas adicionales</span></div><div class="qc238-kpis" aria-live="polite"></div><div class="qc238-bars"></div><p class="qc238-disclaimer">Estadística descriptiva de la consulta actual; no es un indicador oficial de cumplimiento de todo el histórico. «Sin evaluar» no equivale a «No conforme».</p>`;
 toolbar.before(panel);
 const inputs=[...toolbar.querySelectorAll('input,select')];const [search,from,to,state]=inputs;
 const normalized=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 function classify(raw){const s=normalized(raw);if(s.includes('NO CONFORME')||s.includes('NO_CONFORME'))return 'no';if(s.includes('CONFORME'))return 'yes';if(s.includes('NO APLICA'))return 'na';return 'pending';}
 function render(){
  const term=normalized(search.value.trim());
  const matched=rows.filter(row=>{const date=row.cells[0]?.textContent.trim()||'';const statuses=[4,5,6].map(i=>row.cells[i]?.textContent||'').join(' ');return (!term||normalized(row.textContent).includes(term))&&(!from.value||date>=from.value)&&(!to.value||date<=to.value)&&(!state.value||normalized(statuses).includes(normalized(state.value)));});
  const totals=['Q1','Q2','Q3'].map((name,index)=>{const count={yes:0,no:0,pending:0,na:0};matched.forEach(row=>count[classify(row.cells[index+4]?.textContent)]++);return {name,...count};});
  const count=(key)=>totals.reduce((n,c)=>n+c[key],0);const evaluated=count('yes')+count('no');const pct=evaluated?Math.round(count('yes')/evaluated*100):null;
  const kpis=[['Jornadas coincidentes',matched.length],['Controles conformes',count('yes')],['No conformes',count('no')],['Pendientes / sin evaluar',count('pending')],['Conformidad evaluada',pct===null?'Sin datos':pct+' %']];
  panel.querySelector('.qc238-kpis').innerHTML=kpis.map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join('');
  panel.querySelector('.qc238-bars').innerHTML=totals.map(c=>{const n=c.yes+c.no;const percent=n?Math.round(c.yes/n*100):0;return `<div class="qc238-row"><div class="qc238-rowhead"><b>${c.name}</b><span>${c.yes} conformes · ${c.no} no conformes · ${c.pending} pendientes · ${c.na} no aplica</span></div><div class="qc238-track" role="img" aria-label="${c.name}: ${n?percent+' por ciento conforme entre evaluados':'sin evaluaciones'}"><div style="width:${percent}%"></div></div><small>${n?percent+' % conforme entre controles evaluados':'Sin evaluaciones concluidas'}</small></div>`}).join('');
 }
 toolbar.addEventListener('input',render);toolbar.addEventListener('change',render);toolbar.querySelector('.qc235-clear')?.addEventListener('click',()=>queueMicrotask(render));render();
}
