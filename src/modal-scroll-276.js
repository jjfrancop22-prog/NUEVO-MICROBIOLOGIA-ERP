// V1.0.276: restaura desplazamiento tras cerrar o reemplazar ventanas flotantes.
// No altera registros ni decisiones; únicamente corrige bloqueos visuales residuales.
const locks = [
 ['strain255-lock', '.strain255-opened'],
 ['strain258-lock', '.strain258-overlay'],
 ['media-249-open-body', '.media-249-overlay:not([hidden])'],
 ['media-246-modal-open', '.media-246-modal:not([hidden])'],
 ['qc234-modal-open', '.qc234-backdrop'],
 ['qc236-modal-open', '.qc236-modal:not([hidden])'],
 ['psi-product-modal-open', '.psi-product-dialog:not([hidden])']
];
const hasActiveOverlay=()=>Boolean(document.querySelector([
 '#media-qc-direct-modal', '.strain255-opened', '.strain258-overlay',
 '.media-249-overlay:not([hidden])', '.media-246-modal:not([hidden])',
 '.qc234-backdrop', '.qc233-overlay', '.qc236-modal:not([hidden])',
 '.psi-product-dialog:not([hidden])'
].join(',')));
export function recoverModalScroll(){
 for(const [cls, selector] of locks){
  if(document.body.classList.contains(cls) && !document.querySelector(selector))document.body.classList.remove(cls);
 }
 if(!hasActiveOverlay() && document.body.style.overflow==='hidden')document.body.style.removeProperty('overflow');
 if(!hasActiveOverlay() && document.documentElement.style.overflow==='hidden')document.documentElement.style.removeProperty('overflow');
}
let installed=false;
export function installModalScrollRecovery(){
 if(installed)return;installed=true;
 let pending=false;
 const observer=new MutationObserver(()=>{
  if(pending)return;pending=true;
  requestAnimationFrame(()=>{pending=false;recoverModalScroll();});
 });
 observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','style']});
 window.addEventListener('pageshow',recoverModalScroll);
}
