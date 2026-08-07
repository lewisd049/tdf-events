// Replace these placeholder values with the Firebase web app configuration from the README.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
const firebaseConfig = {
  apiKey: "AIzaSyBXstRTgwqYmV84ZJXEmN5d0zSGGITs-xI",
  authDomain: "tdf-events.firebaseapp.com",
  projectId: "tdf-events",
  storageBucket: "tdf-events.firebasestorage.app",
  messagingSenderId: "772375545394",
  appId: "1:772375545394:web:e6d07bf5dcd37ebfbd1e2b",
  measurementId: "G-E10LJY3M2Z"
};
const app=initializeApp(firebaseConfig); export const auth=getAuth(app); export const db=getFirestore(app);
