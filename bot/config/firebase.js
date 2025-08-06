import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { PrivyClient } from '@privy-io/server-auth';
import dotenv from "dotenv";

dotenv.config();

// Firebase Configuration - Replace with your actual config
const firebaseConfig = {
    apiKey: "AIzaSyAg4wuPWMxgDxGYUpxDT-2vAI34AjwvcQg",
    authDomain: "mypiggybanksave.firebaseapp.com",
    projectId: "mypiggybanksave",
    storageBucket: "mypiggybanksave.firebasestorage.app",
    messagingSenderId: "1081850835040",
    appId: "1:1081850835040:web:80eef2a1451af90b3b9305",
};

const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

// Privy Client Initialization
export const privy = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET);
