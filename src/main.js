import { installModalScrollRecovery, recoverModalScroll } from './modal-scroll-276.js';
installModalScrollRecovery();
import './login-274.css';
import './strains-266.css';
import './strains-265.css';
import './media-qc-direct-264.css';
import './media-draft-261.css';
import './dashboard-260.css';
import './strains-ledger-259.css';
import './strains-257.css';
import './strains-258.css';
import './strains-256.css';
import './strains-255.css';
import './psi-media-253.css';
import './psi-media-252.css';
import './media-release-251.css';
import './psi-media-250.css';
import './psi-media-249.css';
import './psi-media-248.css';
import './psi-media-247.css';
import './psi-media-246.css';
import './psi-products-245.css';
import './psi-products-244.css';
import './psi-products-243.css';
import './psi-products-241.css';
import './psi-visual-240.css';
import './psi-visual-239.css';
import "./psi-visual-238.css";
import './psi-visual-237.css';
import './psi-visual-236.css';
import './psi-visual-235.css';
import './psi-visual-234.css';
import './psi-visual-233.css';
import './psi-visual-232.css';
import './psi-visual-231.css';
import './psi-visual-230.css';
import './style.css';
import './psi-visual-2027.css';
import './psi-visual-222.css';
import './psi-visual-223.css';
import './psi-visual-224.css';
import './psi-visual-225.css';
import './psi-visual-226.css';
import './psi-visual-227.css';
import './psi-visual-228.css';
import './psi-visual-229.css';
import './psi-products-242.css';
import { renderDashboard260 } from './dashboard-260';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { sync } from './sync';
import { renderAdmin } from './admin';
import {renderSamples,stopSamples} from './samples';
import {renderProducts,stopProducts} from './products';
import {renderMedia,stopMedia} from './media';
import {renderStrains,stopStrains,openQcStrainReactivation} from './strains';
import { startInbox, stopInbox, watchInbox, renderMessages, getRecipients, loadSent } from './communications';
import { startVersionWatch } from './version-watch';
const root=document.getElementById('app');
startVersionWatch();
// Evitar Service Worker durante desarrollo: Vite debe reflejar cambios inmediatamente.
if(import.meta.env.PROD && 'serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.warn));}

let currentUser=null,profile=null, sessionToken=0, idleTimer;
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function login(message=''){
  root.innerHTML=`<main class="psi-login-page"><section class="psi-login-shell" aria-label="Acceso a LAB-PSI"><aside class="psi-login-intro"><div class="psi-login-mark"><img src="/psi-logo.jpg" alt="Logotipo de Productos y Servicios Industriales PSI"/><span>PRODUCTOS Y SERVICIOS INDUSTRIALES C. LTDA.</span></div><div class="psi-login-intro-body"><span class="psi-login-kicker">PLATAFORMA INSTITUCIONAL · 2027</span><h1>Microbiología<br/><em>NEXTGEN</em></h1><p>Gestión microbiológica, control de calidad y trazabilidad documental en un entorno integrado.</p><div class="psi-login-feature"><span>✓</span> Acceso mediante autenticación segura</div><div class="psi-login-feature"><span>✓</span> Gestión de registros y recursos de laboratorio</div><div class="psi-login-feature"><span>✓</span> Información protegida según el perfil autorizado</div></div><div class="psi-login-intro-foot">LAB-PSI · Sistema de gestión de laboratorio</div></aside><div class="psi-login-panel"><div class="psi-login-panel-top"><span class="psi-login-secure">● ACCESO SEGURO</span><span class="psi-login-version">V1.0.277</span></div><div class="psi-login-form-wrap"><div class="psi-login-mobile-brand"><img src="/psi-logo.jpg" alt="PSI"/><strong>LAB-PSI</strong></div><span class="psi-login-eyebrow">BIENVENIDO</span><h2>Iniciar sesión</h2><p class="psi-login-subtitle">Ingresa con tus credenciales institucionales para continuar.</p><form id="login" class="psi-login-form"><label for="psi-email">Correo electrónico</label><input id="psi-email" name="email" type="email" placeholder="usuario@empresa.com" required autocomplete="username"/><label for="psi-password">Contraseña</label><div class="psi-login-password"><input id="psi-password" name="password" type="password" placeholder="Introduce tu contraseña" required autocomplete="current-password"/><button type="button" id="psi-password-toggle" aria-label="Mostrar contraseña" aria-pressed="false">Mostrar</button></div><button class="psi-login-submit" type="submit"><span>Ingresar al sistema</span><span aria-hidden="true">→</span></button><p id="message" class="psi-login-message" role="alert" aria-live="polite">${escapeHTML(message)}</p></form><div class="psi-login-help">Acceso exclusivo para personal autorizado.</div></div><footer class="psi-login-footer"><span>Desarrollado por <strong>Jipson Franco</strong></span><span>LAB-PSI · Versión 1.0.277</span></footer></div></section></main>`;
  const form=root.querySelector('#login');
  const toggle=root.querySelector('#psi-password-toggle');
  toggle.addEventListener('click',()=>{const input=form.elements.password;const visible=input.type==='password';input.type=visible?'text':'password';toggle.textContent=visible?'Ocultar':'Mostrar';toggle.setAttribute('aria-label',visible?'Ocultar contraseña':'Mostrar contraseña');toggle.setAttribute('aria-pressed',String(visible));});
  form.onsubmit=async e=>{
    e.preventDefault();const b=form.querySelector('button[type="submit"]');b.disabled=true;b.querySelector('span').textContent='Verificando acceso…';
    const data=new FormData(form);
    try{await signInWithEmailAndPassword(auth,String(data.get('email')).trim(),String(data.get('password')));}
    catch(err){root.querySelector('#message').textContent=`No se pudo autenticar (${err.code||'error'}). Verifica tus credenciales.`;b.disabled=false;b.querySelector('span').textContent='Ingresar al sistema';}
  };
}

const groups=[
 ['PRINCIPAL',[['dashboard','▦','Panel general']]],
 ['GESTIÓN ANALÍTICA',[['samples','◫','Registro de muestras'],['quality','◈','Controles de calidad']]],
 ['RECURSOS MICROBIOLÓGICOS',[['products','▤','Productos y lotes'],['media','◉','Medios de cultivo'],['strains','⬡','Cepas de referencia']]],
 ['CONTROL Y SEGUIMIENTO',[['areas','▥','Monitoreo de áreas'],['equipment','⚙','Equipos y condiciones']]],
 ['COMUNICACIÓN',[['communications','✉','Centro de comunicaciones']]],
 ['SISTEMA',[['admin','♙','Administración']]]
];
// V1.0.268: ruta única para abrir directamente Reactivación desde el planificador QC.
function navigateFromQc(detail={}){
 if(!detail.page)return;
 if(detail.page==='strains'){
  const atcc=String(detail.atcc||'').trim();
  if(atcc){sessionStorage.setItem('micro_reactivation_context',JSON.stringify({atcc,medium:'Control de calidad',test:'Q1',origin:'qc-planner'}));}
  showPage('strains');
  if(atcc)openQcStrainReactivation(atcc);
  return;
 }
 showPage(detail.page);
}
window.addEventListener('micro:navigate',e=>navigateFromQc(e.detail));
// Captura delegada: funciona incluso cuando Q1 se reconstruye dentro de un modal.
// El manejador de samples detecta defaultPrevented y evita una segunda navegación.
document.addEventListener('click',e=>{
 const button=e.target.closest?.('[data-qc-go="strains"][data-qc-atcc]');
 if(!button)return;
 const atcc=button.dataset.qcAtcc;
 if(!atcc)return;
 e.preventDefault();e.stopImmediatePropagation();
 // Cerrar primero el expediente informativo Q1; de lo contrario queda superpuesto al formulario.
 const qcOverlay=button.closest('.qc233-overlay');
 if(qcOverlay)qcOverlay.querySelector('.qc233-close')?.click();
 navigateFromQc({page:'strains',atcc});
},true);
let notificationFilter='pending',notificationPriority='ALL',notificationPerson='ALL',notificationSearch='',notificationFocus=null;
let commRecipients=[];let selectedPage='dashboard',stopStatus=null,stopInboxWatch=null,commSnapshot={messages:[],unread:0,status:'connecting'};
const entries=groups.flatMap(g=>g[1]);
function shell(){
 const nav=groups.map(([name,items])=>`<div class="nav-heading">${name}</div>${items.map(([id,icon,label])=>`<button class="nav-item ${id===selectedPage?'selected':''}" data-page="${id}" title="${label}"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span>${!['dashboard','samples','quality','products','media','strains','areas','equipment','communications','admin'].includes(id)?'<span class="nav-tag">PRÓX.</span>':''}</button>`).join('')}`).join('');
 root.innerHTML=`<div class="layout" id="layout"><div class="backdrop" id="backdrop"></div><aside class="sidebar"><div class="brand"><span class="brand-logo">🧬</span><div class="brand-text"><div class="brand-title">LAB-PSI</div><small>MICROBIOLOGÍA NEXTGEN</small></div></div><nav class="nav-scroll">${nav}</nav><div class="sidebar-footer"><strong>MICROBIOLOGÍA NEXTGEN</strong><br>V1.0.277 · Interfaz PSI 2027</div></aside><div class="workspace"><header class="topbar"><div class="top-left"><button class="icon-btn" id="menu-toggle" title="Expandir o contraer menú" aria-label="Alternar menú">☰</button><div class="top-title"><strong id="header-title">ERP Microbiología</strong><small>LAB-PSI · Entorno local de desarrollo</small></div></div><div class="top-right"><label class="density-control" title="Personalizar tamaño y espaciado de toda la interfaz"><span>⚙ Vista</span><select id="density-select" aria-label="Densidad visual"><option value="comfortable">Cómoda</option><option value="compact">Compacta</option><option value="dense">Máxima</option></select></label><div class="search-box">⌕ <input id="nav-search" placeholder="Buscar módulo..." aria-label="Buscar módulo" /></div><span class="pill" id="sync-indicator">● Motor listo</span><button id="bell" class="icon-btn" aria-label="Centro de notificaciones">🔔 <span id="bell-badge"></span></button><span class="avatar" title="${escapeHTML(profile.userCode||currentUser.email)}">${escapeHTML((profile.userCode||'U').slice(0,2))}</span><button id="logout" class="secondary logout">Salir</button></div></header><section class="content"><div id="notify-panel" class="card notify-panel" hidden><div class="notify-head"><h2>🔔 Centro de notificaciones</h2><span class="pill">En vivo</span></div><p id="notify-summary">Cargando bandeja...</p><div class="notify-filters"><select id="notify-filter" aria-label="Estado"><option value="pending">Pendientes</option><option value="unread">Sin leer</option><option value="attended">Atendidas</option><option value="all">Todas</option></select><select id="notify-priority" aria-label="Prioridad"><option value="ALL">Todas las prioridades</option><option value="CRITICA">🔴 Crítica</option><option value="IMPORTANTE">🟠 Importante</option><option value="NORMAL">🟢 Normal</option></select><select id="notify-person" aria-label="Remitente"><option value="ALL">Todos los colaboradores</option></select><input id="notify-search" placeholder="Buscar comunicación…" aria-label="Buscar notificaciones" /></div><div id="notify-items"></div><button id="open-communications">Abrir centro</button> <button class="secondary" id="close-notify">Cerrar</button></div><div class="psi-page-context" aria-label="Ubicación actual"><div class="psi-breadcrumb"><span>PSI NEXTGEN</span><span class="psi-separator">/</span><span id="psi-section">Principal</span><span class="psi-separator">/</span><strong id="psi-current">Panel general</strong></div><span class="psi-context-badge">● Plataforma operativa</span></div><div id="page-content"></div><div id="search-results" class="search-results" hidden></div></section></div></div>`;
 const densityKey='micro_visual_density_v126';
 const allowedDensity=['comfortable','compact','dense'];
 let savedDensity='compact';
 try{const stored=localStorage.getItem(densityKey);if(allowedDensity.includes(stored))savedDensity=stored;}catch(_){}
 const densitySelect=root.querySelector('#density-select');
 const applyDensity=(mode)=>{document.documentElement.dataset.microDensity=allowedDensity.includes(mode)?mode:'compact';densitySelect.value=document.documentElement.dataset.microDensity;};
 applyDensity(savedDensity);
 densitySelect.addEventListener('change',e=>{applyDensity(e.target.value);try{localStorage.setItem(densityKey,densitySelect.value);}catch(_){}});
 const layout=root.querySelector('#layout');
 if(localStorage.getItem('micro_sidebar_collapsed')==='1' && innerWidth>760)layout.classList.add('collapsed');
 root.querySelector('#menu-toggle').onclick=()=>{if(innerWidth<=760)layout.classList.toggle('mobile-open');else{layout.classList.toggle('collapsed');localStorage.setItem('micro_sidebar_collapsed',layout.classList.contains('collapsed')?'1':'0');}};
 root.querySelector('#backdrop').onclick=()=>layout.classList.remove('mobile-open');
 root.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{if(b.dataset.page==='strains')sessionStorage.removeItem('micro_reactivation_context');showPage(b.dataset.page);});
 root.querySelector('#logout').onclick=()=>signOut(auth);
 if(stopStatus)stopStatus();
 stopStatus=sync.watchStatus(state=>{
   const indicator=root.querySelector('#sync-indicator');if(!indicator)return;
   indicator.textContent=state.online?(state.pendingWrites?`◐ ${state.pendingWrites} envío(s) pendiente(s)`:'● En línea · Motor listo'):'● Sin conexión';
   const panel=root.querySelector('#engine-monitor');
   if(panel)panel.innerHTML=`<div class="monitor-grid"><span>Suscripciones activas <b>${state.activeListeners}</b></span><span>Eventos de consulta <b>${state.snapshotEvents}</b></span><span>Documentos recibidos* <b>${state.documentsDelivered}</b></span><span>Lecturas de caché <b>${state.cacheHits}</b></span><span>Guardados confirmados <b>${state.writesConfirmed}</b></span><span>Errores de escritura <b>${state.writesFailed}</b></span></div><small>*Métrica local, NO equivale a lecturas facturables de Firestore.</small>`;
 });
 root.querySelector('#bell').onclick=()=>{const p=root.querySelector('#notify-panel');p.hidden=!p.hidden;if(!p.hidden)drawNotifications();};
 for(const [id,setter] of [['notify-filter',v=>notificationFilter=v],['notify-priority',v=>notificationPriority=v],['notify-person',v=>notificationPerson=v],['notify-search',v=>notificationSearch=v]])root.querySelector('#'+id).addEventListener(id==='notify-search'?'input':'change',e=>{setter(e.target.value);drawNotifications();});
 root.querySelector('#notify-items').onclick=e=>{const b=e.target.closest('[data-open-peer]');if(!b)return;notificationFocus=b.dataset.openPeer;root.querySelector('#notify-panel').hidden=true;showPage('communications');};
 root.querySelector('#close-notify').onclick=()=>{root.querySelector('#notify-panel').hidden=true;};
 root.querySelector('#open-communications').onclick=()=>{root.querySelector('#notify-panel').hidden=true;showPage('communications');};
 stopInboxWatch?.();stopInboxWatch=watchInbox(s=>{commSnapshot=s;drawNotifications();if(selectedPage==='communications')refreshCommunications();});
 startInbox(currentUser.uid);
 const search=root.querySelector('#nav-search');
 if(search)search.oninput=()=>{const q=search.value.toLocaleLowerCase('es').trim();root.querySelectorAll('[data-page]').forEach(b=>{b.hidden=!!q&&!b.textContent.toLocaleLowerCase('es').includes(q)});};
 showPage(selectedPage);
}
function drawNotifications(){
 const badge=root.querySelector('#bell-badge'),summary=root.querySelector('#notify-summary'),items=root.querySelector('#notify-items'),people=root.querySelector('#notify-person');
 if(!items)return;
 const rows=commSnapshot.messages||[];
 const pending=rows.filter(m=>!m.attendedAt),unread=rows.filter(m=>!m.readAt);
 if(badge)badge.textContent=pending.length||'';
 if(summary)summary.textContent=`${unread.length} sin leer · ${pending.length} pendientes · ${rows.length} recibidas (últimas 60)`;
 const peers=new Map(rows.map(m=>[m.senderUid,commRecipients.find(p=>p.uid===m.senderUid)?.label||m.senderUid?.slice(0,10)+'…']));
 const previous=notificationPerson;
 people.innerHTML='<option value="ALL">Todos los colaboradores</option>'+[...peers].map(([uid,name])=>`<option value="${escapeHTML(uid)}">${escapeHTML(name)}</option>`).join('');
 people.value=peers.has(previous)?previous:'ALL';if(people.value!==previous)notificationPerson='ALL';
 const q=notificationSearch.toLocaleLowerCase('es').trim();
 const visible=rows.filter(m=>(notificationFilter==='all'||(notificationFilter==='pending'&&!m.attendedAt)||(notificationFilter==='unread'&&!m.readAt)||(notificationFilter==='attended'&&!!m.attendedAt))&&(notificationPriority==='ALL'||m.priority===notificationPriority)&&(notificationPerson==='ALL'||m.senderUid===notificationPerson)&&(!q||[m.subject,m.body,peers.get(m.senderUid)].some(v=>String(v||'').toLocaleLowerCase('es').includes(q)))).sort((a,b)=>{const weight=x=>x.priority==='CRITICA'?3:x.priority==='IMPORTANTE'?2:1;return weight(b)-weight(a)||(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0);});
 items.innerHTML=visible.length?visible.map(m=>`<button type="button" class="notify-row notify-action ${m.attendedAt?'is-attended':''}" data-open-peer="${escapeHTML(m.senderUid)}"><span class="notify-row-top"><span class="notify-severity ${escapeHTML(m.priority)}">${m.priority==='CRITICA'?'🔴':m.priority==='IMPORTANTE'?'🟠':'🟢'} ${escapeHTML(m.priority||'NORMAL')}</span><small>${m.attendedAt?'Atendida':m.readAt?'Leída · pendiente':'Nueva · pendiente'}</small></span><b>${escapeHTML(m.subject)}</b><small>De: ${escapeHTML(peers.get(m.senderUid)||'Usuario')}</small><p>${escapeHTML((m.body||'').slice(0,125))}</p><span class="notify-open">Abrir conversación →</span></button>`).join(''):'<p class="muted notify-empty">No hay comunicaciones para estos filtros.</p>';
}
function showPage(id){
 recoverModalScroll();
 // Restablecer bloqueo residual de ventanas de vistas anteriores.
 document.body.classList.remove('media-249-open-body','media-246-modal-open','qc236-modal-open','strain255-lock','strain258-lock');
 if(!document.querySelector('#media-qc-direct-modal'))document.body.style.removeProperty('overflow');
 if(!document.querySelector('.qc234-backdrop, .qc233-overlay'))document.body.classList.remove('qc234-modal-open');
 if(!document.querySelector('.psi-product-dialog:not([hidden])'))document.body.classList.remove('psi-product-modal-open');
 if(['samples','quality'].includes(selectedPage)&&!['samples','quality'].includes(id))stopSamples();
 if(selectedPage==='products'&&id!=='products')stopProducts();
 if(selectedPage==='media'&&id!=='media')stopMedia();
 if(selectedPage==='strains'&&id!=='strains')stopStrains();
 selectedPage=id;
 const entry=entries.find(e=>e[0]===id)||entries[0];
 root.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('selected',b.dataset.page===id));
 root.querySelector('#layout').classList.remove('mobile-open');
 const content=root.querySelector('#page-content');
 const section=groups.find(g=>g[1].some(item=>item[0]===id))?.[0]||'PRINCIPAL';
 const sectionNode=root.querySelector('#psi-section'),currentNode=root.querySelector('#psi-current'),titleNode=root.querySelector('#header-title');
 if(sectionNode)sectionNode.textContent=section;
 if(currentNode)currentNode.textContent=entry[2];
 if(titleNode)titleNode.textContent=entry[2];
 if(id==='samples'||id==='quality'){renderSamples(content,currentUser,profile,id);return;}
 if(id==='products'){renderProducts(content,currentUser,profile);return;}
 if(id==='media'){renderMedia(content,currentUser,profile);return;}
 if(id==='strains'){renderStrains(content,currentUser,profile);return;}
 if(id==='admin'){if(profile.role!=='ADMIN'){content.innerHTML='<h1>Acceso restringido</h1><p>Solo el administrador puede gestionar perfiles.</p>';return;}renderAdmin(content,currentUser.uid);return;}
 if(id==='communications'){
   content.innerHTML=`<div class="comm-page-heading"><div><div class="eyebrow">CENTRO INTELIGENTE · V1.0.9</div><h1>Comunicaciones</h1><p class="intro">Conversaciones por colaborador · lectura y atención independientes · sincronización compartida.</p></div><span class="pill">● Conectado a Firebase</span></div><div id="comm-inbox" class="comm-pro"></div>`;
   const node=root.querySelector('#comm-inbox');node.innerHTML='<div class="card">Cargando directorio e historial de mensajes…</div>';
   const token=node;Promise.all([getRecipients().catch(()=>[]),loadSent(currentUser.uid).catch(()=>[])]).then(([users])=>{if(root.querySelector('#comm-inbox')!==token)return;commRecipients=users;drawNotifications();refreshCommunications();});return;
 }
 if(id!=='dashboard'){
   content.innerHTML=`<div class="eyebrow">MÓDULO · EN PREPARACIÓN</div><h1>${escapeHTML(entry[2])}</h1><p class="intro">Este módulo se incorporará en una fase posterior.</p><div class="card module-banner"><h2>Área preparada para implementación</h2><p>La navegación está disponible; aún no hay formularios operativos para esta sección.</p><button id="go-home" class="secondary">← Volver al panel general</button></div>`;
   root.querySelector('#go-home').onclick=()=>showPage('dashboard');const back=root.querySelector('#return-to-performance');if(back)back.onclick=()=>{showPage('media');window.dispatchEvent(new CustomEvent('micro:open-performance'));};return;
 }
 renderDashboard260(content,profile,currentUser,showPage);
 sync.emit();
}

