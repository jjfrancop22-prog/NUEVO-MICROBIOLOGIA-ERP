// Mejora exclusivamente de interfaz. No consulta ni modifica Firebase.
const STAGES={prep:['Preparación','Registre una preparación y compruebe la masa antes de guardar.'],qc:['Control QC','Consulte y documente las evaluaciones microbiológicas.'],performance:['Rendimiento','Revise las pruebas requeridas y los resultados disponibles.'],release:['Liberación','Compruebe los requisitos antes de autorizar el uso.'],inventory:['Inventario','Consulte existencias y movimientos de medios preparados.'],register:['Historial','Localice preparaciones y revise sus unidades documentadas.']};
export function enhanceMedia247(root,view){
 if(!root||root.querySelector('.media-247-toolbar'))return;
 root.classList.add('media-pro-247');
 const tabs=root.querySelector('.product-tabs');if(!tabs)return;
 const [label,help]=STAGES[view]||STAGES.prep;
 const toolbar=document.createElement('section');toolbar.className='media-247-toolbar';toolbar.setAttribute('aria-label','Herramientas del módulo');
 const left=document.createElement('div');left.className='media-247-toolbar-copy';
 const title=document.createElement('strong');title.textContent=label;
 const subtitle=document.createElement('span');subtitle.textContent=help;
 left.append(title,subtitle);
 const actions=document.createElement('div');actions.className='media-247-actions';
 const focus=document.createElement('button');focus.type='button';focus.className='media-247-action';focus.textContent='⌕ Buscar';
 const refresh=document.createElement('button');refresh.type='button';refresh.className='media-247-action';refresh.textContent='↻ Revisar vista';
 const note=document.createElement('span');note.className='media-247-note';note.setAttribute('role','status');note.setAttribute('aria-live','polite');
 focus.addEventListener('click',()=>{const target=root.querySelector('#media-register-search,#media-inventory-search,input[type="search"],select[name="recipe"],#qc-lot-select');if(target){target.focus();target.scrollIntoView({behavior:'smooth',block:'center'});}else{note.textContent='En este apartado utilice los filtros y acciones disponibles.';}});
 refresh.addEventListener('click',()=>{note.textContent='Vista actualizada con los datos disponibles. No se realizó una nueva consulta.';window.setTimeout(()=>{if(note.isConnected)note.textContent='';},4000);});
 actions.append(focus,refresh,note);toolbar.append(left,actions);tabs.after(toolbar);
 if(view==='prep'){
  const placeholder=root.querySelector('.media-246-placeholder');
  if(placeholder){placeholder.classList.add('media-247-placeholder');const p=placeholder.querySelector('p');if(p)p.textContent='Abra Nueva preparación para seleccionar el medio y el frasco, revisar los cálculos y registrar el consumo una sola vez.';}
 }
 root.querySelectorAll('button').forEach(b=>{if(!b.getAttribute('aria-label')&&!b.textContent.trim())b.setAttribute('aria-label','Acción del módulo');});
}
