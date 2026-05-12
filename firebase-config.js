// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBOB3EZQQ8jKOyieOqt5_EebUn8ITknAfY",
  authDomain: "helio-produce.firebaseapp.com",
  projectId: "helio-produce",
  storageBucket: "helio-produce.firebasestorage.app",
  messagingSenderId: "217860282947",
  appId: "1:217860282947:web:de5d1c000d2ff0c8efd2f6"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Obtener referencias
const db = getFirestore(app);
const storage = getStorage(app);

// Exportar para uso en otros archivos
window.firebaseDB = db;
window.firebaseStorage = storage;

console.log("✅ Firebase inicializado correctamente");
