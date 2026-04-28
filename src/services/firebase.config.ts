// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDI6mIJeH31GwDqC2oegBSyfTcEEXvwmRg",
  authDomain: "elpatron-6badb.firebaseapp.com",
  projectId: "elpatron-6badb",
  storageBucket: "elpatron-6badb.firebasestorage.app",
  messagingSenderId: "431420776359",
  appId: "1:431420776359:web:84f6f7edc0d6bba7b82082",
  measurementId: "G-J8STGVYLKR",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

export { analytics, app, auth, db, functions };
