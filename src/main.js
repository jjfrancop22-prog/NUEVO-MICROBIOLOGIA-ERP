import {qcResources,qcPhase} from './qc-intelligence';
import {watchCleaningAlerts} from './cleaning-alerts.js';
let psiQcReactivationAlerts=[];let psiQcDaily=[];let psiQcReactions=[];let psiQcMedia=[];let psiQcReady={daily:false,reactions:false,media:false};let psiQcAlertError="";
let psiStrainAlerts=[];let psiStrainError="";
let psiMediaExpiryAlerts=[];let psiMediaAlertError="";let psiMediaPreps=[];let psiAnUses=[];let psiAnUsesReady=false;
let psiAreaAlerts=[];let psiAutoclaveAlerts=[];let psiCleaningAlerts=[];let psiCleaningAlertErrors=[];
let psiApprovalAlerts=[];let psiWeekAssignment=null;let psiAlertStops=[];let psiAnalysts=[];
import { APP_VERSION, APP_VERSION_LABEL } from './app-version.js';
import './psi-css-bloque-1.css';
import { installModalScrollRecovery, recoverModalScroll } from './modal-scroll-276.js';
installModalScrollRecovery();
import './psi-css-bloque-2.css';
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
import { renderAreas } from './areas-elisa';
import {renderAutoclaves,stopAutoclaves} from './equipment-autoclaves';
import {renderCleaning,stopCleaning} from './cleaning-plan.js';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
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
  root.innerHTML=`<main class="psi-login-page"><section class="psi-login-shell" aria-label="Acceso a LAB-PSI"><aside class="psi-login-intro"><div class="psi-login-mark"><img src="/psi-logo.jpg" alt="Logotipo de Productos y Servicios Industriales PSI"/><span>PRODUCTOS Y SERVICIOS INDUSTRIALES C. LTDA.</span></div><div class="psi-login-intro-body"><span class="psi-login-kicker">PLATAFORMA INSTITUCIONAL · PSI NEXTGEN</span><h1>Microbiología<br/><em>NEXTGEN</em></h1><p>Gestión microbiológica, control de calidad y trazabilidad documental en un entorno integrado.</p><div class="psi-login-feature"><span>✓</span> Acceso mediante autenticación segura</div><div class="psi-login-feature"><span>✓</span> Gestión de registros y recursos de laboratorio</div><div class="psi-login-feature"><span>✓</span> Información protegida según el perfil autorizado</div></div><div class="psi-login-intro-foot">© 2026 · Desarrollo y diseño: Jipson Franco</div></aside><div class="psi-login-panel"><div class="psi-login-panel-top"><span class="psi-login-secure">● ACCESO SEGURO</span><span class="psi-login-build">${APP_VERSION_LABEL}</span></div><div class="psi-login-form-wrap"><div class="psi-login-mobile-brand"><img src="/psi-logo.jpg" alt="PSI"/><strong>LAB-PSI</strong></div><span class="psi-login-eyebrow">ACCESO AL SISTEMA</span><h2>Bienvenido a LAB-PSI</h2><p class="psi-login-subtitle">Ingresa con tu cuenta institucional para acceder a los módulos autorizados.</p><form id="login" class="psi-login-form"><label for="psi-email">Correo electrónico</label><input id="psi-email" name="email" type="email" placeholder="usuario@empresa.com" required autocomplete="username"/><label for="psi-password">Contraseña</label><div class="psi-login-password"><input id="psi-password" name="password" type="password" placeholder="Introduce tu contraseña" required autocomplete="current-password"/><button type="button" id="psi-password-toggle" aria-label="Mostrar contraseña" aria-pressed="false">Mostrar</button></div><button class="psi-login-submit" type="submit"><span>Ingresar al sistema</span><span aria-hidden="true">→</span></button><p id="message" class="psi-login-message" role="alert" aria-live="polite">${escapeHTML(message)}</p></form><div class="psi-login-help">Acceso exclusivo para personal autorizado.</div></div><footer class="psi-login-footer"><span>Desarrollado por <strong>Jipson Franco</strong></span><span class="psi-login-version" aria-label="Versión vigente de la aplicación">Versión ${APP_VERSION_LABEL} · PSI NextGen</span></footer></div></section></main>`;
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
 ['CONTROL Y SEGUIMIENTO',[['areas','▥','Monitoreo de áreas'],['equipment','⚙','Equipos y condiciones'],['cleaning','🧹','Plan de limpieza']]],
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
let notificationFilter='unread',notificationPriority='ALL',notificationPerson='ALL',notificationSearch='',notificationFocus=null;
let commRecipients=[];let selectedPage=new URLSearchParams(location.search).has('psi-cleaning')?'cleaning':'dashboard',stopStatus=null,stopInboxWatch=null,commSnapshot={messages:[],unread:0,status:'connecting'};
const entries=groups.flatMap(g=>g[1]);
const psiWeekKey=()=>{const now=new Date(new Date().toLocaleString('en-US',{timeZone:'America/Guayaquil'}));const d=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const y=d.getUTCFullYear();return `${y}-W${String(Math.ceil((((d-new Date(Date.UTC(y,0,1)))/86400000)+1)/7)).padStart(2,'0')}`;};
// Calendario semanal de responsables: semana ISO calculada con fecha local, sin depender del navegador.
function psiWeekForDate(value){
 const [year,month,day]=String(value).split('-').map(Number);
 if(!year||!month||!day)return '';
 const d=new Date(Date.UTC(year,month-1,day));d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
 const y=d.getUTCFullYear();return `${y}-W${String(Math.ceil((((d-new Date(Date.UTC(y,0,1)))/86400000)+1)/7)).padStart(2,'0')}`;
}
function psiWeekMonday(value){
 const [y,m,d]=value.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d));dt.setUTCDate(dt.getUTCDate()-((dt.getUTCDay()+6)%7));return dt.toISOString().slice(0,10);
}
function psiAddDays(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
let psiCalendarDate='',psiCalendarAssignments={},psiCalendarLoading=false;
async function psiOpenCalendar(){
 if(profile.role!=='ADMIN')return;
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 psiCalendarDate=psiCalendarDate||today;
 const modal=document.createElement('div');modal.id='psi-assignment-modal';modal.className='psi-assignment-overlay';
 modal.innerHTML=`<section class="psi-assignment-dialog" role="dialog" aria-modal="true" aria-label="Calendario de responsables"><header><div><small>PSI · CONTROL Y SEGUIMIENTO</small><h2>Calendario de responsables</h2><p>Programe al analista por semana. La asignación se activa automáticamente al comenzar la semana.</p></div><button type="button" data-calendar-close aria-label="Cerrar">✕</button></header><div class="psi-assignment-toolbar"><label>Seleccionar fecha <input type="date" id="psi-calendar-date" value="${psiCalendarDate}"></label><button type="button" data-calendar-today>Hoy</button></div><div id="psi-calendar-content" aria-live="polite">Cargando programación…</div><footer>Los cambios se guardan en Firebase. Las alertas operativas corresponden al responsable de la semana actual.</footer></section>`;
 document.body.appendChild(modal);
 modal.addEventListener('click',async e=>{
  if(e.target===modal||e.target.closest('[data-calendar-close]')){modal.remove();return;}
  if(e.target.closest('[data-calendar-today]')){psiCalendarDate=today;modal.querySelector('#psi-calendar-date').value=today;await psiLoadCalendar();return;}
  const save=e.target.closest('[data-calendar-save]');if(!save)return;
  const week=save.dataset.calendarSave,uid=modal.querySelector(`[data-calendar-analyst="${week}"]`)?.value;
  if(!uid){alert('Seleccione un analista para guardar la semana.');return;}
  save.disabled=true;save.textContent='Guardando…';
  try{const analyst=psiAnalysts.find(a=>a.uid===uid);await setDoc(doc(db,'monitoringAreaAssignments',week),{analystUid:uid,analystName:analyst?.name||analyst?.userCode||uid,week,updatedBy:currentUser.uid,updatedAt:serverTimestamp()});psiCalendarAssignments[week]={analystUid:uid,analystName:analyst?.name||analyst?.userCode||uid};await psiLoadCalendar();}
  catch(err){alert('No se pudo guardar la asignación: '+err.message);save.disabled=false;save.textContent='Guardar';}
 });
 modal.querySelector('#psi-calendar-date').addEventListener('change',async e=>{psiCalendarDate=e.target.value;await psiLoadCalendar();});
 await psiLoadCalendar();
}
async function psiLoadCalendar(){
 const host=document.querySelector('#psi-calendar-content');if(!host)return;
 host.innerHTML='<p>Consultando asignaciones de Firebase…</p>';
 const monday=psiWeekMonday(psiCalendarDate);const dates=Array.from({length:6},(_,i)=>psiAddDays(monday,i*7));const weeks=dates.map(psiWeekForDate);
 try{
  const results=await Promise.all(weeks.map(w=>getDoc(doc(db,'monitoringAreaAssignments',w))));
  const options=psiAnalysts.map(u=>`<option value="${escapeHTML(u.uid)}">${escapeHTML(u.name||u.userCode||u.uid)}</option>`).join('');
  host.innerHTML=`<div class="psi-calendar-grid">${weeks.map((w,i)=>{const record=results[i].exists()?results[i].data():null;const monday=dates[i],sunday=psiAddDays(monday,6);return `<article class="psi-calendar-week"><div><strong>${escapeHTML(w)}</strong><small>${monday} — ${sunday}</small></div><label>Responsable<select data-calendar-analyst="${w}"><option value="">Sin asignar</option>${options}</select></label><button type="button" data-calendar-save="${w}">Guardar</button><small class="psi-calendar-status">${record?'✓ Programado':'Pendiente de asignación'}</small></article>`;}).join('')}</div>`;
  weeks.forEach((w,i)=>{const record=results[i].exists()?results[i].data():null;const sel=host.querySelector(`[data-calendar-analyst="${w}"]`);if(sel&&record?.analystUid)sel.value=record.analystUid;});
 }catch(err){host.innerHTML=`<p role="alert">No se pudo cargar el calendario: ${escapeHTML(err.message)}. Revise permisos de Firestore.</p>`;}
}
// Alertas QC basadas en el mismo motor de aptitud y vigencia del planificador Q1/Q2.
// No se crean documentos de avisos: cada cambio real en Firebase recalcula el pendiente.
function psiRefreshQcReactivations(){
 if(!Object.values(psiQcReady).every(Boolean))return;
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const last=q=>psiQcDaily.flatMap(x=>{const c=x.controls?.[q];return c&&['CONFORME','NO_CONFORME'].includes(c.status)&&/^\d{4}-\d{2}-\d{2}$/.test(c.date||'')?[c]:[];}).sort((a,b)=>b.date.localeCompare(a.date))[0];
 const q1last=last('Q1');let q1=q1last?psiAddDays(q1last.date,2):today;
 while(![2,3,4].includes(new Date(q1+'T12:00:00Z').getUTCDay()))q1=psiAddDays(q1,1);
 const q2dates=psiQcDaily.flatMap(x=>{const c=x.controls?.Q2;return c&&['CONFORME','NO_CONFORME'].includes(c.status)&&/^\d{4}-\d{2}-\d{2}$/.test(c.date||'')?[c.date]:[];}).sort();
 let q2=q2dates.length?psiAddDays(q2dates[0],15):today;
 if(q2dates.length){let guard=0;while(q2<=q2dates.at(-1)&&guard++<20000)q2=psiAddDays(q2,15);}
 const targets=[{q:'Q1',date:q1,phase:qcPhase(psiQcDaily,q1,'')},{q:'Q2',date:q2,phase:'POSITIVO'}];
 const alerts=[];
 for(const target of targets){
  // Los controles sin fecha próxima no generan avisos anticipados.
  if(target.date>psiAddDays(today,3))continue;
  const matching=psiQcDaily.some(x=>{const c=x.controls?.[target.q];return c&&['CONFORME','NO_CONFORME'].includes(c.status)&&c.date===target.date;});
  if(matching)continue;
  const resources=qcResources(psiQcMedia,psiQcReactions,target.date,'Ambos medios',target.phase);
  for(const r of resources){if(r.valid.length)continue;
   alerts.push({q:target.q,date:target.date,phase:target.phase,atcc:r.atcc,medium:r.name,kind:target.date<today?'ATRASADO':target.date===today?'HOY':'PROXIMO'});
  }
 }
 psiQcReactivationAlerts=alerts;drawNotifications();
}
function startAreaNotificationWatch(){
 if(profile?.role==='PERSONAL_LIMPIEZA')return;
 psiAlertStops.forEach(f=>f());psiAlertStops=[];psiApprovalAlerts=[];psiAreaAlerts=[];psiMediaExpiryAlerts=[];psiMediaPreps=[];psiAnUses=[];psiAnUsesReady=false;psiMediaAlertError='';psiStrainAlerts=[];psiStrainError='';psiQcReactivationAlerts=[];psiAutoclaveAlerts=[];psiQcDaily=[];psiQcReactions=[];psiQcMedia=[];psiQcReady={daily:false,reactions:false,media:false};psiQcAlertError='';psiWeekAssignment=null;psiCleaningAlerts=[];psiCleaningAlertErrors=[];
 psiAlertStops.push(watchCleaningAlerts(db,(alerts,meta)=>{psiCleaningAlerts=alerts;psiCleaningAlertErrors=meta?.failed||[];drawNotifications();}));
 const isAdmin=profile.role==='ADMIN',week=psiWeekKey();
 const autoclaveCycles=[];
 psiAlertStops.push(onSnapshot(collection(db,'microAutoclaveCycles'),snap=>{
  const cycles=snap.docs.map(d=>({id:d.id,...d.data()}));
  const localToday=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const addMonths=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number),v=new Date(Date.UTC(y,m-1+n,1));v.setUTCDate(Math.min(d,new Date(Date.UTC(v.getUTCFullYear(),v.getUTCMonth()+1,0)).getUTCDate()));return v.toISOString().slice(0,10)};
  psiAutoclaveAlerts=[];
  for(const [id,name,frequency] of [['DES','Descontaminación',30],['EST','Esterilización',60]]){
   const rows=cycles.filter(c=>c.equipment===id).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.start||'').localeCompare(String(b.start||''))||(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)||(a.createdAt?.nanoseconds||0)-(b.createdAt?.nanoseconds||0)||String(a.id||'').localeCompare(String(b.id||'')));
   const last=rows.findLastIndex(c=>c.attestResult==='CONFORME');const loads=rows.slice(last+1).reduce((v,c)=>v+Number(c.loads||0),0);
   if(loads>=frequency-5)psiAutoclaveAlerts.push({equipment:id,name,kind:'ATTEST',status:loads>=frequency?'REQUERIDO':'PROXIMO',detail:`${loads}/${frequency} cargas desde Attest conforme`});
   const sterikon=[...rows].reverse().find(c=>c.sterikonResult==='CONFORME');
   if(sterikon?.date){const next=addMonths(sterikon.date,2);if(next<=psiAddDays(localToday,7))psiAutoclaveAlerts.push({equipment:id,name,kind:'STERIKON',status:next<=localToday?'REQUERIDO':'PROXIMO',detail:`Próximo control ${next}`});}
   else psiAutoclaveAlerts.push({equipment:id,name,kind:'STERIKON',status:'INICIAL',detail:'Pendiente de establecer primer control; sin vencimiento calculable'});
  }
  drawNotifications();
 },err=>{console.warn('Avisos de autoclaves:',err);psiAutoclaveAlerts=[];drawNotifications()}));

 if(isAdmin){
  psiAlertStops.push(onSnapshot(query(collection(db,'monitoringAreaControls'),where('status','==','PENDIENTE_REVISION_TECNICA')),snap=>{psiApprovalAlerts=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.readingDate||'').localeCompare(String(a.readingDate||'')));drawNotifications();},e=>{console.warn('Aprobaciones: ',e);psiApprovalAlerts=[];drawNotifications();}));
  getDocs(collection(db,'users')).then(snap=>{psiAnalysts=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.active!==false&&u.role!=='ADMIN');drawNotifications();}).catch(e=>console.warn('Usuarios para asignación',e));
 }
 // Las alertas usan exactamente el saldo del inventario: AN descuenta también usos de cepas.
 if(!isAdmin){
  const refreshMedia=()=>{
   if(!psiAnUsesReady)return;
   const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const end=psiAddDays(today,3);
   psiMediaExpiryAlerts=psiMediaPreps.filter(p=>{
    const anUsed=p.mediumId==='AN'?psiAnUses.filter(u=>u.preparationId===p.id).length:0;
    const saldo=Math.max(0,Number(p.count||0)-Number(p.usedUnits||0)-anUsed);
    p._alertSaldo=saldo;
    return ['LIBERADO','LIBERADO_HISTORICO'].includes(p.status)&&saldo>0&&/^\d{4}-\d{2}-\d{2}$/.test(String(p.expiry||''))&&p.expiry<=end;
   }).sort((a,b)=>a.expiry.localeCompare(b.expiry));
   drawNotifications();
  };
  psiAlertStops.push(onSnapshot(collection(db,'microMediaPreparations'),snap=>{psiMediaPreps=snap.docs.map(d=>({id:d.id,...d.data()}));psiMediaAlertError='';refreshMedia();},e=>{psiMediaExpiryAlerts=[];psiMediaAlertError=e.code||e.message;drawNotifications();}));
  psiAlertStops.push(onSnapshot(collection(db,'microStrainAnUses'),snap=>{psiAnUses=snap.docs.map(d=>d.data());psiAnUsesReady=true;refreshMedia();},e=>{psiMediaExpiryAlerts=[];psiMediaAlertError=e.code||e.message;drawNotifications();}));
  // Q1/Q2: reactivaciones APTAS faltantes según el mismo criterio técnico de QC.
  for(const [key,col,ref] of [['daily','microDailyQuality',query(collection(db,'microDailyQuality'),orderBy('date','desc'),limit(350))],['reactions','microStrainReactivations',collection(db,'microStrainReactivations')],['media','microMediaPreparations',collection(db,'microMediaPreparations')]]){
   psiAlertStops.push(onSnapshot(ref,snap=>{
    const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(key==='daily')psiQcDaily=rows;
    if(key==='reactions')psiQcReactions=rows;
    if(key==='media')psiQcMedia=rows;
    psiQcReady[key]=true;psiQcAlertError='';psiRefreshQcReactivations();
   },err=>{psiQcReady[key]=false;psiQcReactivationAlerts=[];psiQcAlertError=err.code||err.message;drawNotifications();}));
  }
  // Cepas: saldo físico actual (no usar live(), que oculta vencidas).
  // No notificar preparaciones agotadas, rechazadas o cerradas.
  psiAlertStops.push(onSnapshot(collection(db,'microStrainPreparations'),snap=>{
   const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const end=psiAddDays(today,3);
   psiStrainAlerts=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>{
    const state=String(p.status||'').toUpperCase();
    return state==='APTA'&&Number(p.available||0)>0&&
     !p.closedAt&&!p.discardedAt&&!p.deactivatedAt&&
     /^\d{4}-\d{2}-\d{2}$/.test(String(p.expiry||''))&&p.expiry<=end;
   }).sort((a,b)=>a.expiry.localeCompare(b.expiry));
   psiStrainError='';drawNotifications();
  },err=>{psiStrainAlerts=[];psiStrainError=err.code||err.message;drawNotifications();}));
  // El monitoreo ambiental se consulta desde cualquier módulo, no solo al abrir Planificador.
  let areaPoints=[],areaControls=[],pointsReady=false,controlsReady=false;
  const refreshAreas=()=>{
   if(!pointsReady||!controlsReady)return;
   const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const latest=new Map();
   for(const c of areaControls){if(!/^\d{4}-\d{2}-\d{2}$/.test(c.executedAt||''))continue;const old=latest.get(c.pointCode);if(!old||(c.executedAt+' '+(c.executedTime||''))>(old.executedAt+' '+(old.executedTime||'')))latest.set(c.pointCode,c);}
   psiAreaAlerts=areaPoints.filter(p=>p.active!==false).flatMap(p=>{
    const last=latest.get(p.code);if(!last)return [{code:p.code,name:p.name,kind:'PRIMERO',next:'Sin primer control'}];
    const next=psiAddDays(last.executedAt,Number(p.frequencyDays)||30);
    if(next>psiAddDays(today,3))return [];
    return [{code:p.code,name:p.name,kind:next<today?'VENCIDO':'PROXIMO',next}];
   }).sort((a,b)=>String(a.next).localeCompare(String(b.next)));
   drawNotifications();
  };
  psiAlertStops.push(onSnapshot(collection(db,'monitoringAreaPoints'),snap=>{areaPoints=snap.docs.map(d=>({code:d.id,...d.data()}));pointsReady=true;refreshAreas();},e=>console.warn('Catálogo de monitoreo:',e)));
  psiAlertStops.push(onSnapshot(collection(db,'monitoringAreaControls'),snap=>{areaControls=snap.docs.map(d=>d.data());controlsReady=true;refreshAreas();},e=>console.warn('Controles de monitoreo:',e)));
 }
 psiAlertStops.push(onSnapshot(doc(db,'monitoringAreaAssignments',week),snap=>{psiWeekAssignment=snap.exists()?snap.data():null;drawNotifications();},e=>{console.warn('Asignación semanal',e);psiWeekAssignment=null;drawNotifications();}));
}
function shell(){
 const restricted=profile?.role==='PERSONAL_LIMPIEZA';
 const nav=(restricted?[['LIMPIEZA',[['cleaning','🧹','Plan de limpieza']]]]:groups).map(([name,items])=>`<div class="nav-heading">${name}</div>${items.map(([id,icon,label])=>`<button class="nav-item ${id===selectedPage?'selected':''}" data-page="${id}" title="${label}"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span>${!['dashboard','samples','quality','products','media','strains','areas','equipment','cleaning','communications','admin'].includes(id)?'<span class="nav-tag">PRÓX.</span>':''}</button>`).join('')}`).join('');
 root.innerHTML=`<div class="layout" id="layout"><div class="backdrop" id="backdrop"></div><aside class="sidebar"><div class="brand"><span class="brand-logo">🧬</span><div class="brand-text"><div class="brand-title">LAB-PSI</div><small>MICROBIOLOGÍA NEXTGEN</small></div></div><nav class="nav-scroll">${nav}</nav><div class="sidebar-footer"><strong>MICROBIOLOGÍA NEXTGEN</strong><br>${APP_VERSION_LABEL} · Interfaz PSI 2027</div></aside><div class="workspace"><header class="topbar"><div class="top-left"><button class="icon-btn" id="menu-toggle" title="Expandir o contraer menú" aria-label="Alternar menú">☰</button><div class="top-title"><strong id="header-title">ERP Microbiología</strong><small>LAB-PSI · Entorno local de desarrollo</small></div></div><div class="top-right"><label class="density-control" title="Personalizar tamaño y espaciado de toda la interfaz"><span>⚙ Vista</span><select id="density-select" aria-label="Densidad visual"><option value="comfortable">Cómoda</option><option value="compact">Compacta</option><option value="dense">Máxima</option></select></label><div class="search-box">⌕ <input id="nav-search" placeholder="Buscar módulo..." aria-label="Buscar módulo" /></div><span class="pill" id="sync-indicator">● Motor listo</span><button id="bell" class="icon-btn" aria-label="Centro de notificaciones">🔔 <span id="bell-badge"></span></button><span class="avatar" title="${escapeHTML(profile.userCode||currentUser.email)}">${escapeHTML((profile.userCode||'U').slice(0,2))}</span><button id="logout" class="secondary logout">Salir</button></div></header><section class="content"><div id="notify-panel" class="card notify-panel" hidden><div class="notify-head"><h2>🔔 Comunicaciones · Avisos</h2><span class="pill" id="notify-live-state">Conectando</span></div><p id="notify-summary">Cargando bandeja...</p><div class="notify-filters"><select id="notify-filter" aria-label="Estado"><option value="unread">Sin leer</option><option value="pending">Por atender</option><option value="attended">Atendidas</option><option value="all">Todas</option></select><select id="notify-priority" aria-label="Prioridad"><option value="ALL">Todas las prioridades</option><option value="CRITICA">🔴 Crítica</option><option value="IMPORTANTE">🟠 Importante</option><option value="NORMAL">🟢 Normal</option></select><select id="notify-person" aria-label="Remitente"><option value="ALL">Todos los colaboradores</option></select><input id="notify-search" placeholder="Buscar comunicación…" aria-label="Buscar notificaciones" /></div><div id="area-notify-section" class="area-notify-section" hidden></div><div id="notify-items"></div><button id="open-communications">Abrir centro</button> <button class="secondary" id="close-notify">Cerrar</button></div><div class="psi-page-context" aria-label="Ubicación actual"><div class="psi-breadcrumb"><span>PSI NEXTGEN</span><span class="psi-separator">/</span><span id="psi-section">Principal</span><span class="psi-separator">/</span><strong id="psi-current">Panel general</strong></div><span class="psi-context-badge">● Plataforma operativa</span></div><div id="page-content"></div><div id="search-results" class="search-results" hidden></div></section></div></div>`;
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
 if(restricted){root.querySelector('#bell').hidden=true;root.querySelector('#nav-search').closest('.search-box').hidden=true;root.querySelector('#notify-panel').hidden=true;}
 if(stopStatus)stopStatus();
 stopStatus=sync.watchStatus(state=>{
   const indicator=root.querySelector('#sync-indicator');if(!indicator)return;
   indicator.textContent=state.online?(state.pendingWrites?`◐ ${state.pendingWrites} envío(s) pendiente(s)`:'● En línea · Motor listo'):'● Sin conexión';
   const panel=root.querySelector('#engine-monitor');
   if(panel)panel.innerHTML=`<div class="monitor-grid"><span>Suscripciones activas <b>${state.activeListeners}</b></span><span>Eventos de consulta <b>${state.snapshotEvents}</b></span><span>Documentos recibidos* <b>${state.documentsDelivered}</b></span><span>Lecturas de caché <b>${state.cacheHits}</b></span><span>Guardados confirmados <b>${state.writesConfirmed}</b></span><span>Errores de escritura <b>${state.writesFailed}</b></span></div><small>*Métrica local, NO equivale a lecturas facturables de Firestore.</small>`;
 });
 startAreaNotificationWatch();
 // Las alertas de áreas se mantienen mediante suscripciones globales a Firebase.
 root.querySelector('#bell').onclick=()=>{const p=root.querySelector('#notify-panel');p.hidden=!p.hidden;if(!p.hidden)drawNotifications();};
 for(const [id,setter] of [['notify-filter',v=>notificationFilter=v],['notify-priority',v=>notificationPriority=v],['notify-person',v=>notificationPerson=v],['notify-search',v=>notificationSearch=v]])root.querySelector('#'+id).addEventListener(id==='notify-search'?'input':'change',e=>{setter(e.target.value);drawNotifications();});
 root.querySelector('#notify-items').onclick=e=>{const b=e.target.closest('[data-open-peer]');if(!b)return;notificationFocus=b.dataset.openPeer;root.querySelector('#notify-panel').hidden=true;showPage('communications');};
 root.querySelector('#area-notify-section').onclick=async e=>{
 const calendar=e.target.closest('[data-open-calendar]');if(calendar&&profile.role==='ADMIN'){psiOpenCalendar();return;}
 const assign=e.target.closest('[data-week-assign]');if(assign&&profile.role==='ADMIN'){
  const select=root.querySelector('#psi-week-analyst');const uid=select?.value;if(!uid)return;
  try{await setDoc(doc(db,'monitoringAreaAssignments',psiWeekKey()),{analystUid:uid,analystName:psiAnalysts.find(x=>x.uid===uid)?.name||uid,week:psiWeekKey(),updatedBy:currentUser.uid,updatedAt:serverTimestamp()});}catch(err){alert('No se pudo asignar la semana: '+err.message);}return;
 }
 const approval=e.target.closest('[data-approval-go]');if(approval){root.querySelector('#notify-panel').hidden=true;sessionStorage.setItem('psi_area_open_review',approval.dataset.approvalGo);showPage('areas');return;}
 const qc=e.target.closest('[data-qc-reactivation]');if(qc){root.querySelector('#notify-panel').hidden=true;sessionStorage.setItem('micro_reactivation_context',JSON.stringify({atcc:qc.dataset.qcReactivation,medium:qc.dataset.qcMedium,test:qc.dataset.qcKind,origin:'qc-planner'}));showPage('strains');openQcStrainReactivation(qc.dataset.qcReactivation);return;}
 const strain=e.target.closest('[data-strain-expiry]');if(strain){root.querySelector('#notify-panel').hidden=true;sessionStorage.setItem('psi_strain_expiry_target',strain.dataset.strainExpiry);showPage('strains');return;}
 const media=e.target.closest('[data-media-expiry]');if(media){root.querySelector('#notify-panel').hidden=true;sessionStorage.setItem('psi_media_expiry_target',media.dataset.mediaExpiry);showPage('media');return;}
 const cleaning=e.target.closest('[data-cleaning-go]');if(cleaning){root.querySelector('#notify-panel').hidden=true;sessionStorage.setItem('psi_cleaning_target',JSON.stringify({id:cleaning.dataset.cleaningGo,moment:cleaning.dataset.cleaningMoment||'UNICA',date:new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}));showPage('cleaning');return;}
 const auto=e.target.closest('[data-autoclave-go]');if(auto){root.querySelector('#notify-panel').hidden=true;showPage('equipment');return;}
 const b=e.target.closest('[data-area-go]');if(!b)return;root.querySelector('#notify-panel').hidden=true;showPage('areas');
 };
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
 const admin=profile.role==='ADMIN';const assigned=!admin&&psiWeekAssignment?.analystUid===currentUser?.uid;const ownAreaAlerts=assigned?psiAreaAlerts:[];const ownMediaAlerts=assigned?psiMediaExpiryAlerts:[];const ownStrainAlerts=assigned?psiStrainAlerts:[];const ownQcAlerts=assigned?psiQcReactivationAlerts:[];const ownAutoclaveAlerts=assigned?psiAutoclaveAlerts:[];const ownCleaningAlerts=(assigned||admin)?psiCleaningAlerts:[];
 if(badge){const total=unread.length+ownAreaAlerts.length+ownMediaAlerts.length+ownStrainAlerts.length+ownQcAlerts.length+ownAutoclaveAlerts.length+ownCleaningAlerts.length+(admin?psiApprovalAlerts.length:0);badge.textContent=total?String(Math.min(total,99))+(total>99?'+':''):'';badge.setAttribute('aria-label',unread.length+' comunicaciones sin leer y '+ownAreaAlerts.length+' controles microbiológicos por atender, '+ownMediaAlerts.length+' medios por vencer o vencidos, '+ownStrainAlerts.length+' cepas por gestionar, '+ownQcAlerts.length+' reactivaciones QC pendientes y '+(admin?psiApprovalAlerts.length:0)+' aprobaciones pendientes y '+ownCleaningAlerts.length+' limpiezas de equipos por atender');}const areaSection=root.querySelector('#area-notify-section');if(areaSection){
 const assignUI=admin?`<div class="area-notify-title"><strong>📅 Programación semanal de analistas</strong><small>Semana actual: ${escapeHTML(psiWeekKey())} · ${escapeHTML(psiWeekAssignment?.analystName||'Sin responsable asignado')}</small></div><button type="button" class="area-notify-row" data-open-calendar="1"><span>📅</span><span><b>Abrir calendario de responsables</b><small>Asignar esta semana y las siguientes · Guardado en Firebase</small></span><span>Programar →</span></button>`:'';
 const approvals=admin&&psiApprovalAlerts.length?`<div class="area-notify-title"><strong>🧪 Lecturas pendientes de aprobación · ${psiApprovalAlerts.length}</strong><small>Acceso directo a evaluación técnica</small></div>${psiApprovalAlerts.map(c=>`<button type="button" class="area-notify-row" data-approval-go="${escapeHTML(c.id)}"><span>🟠</span><span><b>${escapeHTML(c.pointName||c.pointCode||'Monitoreo')}</b><small>${escapeHTML(c.pointCode)} · ${escapeHTML(c.medium)} · ${escapeHTML(c.readingDate||'')} · ${escapeHTML(c.resultValue??'—')} ${escapeHTML(c.resultUnit||'')}</small></span><span>Evaluar →</span></button>`).join('')}`:admin?'<p class="muted">✓ Sin lecturas pendientes de aprobación.</p>':'';
 const operational=ownAreaAlerts.length?`<div class="area-notify-title"><strong>🧫 Controles de su semana · ${ownAreaAlerts.length}</strong><small>Responsable: ${escapeHTML(psiWeekAssignment?.analystName||'')}</small></div>${ownAreaAlerts.map(a=>`<button type="button" class="area-notify-row" data-area-go="${escapeHTML(a.code)}"><span class="area-notify-dot ${a.kind.toLowerCase()}"></span><span><b>${escapeHTML(a.name)}</b><small>${escapeHTML(a.code)} · ${escapeHTML(a.kind)} · ${escapeHTML(a.next)}</small></span><span>→</span></button>`).join('')}`:'';
 const expiry=ownMediaAlerts.length?`<div class="area-notify-title"><strong>🧪 Medios por gestionar · ${ownMediaAlerts.length}</strong><small>Vencidos o con vencimiento en los próximos 3 días · cierre documental</small></div>${ownMediaAlerts.map(p=>`<button type="button" class="area-notify-row" data-media-expiry="${escapeHTML(p.id)}"><span>${p.expiry<new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())?'🔴':'🟠'}</span><span><b>${escapeHTML(p.mediumName||p.mediumId||'Medio')} · ${escapeHTML(p.code||p.lotId||p.id)}</b><small>Vence: ${escapeHTML(p.expiry)} · Saldo disponible: ${p._alertSaldo} · ${p.expiry<new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())?'Vencido':'Próximo vencimiento'}</small></span><span>Gestionar →</span></button>`).join('')}`:'';
 const qcGrouped=Object.values(ownQcAlerts.reduce((acc,a)=>{const key=a.q+'|'+a.date+'|'+a.atcc;const row=acc[key]||(acc[key]={...a,media:[]});row.media.push(a.medium);return acc;},{}));
 const qcAlerts=qcGrouped.length?`<div class="area-notify-title"><strong>🧬 Reactivaciones para control QC · ${qcGrouped.length}</strong><small>Q1/Q2 · evidencia APTA requerida según fecha del planificador</small></div>${qcGrouped.map(a=>`<button type="button" class="area-notify-row" data-qc-reactivation="${escapeHTML(a.atcc)}" data-qc-medium="${escapeHTML(a.media.join(', '))}" data-qc-kind="${escapeHTML(a.q)}"><span>${a.kind==='ATRASADO'||a.kind==='HOY'?'🔴':'🟠'}</span><span><b>${escapeHTML(a.q)} · ${escapeHTML(a.atcc==='11775'?'Escherichia coli':a.atcc==='29212'?'Enterococcus faecalis':a.atcc==='14028'?'Salmonella Typhimurium':'Cepa de referencia')} · ATCC ${escapeHTML(a.atcc)}</b><small>${escapeHTML(a.media.join(' y '))} · ${escapeHTML(a.date)} · ${escapeHTML(a.phase)} · ${escapeHTML(a.kind)}</small></span><span>Reactivar →</span></button>`).join('')}`:'';
 const cleaning=ownCleaningAlerts.length?`<div class="area-notify-title"><strong>🧹 Limpiezas por atender · ${ownCleaningAlerts.length}</strong><small>${escapeHTML(psiWeekAssignment?.analystName||'Responsable semanal')} · frecuencias desde última ejecución · responsable semanal</small></div>${ownCleaningAlerts.map(a=>`<button type="button" class="area-notify-row" data-cleaning-go="${escapeHTML(a.id)}" data-cleaning-moment="${escapeHTML(a.moment||'UNICA')}" data-cleaning-date="${escapeHTML(a.date)}"><span>${a.state==='ATRASADA'?'🔴':a.state==='PRÓXIMA'?'🔵':'🟠'}</span><span><b>${escapeHTML(a.name)} · ${a.count} ${escapeHTML(a.unit)}</b><small>${escapeHTML(a.state)} · ${a.remaining<0?Math.abs(a.remaining)+' días de atraso · ':a.remaining>0?'en '+a.remaining+' días · ':''}${escapeHTML(a.date)} · ${escapeHTML(a.codes.slice(0,8).join(' · '))}${a.codes.length>8?' …':''} · ${escapeHTML(a.record)}</small></span><span>${a.remaining>0?'Ver plan →':'Registrar →'}</span></button>`).join('')}`:'';
 const autoclaves=ownAutoclaveAlerts.length?`<div class="area-notify-title"><strong>♨️ Autoclaves por controlar · ${ownAutoclaveAlerts.length}</strong><small>Attest por cargas · Sterikon por fechas · Responsable semanal</small></div>${ownAutoclaveAlerts.map(a=>`<button type="button" class="area-notify-row" data-autoclave-go="${escapeHTML(a.equipment)}"><span>${a.status==='REQUERIDO'?'🔴':'🟠'}</span><span><b>${escapeHTML(a.name)} · ${escapeHTML(a.kind)}</b><small>${escapeHTML(a.detail)} · ${escapeHTML(a.status)}</small></span><span>Registrar →</span></button>`).join('')}`:'';
 const strains=ownStrainAlerts.length?`<div class="area-notify-title"><strong>🧬 Cepas por gestionar · ${ownStrainAlerts.length}</strong><small>Crioviales con saldo físico pendiente · vencidos o próximos a vencer (3 días)</small></div>${ownStrainAlerts.map(p=>`<button type="button" class="area-notify-row" data-strain-expiry="${escapeHTML(p.id)}"><span>${p.expiry<new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())?'🔴':'🟠'}</span><span><b>${escapeHTML(p.species||'Cepa')} · ATCC ${escapeHTML(p.atcc||'—')}</b><small>${escapeHTML(p.code||p.id)} · Vence: ${escapeHTML(p.expiry)} · Crioviales sin consumir: ${Number(p.available||0)}</small></span><span>Revisar →</span></button>`).join('')}`:'';
 areaSection.hidden=!(admin||operational||expiry||strains||qcAlerts||autoclaves||cleaning);areaSection.innerHTML=cleaning+assignUI+approvals+(psiCleaningAlertErrors.length&&admin?'<p role="alert">No se pudieron consultar algunas fuentes de alertas de limpieza. Revise permisos de Firebase.</p>':'')+autoclaves+qcAlerts+operational+expiry+strains+(assigned&&psiMediaAlertError?'<p role="alert">No se pudieron consultar los vencimientos de medios. Revise permisos.</p>':'')+(assigned&&psiStrainError?'<p role="alert">No se pudieron consultar las cepas. Revise permisos de Firebase.</p>':'')+(assigned&&psiQcAlertError?'<p role="alert">No se pudo consultar el planificador de reactivaciones QC. Revise permisos de Firebase.</p>':'');
 }
 const live=root.querySelector('#notify-live-state');if(live){live.textContent=commSnapshot.status==='error'?'Sin conexión':commSnapshot.status==='connecting'?'Conectando':'Sincronizado';live.classList.toggle('notify-offline',commSnapshot.status==='error');}
 if(summary)summary.textContent=`${unread.length} sin leer · ${pending.length} pendientes · ${rows.length} recibidas (consulta limitada)`;
 const peers=new Map(rows.map(m=>[m.senderUid,commRecipients.find(p=>p.uid===m.senderUid)?.label||m.senderUid?.slice(0,10)+'…']));
 const previous=notificationPerson;
 people.innerHTML='<option value="ALL">Todos los colaboradores</option>'+[...peers].map(([uid,name])=>`<option value="${escapeHTML(uid)}">${escapeHTML(name)}</option>`).join('');
 people.value=peers.has(previous)?previous:'ALL';if(people.value!==previous)notificationPerson='ALL';
 const q=notificationSearch.toLocaleLowerCase('es').trim();
 const visible=rows.filter(m=>(notificationFilter==='all'||(notificationFilter==='pending'&&!m.attendedAt)||(notificationFilter==='unread'&&!m.readAt)||(notificationFilter==='attended'&&!!m.attendedAt))&&(notificationPriority==='ALL'||m.priority===notificationPriority)&&(notificationPerson==='ALL'||m.senderUid===notificationPerson)&&(!q||[m.subject,m.body,peers.get(m.senderUid)].some(v=>String(v||'').toLocaleLowerCase('es').includes(q)))).sort((a,b)=>{const weight=x=>x.priority==='CRITICA'?3:x.priority==='IMPORTANTE'?2:1;return weight(b)-weight(a)||(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0);});
 items.innerHTML=commSnapshot.status==='error'?'<p class="muted notify-empty">No se pudo sincronizar. Compruebe la conexión y los permisos de Firebase.</p>':visible.length?visible.map(m=>`<button type="button" class="notify-row notify-action ${m.attendedAt?'is-attended':''}" data-open-peer="${escapeHTML(m.senderUid)}"><span class="notify-row-top"><span class="notify-severity ${escapeHTML(m.priority)}">${m.priority==='CRITICA'?'🔴':m.priority==='IMPORTANTE'?'🟠':'🟢'} ${escapeHTML(m.priority||'NORMAL')}</span><small>${m.attendedAt?'Atendida':m.readAt?'Leída · pendiente':'Nueva · pendiente'}</small></span><b>${escapeHTML(m.subject)}</b><small>De: ${escapeHTML(peers.get(m.senderUid)||'Usuario')}</small><p>${escapeHTML((m.body||'').slice(0,125))}</p><span class="notify-open">Abrir conversación →</span></button>`).join(''):'<p class="muted notify-empty">No hay comunicaciones para estos filtros.</p>';
}
function showPage(id){
 if(profile?.role==='PERSONAL_LIMPIEZA'&&id!=='cleaning')id='cleaning';
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
 if(selectedPage==='equipment'&&id!=='equipment')stopAutoclaves();
 if(selectedPage==='cleaning'&&id!=='cleaning')stopCleaning();
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
 if(id==='areas'){renderAreas(content);return;}
 if(id==='equipment'){renderAutoclaves(content,currentUser,profile);return;}
 if(id==='cleaning'){renderCleaning(content,currentUser,profile);return;}
 if(id==='products'){renderProducts(content,currentUser,profile);return;}
 if(id==='media'){renderMedia(content,currentUser,profile);return;}
 if(id==='strains'){renderStrains(content,currentUser,profile);return;}
 if(id==='admin'){if(profile.role!=='ADMIN'){content.innerHTML='<h1>Acceso restringido</h1><p>Solo el administrador puede gestionar perfiles.</p>';return;}renderAdmin(content,currentUser.uid);return;}
 if(id==='communications'){
   content.innerHTML=`<div class="comm-page-heading"><div><div class="eyebrow">COMUNICACIÓN Y AVISOS · PSI NEXTGEN</div><h1>Comunicaciones</h1><p class="intro">Conversaciones por colaborador · lectura y atención independientes · sincronización compartida.</p></div><span class="pill">● Conectado a Firebase</span></div><div id="comm-inbox" class="comm-pro"></div>`;
   const node=root.querySelector('#comm-inbox');node.innerHTML='<div class="card">Cargando directorio e historial de mensajes…</div>';
   const token=node;Promise.allSettled([getRecipients(),loadSent(currentUser.uid)]).then(results=>{if(root.querySelector('#comm-inbox')!==token)return;commRecipients=results[0].status==='fulfilled'?results[0].value:[];if(results[0].status==='rejected')console.error('Directorio no disponible:',results[0].reason);drawNotifications();refreshCommunications();});return;
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
    if(!snap.exists()||p.active!==true||!['ADMIN','JEFE','ANALISTA','PERSONAL_LIMPIEZA'].includes(p.role)){
      await signOut(auth);login('Su cuenta está autenticada, pero no tiene un perfil activo autorizado. Solicite al administrador crear users/{UID}.');return;
    }
    currentUser=user;profile=p;sync.setUser(user.uid);if(p.role==='PERSONAL_LIMPIEZA')selectedPage='cleaning';shell();resetIdle();if(p.role==='PERSONAL_LIMPIEZA')showPage('cleaning');
  }catch(err){if(token!==sessionToken)return;await signOut(auth);login(`No se pudo verificar el perfil (${err.code||'error'}). Revise reglas y conexión.`);}
});
login();
