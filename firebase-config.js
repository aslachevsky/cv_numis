import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

const app = initializeApp(JSON.parse(atob(
  "eyJhcGlLZXkiOiJBSXphU3lCT0IzRVpRUThqS095aWVPcXQ1X0VlYlVuOElUa25BZlkiLCJhdXRo" +
  "RG9tYWluIjoiaGVsaW8tcHJvZHVjZS5maXJlYmFzZWFwcC5jb20iLCJwcm9qZWN0SWQiOiJoZWxp" +
  "by1wcm9kdWNlIiwic3RvcmFnZUJ1Y2tldCI6ImhlbGlvLXByb2R1Y2UuZmlyZWJhc2VzdG9yYWdl" +
  "LmFwcCIsIm1lc3NhZ2luZ1NlbmRlcklkIjoiMjE3ODYwMjgyOTQ3IiwiYXBwSWQiOiIxOjIxNzg2" +
  "MDI4Mjk0Nzp3ZWI6ZGU1ZDFjMDAwZDJmZjBjOGVmZDJmNiJ9"
)));

const db = getFirestore(app);
const storage = getStorage(app);

window.firebaseDB = db;
window.firebaseStorage = storage;
