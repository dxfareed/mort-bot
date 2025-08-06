import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase.js";

export async function getUserFromDatabase(whatsappId) {
    try {
        const userRef = doc(db, 'users', whatsappId);
        const userSnap = await getDoc(userRef);
        return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
    } catch (error) {
        console.error("❌ Error fetching user:", error);
        return null;
    }
}

export async function createUserInDatabase(userData) {
    try {
        const userRef = doc(db, 'users', userData.whatsappId);
        await setDoc(userRef, userData);
        const usernameRef = doc(db, 'usernames', userData.username.toLowerCase());
        await setDoc(usernameRef, { whatsappId: userData.whatsappId });
        console.log("✅ User created successfully:", userData.whatsappId);
        return true;
    } catch (error) {
        console.error("❌ Error creating user:", error);
        return false;
    }
}

export async function checkUsernameExists(username) {
    try {
        const usernameRef = doc(db, 'usernames', username);
        const usernameSnap = await getDoc(usernameRef);
        return usernameSnap.exists();
    } catch (error) {
        console.error("❌ Error checking username:", error);
        return true;
    }
}

export async function getUserByUsername(username) {
    try {
        const usernameRef = doc(db, 'usernames', username.toLowerCase());
        const usernameSnap = await getDoc(usernameRef);
        if (!usernameSnap.exists()) return null;
        const { whatsappId } = usernameSnap.data();
        return await getUserFromDatabase(whatsappId);
    } catch (error) {
        console.error("❌ Error fetching user by username:", error);
        return null;
    }
}

export async function updateUserLastSeen(whatsappId) {
    try {
        await updateDoc(doc(db, 'users', whatsappId), { lastSeen: serverTimestamp() });
    } catch (error) {
        console.error("❌ Error updating last seen:", error);
    }
}
