// Presentación exclusivamente: conserva formularios, eventos y validaciones originales.
export function enhanceMedia249(root, view) {
  if (!root || !['qc','performance','release'].includes(view)) return;
  root.classList.add('media-249');
  const config = view === 'qc'
    ? {selector:'form.media-qc-row.qc-evaluation', title:'Evaluación de Control QC', caption:'Verificaciones y criterios microbiológicos del lote'}
    : view === 'performance'
      ? {selector:'#performance-form', title:'Evaluación de rendimiento', caption:'Ensayos, cepas y resultados documentados'}
      : null;
  if (config) {
    const form = root.querySelector(config.selector);
    if (!form) return;
    const originalParent = form.parentElement;
    const launch = document.createElement('div');
    launch.className = 'media-249-launch';
    launch.innerHTML = `<div><strong>${config.title}</strong><small>${config.caption}</small></div><button type="button" class="media-249-open">Abrir evaluación ↗</button>`;
    originalParent.insertBefore(launch,form);
    const overlay = document.createElement('div');
    overlay.className = 'media-249-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `<section class="media-249-dialog" role="dialog" aria-modal="true" aria-label="${config.title}" tabindex="-1"><header class="media-249-head"><div><small>LAB-PSI · MEDIOS DE CULTIVO</small><h2>${config.title}</h2><p>${config.caption}</p></div><button type="button" class="media-249-close" aria-label="Cerrar evaluación">✕</button></header><div class="media-249-body"></div></section>`;
    root.append(overlay);
    overlay.querySelector('.media-249-body').append(form);
    const opener=launch.querySelector('button');
    const close=()=>{overlay.hidden=true;document.body.classList.remove('media-249-open-body');if(opener.isConnected)opener.focus();};
    opener.onclick=()=>{overlay.hidden=false;document.body.classList.add('media-249-open-body');overlay.querySelector('.media-249-close').focus();};
    overlay.querySelector('.media-249-close').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
    // Si el ERP vuelve a dibujar la vista, elimina el bloqueo de desplazamiento.
    const observer=new MutationObserver(()=>{if(!overlay.isConnected || !root.contains(overlay)){document.body.classList.remove('media-249-open-body');observer.disconnect();}});
    observer.observe(root,{childList:true});
  }
  if(view==='release'){
    root.querySelectorAll('[data-release]').forEach(button=>{
      button.classList.add('media-249-release-button');
      if(button.disabled)button.title='La liberación requiere controles conformes y condiciones vigentes';
    });
    const head=root.querySelector('.release-head');
    if(head){const info=document.createElement('p');info.className='media-249-release-note';info.textContent='Revise las evidencias de QC y rendimiento antes de confirmar una liberación. Las restricciones y autorizaciones originales permanecen vigentes.';head.after(info);}
  }
}