function refreshCommunications(){const container=root.querySelector('#comm-inbox');if(container&&currentUser)renderMessages(container,currentUser.uid,profile.role,commRecipients,notificationFocus);notificationFocus=null;}
function resetIdle(){clearTimeout(idleTimer);if(currentUser)idleTimer=setTimeout(()=>signOut(auth),30*60*1000);}
['pointerdown','keydown'].forEach(evt=>window.addEventListener(evt,resetIdle,{passive:true}));
onAuthStateChanged(auth,async user=>{
  const token=++sessionToken;stopInboxWatch?.();stopInboxWatch=null;stopInbox();stopSamples();sync.clear();currentUser=null;profile=null;clearTimeout(idleTimer);
  if(stopStatus){stopStatus();stopStatus=null;}
  if(!user){login();return;}
  try{
    const snap=await getDoc(doc(db,'users',user.uid));
    if(token!==sessionToken)return;
    const p=snap.data();
    if(!snap.exists()||p.active!==true||!['ADMIN','JEFE','ANALISTA'].includes(p.role)){
      await signOut(auth);login('Su cuenta está autenticada, pero no tiene un perfil activo autorizado. Solicite al administrador crear users/{UID}.');return;
    }
    currentUser=user;profile=p;sync.setUser(user.uid);shell();resetIdle();
  }catch(err){if(token!==sessionToken)return;await signOut(auth);login(`No se pudo verificar el perfil (${err.code||'error'}). Revise reglas y conexión.`);}
});
login();
