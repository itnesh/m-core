// M-CORE Konfiguration
// 1) Firebase Console > Project settings > General > "Your apps" > Web app > firebaseConfig hier einfügen.
// 2) allowedEmail = einziges Google-Konto, das Zugriff hat (muss mit firestore.rules übereinstimmen).
// Solange apiKey leer ist, läuft M-CORE im LOCAL-Modus (Daten nur in diesem Browser).

export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyBq4tuQb-brhAHGRba8CwlxbLZvphUhiB8",
    authDomain: "core-3ff2b.firebaseapp.com",
    projectId: "core-3ff2b",
    storageBucket: "core-3ff2b.firebasestorage.app",
    messagingSenderId: "398597666180",
    appId: "1:398597666180:web:3e1b24e831aa206fd699d1"
  },
  allowedEmail: ""
};
