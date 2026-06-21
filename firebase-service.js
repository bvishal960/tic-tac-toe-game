import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push, child, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC5H_AimveqwjYDy66oMLBxJiuPw79cY_Q",
  authDomain: "tic-tac-toe-game-c022b.firebaseapp.com",
  databaseURL: "https://tic-tac-toe-game-c022b-default-rtdb.firebaseio.com",
  projectId: "tic-tac-toe-game-c022b",
  storageBucket: "tic-tac-toe-game-c022b.firebasestorage.app",
  messagingSenderId: "368793327098",
  appId: "1:368793327098:web:c217fddaaf58b9094a4043",
  measurementId: "G-YMGSJ3X98M"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const firebaseService = {
  db,
  ref,
  set,
  onValue,
  update,
  push,
  child,
  onDisconnect,
  serverTimestamp
};
