import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCz_f0MhEK6uGopnrveTmaCi85njDHU_CA',
  authDomain: 'tsugite-b8fed0.firebaseapp.com',
  projectId: 'tsugite-b8fed0',
  storageBucket: 'tsugite-b8fed0.firebasestorage.app',
  messagingSenderId: '604582510645',
  appId: '1:604582510645:web:f087f04f3edc9f2250f17c',
};

export const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
