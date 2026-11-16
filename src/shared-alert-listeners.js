import {onSnapshot} from 'firebase/firestore';

// One Firestore subscription per identical collection/query within the alert engine.
// Reference counted; callbacks retain their own error handling and cleanup.
const listeners = new Map();
export function watchAlertQuery(ref, onData, onError) {
  const key = ref.path;
  // This module is used for collection listeners; query constraints must not be merged.
  // Firebase's canonical query identifier includes all filters and limits.
  const canonical = ref._query ? JSON.stringify({filters:ref._query.filters?.map(f=>String(f.field?.canonicalString?.())+f.op+JSON.stringify(f.value)),orderBy:ref._query.explicitOrderBy?.map(o=>String(o.field?.canonicalString?.())+o.dir),limit:ref._query.limit,limitType:ref._query.limitType}) : ''; 
  const id = `${key}|${canonical || ''}`;
  let entry = listeners.get(id);
  if (!entry) {
    entry = { subscribers: new Set(), snapshot: null, error: null, stop: null };
    listeners.set(id, entry);
    const target = entry;
    target.stop = onSnapshot(ref, snapshot => {
      target.snapshot = snapshot; target.error = null;
      for (const sub of [...target.subscribers]) sub.onData(snapshot);
    }, error => {
      target.error = error;
      for (const sub of [...target.subscribers]) sub.onError?.(error);
    });
  }
  const sub = {onData, onError};
  entry.subscribers.add(sub);
  if (entry.snapshot) queueMicrotask(() => { if (entry.subscribers.has(sub)) onData(entry.snapshot); });
  else if (entry.error) queueMicrotask(() => { if (entry.subscribers.has(sub)) onError?.(entry.error); });
  return () => {
    entry.subscribers.delete(sub);
    if (!entry.subscribers.size) {
      entry.stop?.();
      if (listeners.get(id) === entry) listeners.delete(id);
    }
  };
}
