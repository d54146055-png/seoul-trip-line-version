
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// ==================================================================
// ⚠️ IMPORTANT: REPLACE THE OBJECT BELOW WITH YOUR FIREBASE CONFIG
// Go to Firebase Console -> Project Settings -> General -> Your apps
// ==================================================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};


// Check if config is actually set and valid
// We check for "YOUR_API_KEY" (placeholder) or empty string
export const isFirebaseConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;


let app;
let db: any;
let auth: any;
let googleProvider: any;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    console.log("Firebase initialized successfully (Cloud Mode)");
  } catch (e) {
    console.error("Firebase initialization failed:", e);
    db = null;
    auth = null;
    googleProvider = null;
  }
} else {
  console.warn("Firebase config missing. App is running in Local Storage Mode.");
  db = null;
  auth = null;
  googleProvider = null;
}

export { db, auth, googleProvider };

// This ID groups all data for this specific trip. 
export const TRIP_ID = 'seoul-trip-2025-v1';
