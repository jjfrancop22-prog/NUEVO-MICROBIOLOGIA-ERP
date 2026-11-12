import { collection, doc, onSnapshot, query, limit, orderBy, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from './firebase';

// Motor único: listeners bajo demanda, caché aislada por usuario y escritura confirmada.
// IndexedDB es una vista de lectura; NO es una cola de escrituras offline.
const DATABASE='micro-nextgen-snapshot-v1';
function openCache(){
  if(!('indexedDB' in window)) return Promise.resolve(null);
  return new Promise(resolve=>{
    const r=indexedDB.open(DATABASE,1);
    r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>resolve(null);
    r.onblocked=()=>resolve(null);
  });
}
async function cacheOperation(mode,key,value){
  const dbi=await openCache(); if(!dbi)return null;
  return new Promise(resolve=>{
    try{
      const tx=dbi.transaction('snapshots',mode), store=tx.objectStore('snapshots');
      const request=mode==='readonly'?store.get(key):store.put(value,key);
      request.onsuccess=()=>resolve(request.result??null);
      request.onerror=()=>resolve(null);
      tx.oncomplete=()=>dbi.close();tx.onerror=()=>{dbi.close();resolve(null);};
    }catch{dbi.close();resolve(null);}
  });
}
const safeClone=value=>JSON.parse(JSON.stringify(value));
class SyncEngine {
  constructor(){
    this.entries=new Map();this.user=null;this.generation=0;this.pending=new Map();this.observers=new Set();
    this.stats={listenersCreated:0,snapshotEvents:0,documentsDelivered:0,cacheHits:0,writesConfirmed:0,writesFailed:0};
    this.online=navigator.onLine;
    window.addEventListener('online',()=>{this.online=true;this.emit();});
    window.addEventListener('offline',()=>{this.online=false;this.emit();});
  }
  monitor(){return {online:this.online,activeListeners:this.entries.size,pendingWrites:this.pending.size,...this.stats};}
  watchStatus(callback){this.observers.add(callback);callback(this.monitor());return ()=>this.observers.delete(callback);}
  emit(){const state=this.monitor();this.observers.forEach(fn=>{try{fn(state);}catch(e){console.error(e);}});}
  setUser(uid){if(this.user!==uid){this.clear();this.user=uid;this.emit();}}
  subscribe(key,makeQuery,callback,{cache=true}={}){
    if(!this.user)throw new Error('Se requiere sesión activa');
    if(typeof key!=='string'||!key)throw new Error('La consulta requiere una clave estable');
    const user=this.user,generation=this.generation,cacheKey=`${user}:${key}`;
    let entry=this.entries.get(key);
    if(!entry){
      entry={callbacks:new Set(),data:[],state:'connecting',error:null,unsubscribe:null,fromCache:false};
      this.entries.set(key,entry);
      if(cache)cacheOperation('readonly',cacheKey).then(saved=>{
        if(!saved||this.user!==user||this.generation!==generation||this.entries.get(key)!==entry||entry.state!=='connecting')return;
        entry.data=saved.data;entry.state='cached';entry.fromCache=true;this.stats.cacheHits++;this.broadcast(entry);this.emit();
      });
      try{
        // includeMetadataChanges evita declarar confirmadas escrituras aún pendientes.
        entry.unsubscribe=onSnapshot(makeQuery(db),{includeMetadataChanges:true},snapshot=>{
          if(this.entries.get(key)!==entry||this.user!==user)return;
          entry.data=snapshot.docs.map(d=>({id:d.id,...d.data()}));
          entry.fromCache=snapshot.metadata.fromCache;
          entry.state=snapshot.metadata.hasPendingWrites?'pending':snapshot.metadata.fromCache?'cached':'synced';
          entry.error=null;this.stats.snapshotEvents++;this.stats.documentsDelivered+=snapshot.size;
          this.broadcast(entry);this.emit();
          if(cache&&!snapshot.metadata.fromCache&&!snapshot.metadata.hasPendingWrites){
            try{cacheOperation('readwrite',cacheKey,{data:safeClone(entry.data),at:Date.now()});}catch{}
          }
        },error=>{entry.state='error';entry.error=error;this.broadcast(entry);this.emit();});
        this.stats.listenersCreated++;
      }catch(error){this.entries.delete(key);throw error;}
    }
    entry.callbacks.add(callback);
    callback({data:entry.data,state:entry.state,error:entry.error,fromCache:entry.fromCache});
    this.emit();
    return ()=>{entry.callbacks.delete(callback);if(!entry.callbacks.size){entry.unsubscribe?.();this.entries.delete(key);this.emit();}};
  }
  broadcast(entry){const result={data:entry.data,state:entry.state,error:entry.error,fromCache:entry.fromCache};entry.callbacks.forEach(fn=>{try{fn(result);}catch(e){console.error(e);}});}
  clear(){this.generation++;for(const entry of this.entries.values())entry.unsubscribe?.();this.entries.clear();this.pending.clear();this.user=null;this.emit();}
  async save(collectionName,data,id=crypto.randomUUID()){
    if(!this.user)throw new Error('Debe iniciar sesión');
    if(!navigator.onLine)throw new Error('Sin conexión: escritura no enviada. Intente nuevamente al reconectar.');
    if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(collectionName))throw new Error('Colección inválida');
    const key=`${collectionName}/${id}`;
    if(this.pending.has(key))return this.pending.get(key); // doble clic: misma promesa
    const user=this.user;
    const {id:ignored,createdAt,updatedAt,...fields}=data;
    const job=(async()=>{
      try{
        await setDoc(doc(db,collectionName,id),{...fields,updatedAt:serverTimestamp(),updatedBy:user},{merge:true});
        this.stats.writesConfirmed++;return id;
      }catch(error){this.stats.writesFailed++;throw error;}
      finally{this.pending.delete(key);this.emit();}
    })();
    this.pending.set(key,job);this.emit();return job;
  }
  // Para edición concurrente: versión comprobada en transacción. Requiere reglas específicas del módulo.
  async saveWithVersion(collectionName,id,fields,expectedVersion){
    if(!this.user||!navigator.onLine)throw new Error('Sesión o conexión no disponible');
    const user=this.user,ref=doc(db,collectionName,id),key=`${collectionName}/${id}`;
    if(this.pending.has(key))return this.pending.get(key);
    const job=(async()=>{
      try{
        const result=await runTransaction(db,async tx=>{
          const previous=await tx.get(ref),version=previous.exists()?(previous.data().version??0):0;
          if(version!==expectedVersion)throw new Error('CONFLICTO: el registro cambió en otra computadora. Recargue antes de guardar.');
          tx.set(ref,{...fields,version:version+1,updatedBy:user,updatedAt:serverTimestamp()},{merge:true});
          return version+1;
        });this.stats.writesConfirmed++;return result;
      }catch(error){this.stats.writesFailed++;throw error;}
      finally{this.pending.delete(key);this.emit();}
    })();this.pending.set(key,job);this.emit();return job;
  }
}
export const sync=new SyncEngine();
export function recentAuditQuery(db){return query(collection(db,'auditLog'),orderBy('createdAt','desc'),limit(20));}
