import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
export const firebaseConfig = {
  apiKey: 'AIzaSyBo5FUfpDx4LGYjqHXbTXZGCMc7HQgo-E0',
  authDomain: 'microbiologia-psi.firebaseapp.com',
  projectId: 'microbiologia-psi',
  storageBucket: 'microbiologia-psi.firebasestorage.app',
  messagingSenderId: '267439799131',
  appId: '1:267439799131:web:00fc9353c1edbfd5f9b87e'
};
export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
