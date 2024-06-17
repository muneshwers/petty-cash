import { initializeApp } from "firebase/app";
import { getFirestore, doc, collection, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAMeBOhMcS_qgBJVo9PR26YsPZDgCwdJpM",
    authDomain: "projectservers.firebaseapp.com",
    projectId: "projectservers",
    storageBucket: "projectservers.appspot.com",
    messagingSenderId: "840873751173",
    appId: "1:840873751173:web:07fa0c53a00fe7e4626fec"
  };  

const firebaseApp = initializeApp(firebaseConfig)
const fireStore = getFirestore(firebaseApp)
window.doc = doc
window.collection = collection
window.onSnapshot = onSnapshot
window.fireStore = fireStore