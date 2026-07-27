import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD4P3M_26EMAQ8CMJ1D7h4tlOToJdDnL5I",
  authDomain: "behave-app2026.firebaseapp.com",
  projectId: "behave-app2026",
  storageBucket: "behave-app2026.firebasestorage.app",
  messagingSenderId: "77729878113",
  appId: "1:77729878113:web:beab28a08c2a8996199a20",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
