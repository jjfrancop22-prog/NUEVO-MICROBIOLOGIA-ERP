// Capa de interfaz: no altera transacciones, validaciones ni consultas de Firestore.
export function enhanceMedia246(root, currentView) {
  if (!root) return;
  root.classList.add('media-pro-246');
  const title=root.querySelector('h1');
  if(title) title.textContent='Control de medios preparados';
  const eyebrow=root.querySelector('.eyebrow');
  if(eyebrow) eyebrow.textContent='RECURSOS MICROBIOLÓGICOS · V1.0.247';
  const tabs=root.querySelector('.product-tabs');
  if(tabs) tabs.setAttribute('aria-label','Etapas de medios de cultivo');
  root.querySelectorAll('[data-media-tab]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.classList.contains('active'))));
  const form=root.querySelector('#media-form');
  if(currentView==='prep' && form){
    const card=form.closest('.media-card');
    if(card){
      const header=document.createElement('div');
      header.className='media-246-head';
      header.innerHTML='<div><strong>Preparaciones de medios</strong><p>Registro controlado con cálculo automático de masa y descuento único del frasco comercial.</p></div><button type="button" class="media-246-primary" id="media-246-new">+ Nueva preparación</button>';
      card.prepend(header);
      const intro=Array.from(card.children).filter(x=>x!==header&&x!==form);
      intro.forEach(x=>x.classList.add('media-246-original-intro'));
      const placeholder=document.createElement('div');placeholder.className='media-246-placeholder';
      placeholder.innerHTML='<span>🧫</span><strong>Preparación documentada</strong><p>Seleccione «Nueva preparación» para registrar el medio, verificar el frasco y calcular la masa antes de guardar.</p>';
      card.append(placeholder);
      const host=document.createElement('div');host.className='media-246-modal';host.hidden=true;
      host.innerHTML='<div class="media-246-dialog" role="dialog" aria-modal="true" aria-label="Nueva preparación"><div class="media-246-modal-head"><div><small>LAB-PSI · MEDIOS DE CULTIVO</small><h2>Nueva preparación</h2></div><button type="button" class="media-246-close" aria-label="Cerrar ventana">✕</button></div><div class="media-246-modal-body"></div></div>';
      card.append(host);
      const body=host.querySelector('.media-246-modal-body');
      body.append(form);
      const open=()=>{host.hidden=false;document.body.classList.add('media-246-modal-open');host.querySelector('.media-246-close').focus();};
      const close=()=>{host.hidden=true;document.body.classList.remove('media-246-modal-open');};
      header.querySelector('button').onclick=open;
      host.querySelector('.media-246-close').onclick=close;
      host.addEventListener('click',e=>{if(e.target===host)close();});
      host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
      // La ventana conserva el mismo formulario y el mismo manejador de guardado.
    }
  }
  if(currentView==='register'){
    const table=root.querySelector('.media-register-table');
    const rows=Array.from(table?.querySelectorAll('tbody tr[data-media-record]')||[]);
    const search=root.querySelector('#media-register-search');
    const status=root.querySelector('#media-register-status');
    const counter=root.querySelector('#media-register-count');
    if(table&&rows.length){
      const bar=document.createElement('div');bar.className='media-246-pagination';
      bar.innerHTML='<label>Mostrar <select aria-label="Registros por página"><option>10</option><option>25</option><option>50</option></select></label><span class="media-246-page-count"></span><button type="button" data-prev>Anterior</button><button type="button" data-next>Siguiente</button>';
      table.closest('.product-table-wrap').after(bar);
      const size=bar.querySelector('select');let page=0;
      const apply=()=>{
        const q=(search?.value||'').trim().toLowerCase(), st=status?.value||'';
        const matched=rows.filter(r=>(!q||(r.dataset.search||'').includes(q))&&(!st||st==='ALL'||r.dataset.state===st));
        const totalPages=Math.max(1,Math.ceil(matched.length/Number(size.value)));
        page=Math.min(page,totalPages-1);
        const from=page*Number(size.value), visible=new Set(matched.slice(from,from+Number(size.value)));
        rows.forEach(r=>r.hidden=!visible.has(r));
        bar.querySelector('.media-246-page-count').textContent=`${matched.length} coincidencias · Página ${page+1} de ${totalPages}`;
        bar.querySelector('[data-prev]').disabled=page===0;
        bar.querySelector('[data-next]').disabled=page>=totalPages-1;
        if(counter)counter.textContent=`${matched.length} coincidencias`;
      };
      // Captura posterior al filtro heredado, para aplicar la paginación sobre todas las coincidencias cargadas.
      [search,status].forEach(el=>el?.addEventListener(el===search?'input':'change',()=>{page=0;queueMicrotask(apply);}));
      size.onchange=()=>{page=0;apply();};
      bar.querySelector('[data-prev]').onclick=()=>{page--;apply();};
      bar.querySelector('[data-next]').onclick=()=>{page++;apply();};
      apply();
    }
  }
}
