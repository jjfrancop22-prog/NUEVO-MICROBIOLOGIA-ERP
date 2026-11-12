/* V1.0.245 — Navegación operativa y accesibilidad, sin alterar escrituras Firebase. */
const titles={catalog:'Catálogo',receive:'Recepción',stock:'Inventario',use:'Movimientos',close:'Cierre / descarte',history:'Historial'};
export function enhanceProductWorkspace(root){
 const page=root?.querySelector('.product-page');if(!page)return;
 const nav=page.querySelectorAll('[data-tab]');if(!nav.length)return;
 const selected=[...nav].find(b=>b.classList.contains('active'));
 const current=selected?.dataset.tab||'catalog';
 const bar=document.createElement('div');bar.className='psi-products-245-workbar';
 bar.innerHTML=`<div class="psi-products-245-label"><span class="psi-products-245-dot" aria-hidden="true"></span><div><strong>${titles[current]||'Productos y lotes'}</strong><small>Gestión de recursos · LAB-PSI</small></div></div><div class="psi-products-245-actions"><button type="button" data-psi245="search" title="Ir a la búsqueda del módulo">⌕ Buscar</button><button type="button" data-psi245="refresh" title="Actualizar la presentación con los datos recibidos">↻ Actualizar vista</button></div>`;
 const target=page.querySelector('.product-panel')||page.querySelector('.product-tabs');
 if(target)target.before(bar);
 bar.querySelector('[data-psi245="search"]').onclick=()=>{const input=page.querySelector('#product-search,#stock-search,#close-search,.psi-history-search,#history-lot');if(input){input.focus();input.scrollIntoView({block:'center',behavior:'smooth'});}else{const first=page.querySelector('.psi-open-module,#psi-product-new');first?.focus();}};
 bar.querySelector('[data-psi245="refresh"]').onclick=()=>{const el=page.querySelector('.product-panel');if(!el)return;el.classList.remove('psi-products-245-flash');void el.offsetWidth;el.classList.add('psi-products-245-flash');const feedback=bar.querySelector('.psi-products-245-label small');feedback.textContent='Vista actualizada · datos disponibles en sesión';};
 nav.forEach(b=>{b.setAttribute('aria-pressed',String(b.classList.contains('active')));b.setAttribute('title','Abrir '+(titles[b.dataset.tab]||b.textContent.trim()));});
 const pager=page.querySelector('.psi-product-pager');if(pager){pager.setAttribute('role','navigation');pager.setAttribute('aria-label','Paginación de productos y lotes');}
 const modal=page.querySelector('.psi-product-dialog:not([hidden])');if(modal){const dialog=modal.querySelector('[role="dialog"]');dialog?.setAttribute('aria-labelledby','psi245-modal-title');const heading=dialog?.querySelector('h2');if(heading)heading.id='psi245-modal-title';}
}
