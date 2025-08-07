import { sendMessage } from "../services/whatsappService.js";
import { checkUsernameExists, createUserInDatabase } from "../services/databaseService.js";
import { createWalletForUser, fundUser } from "../services/web3Service.js";
import { hashPin } from "../utils/security.js";
import { registrationStates } from "../index.js";
import { sendWelcomeBackMessage, sendNewUserWelcomeMessage } from "../services/whatsappService.js";

const REGISTRATION_STEPS = {
    AWAITING_USERNAME: 'awaiting_username',
    AWAITING_EMAIL: 'awaiting_email',
    AWAITING_PIN: 'awaiting_pin',
    CONFIRMING_PIN: 'confirming_pin'
};

export async function handleNewUserFlow(userPhoneNumber, userText, registrationState) {
    if (!userText) {
        await sendMessage(userPhoneNumber, "Please provide the requested information to continue.");
        return;
    }
    switch (registrationState.step) {
        case REGISTRATION_STEPS.AWAITING_USERNAME: await handleUsernameInput(userPhoneNumber, userText); break;
        case REGISTRATION_STEPS.AWAITING_EMAIL: await handleEmailInput(userPhoneNumber, userText); break;
        case REGISTRATION_STEPS.AWAITING_PIN: await handlePinInput(userPhoneNumber, userText); break;
        case REGISTRATION_STEPS.CONFIRMING_PIN: await handlePinConfirmation(userPhoneNumber, userText); break;
        default: registrationStates.delete(userPhoneNumber); await sendNewUserWelcomeMessage(userPhoneNumber);
    }
}

async function handleUsernameInput(userPhoneNumber, username) {
    if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        await sendMessage(userPhoneNumber, "❌ Invalid username (3-20 chars, letters, numbers, underscores).");
        return;
    }
    const usernameExists = await checkUsernameExists(username.toLowerCase());
    if (usernameExists) {
        await sendMessage(userPhoneNumber, "❌ This username is already taken. Please choose another one:");
        return;
    }
    const state = registrationStates.get(userPhoneNumber);
    state.username = username;
    state.step = REGISTRATION_STEPS.AWAITING_EMAIL;
    registrationStates.set(userPhoneNumber, state);
    await sendMessage(userPhoneNumber, `✅ Great! Username "${username}" is available.\n\nNow, please enter your email address:`);
}

async function handleEmailInput(userPhoneNumber, email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await sendMessage(userPhoneNumber, "❌ Please enter a valid email address:");
        return;
    }
    const state = registrationStates.get(userPhoneNumber);
    state.email = email;
    state.step = REGISTRATION_STEPS.AWAITING_PIN;
    registrationStates.set(userPhoneNumber, state);
    await sendMessage(userPhoneNumber, `✅ Email saved: ${email}\n\n Now, create a secure 4-6 digit transaction PIN.\nEnter your PIN:`);
}

async function handlePinInput(userPhoneNumber, pin) {
    if (!/^\d{4,6}$/.test(pin)) {
        await sendMessage(userPhoneNumber, "❌ PIN must be 4-6 digits only. Please try again:");
        return;
    }
    const state = registrationStates.get(userPhoneNumber);
    state.pin = pin;
    state.step = REGISTRATION_STEPS.CONFIRMING_PIN;
    registrationStates.set(userPhoneNumber, state);
    await sendMessage(userPhoneNumber, " Please confirm your PIN by entering it again:");
}

async function handlePinConfirmation(userPhoneNumber, confirmPin) {
    const state = registrationStates.get(userPhoneNumber);
    if (state.pin !== confirmPin) {
        state.step = REGISTRATION_STEPS.AWAITING_PIN;
        registrationStates.set(userPhoneNumber, state);
        await sendMessage(userPhoneNumber, "❌ PINs don't match. Please enter your 4-6 digit PIN again:");
        return;
    }
    try {
        await sendMessage(userPhoneNumber, " Creating your secure wallet...");
        const walletData = await createWalletForUser(state.username);
        const now = new Date().toISOString();
        const userData = { whatsappId: userPhoneNumber, username: state.username, email: state.email, security: { hashedPin: await hashPin(state.pin), pinSetAt: now }, wallet: { primaryAddress: walletData.address, walletId: walletData.walletId, chainType: walletData.chainType, balance: { ETH: "0" }, lastBalanceUpdate: now }, stats: { gamesPlayed: 0, totalEarned: "0", transactionCount: 0 }, createdAt: now, lastSeen: now };
        if (await createUserInDatabase(userData)) {
            registrationStates.delete(userPhoneNumber);
            await sendMessage(userPhoneNumber, ` Account created successfully!\n\n✅ Username: ${state.username}\n Wallet Address: ${walletData.address}\n\nWelcome to Mort!`);
            await fundUser(walletData.address, userPhoneNumber);
            setTimeout(async () => {
                const user = await getUserFromDatabase(userPhoneNumber);
                await sendWelcomeBackMessage(userPhoneNumber, user);
            }, 1000);
        } else {
            await sendMessage(userPhoneNumber, "❌ Error creating account.");
            registrationStates.delete(userPhoneNumber);
        }
    } catch (error) {
        console.error("❌ Error creating account:", error);
        await sendMessage(userPhoneNumber, "❌ Error creating your account.");
        registrationStates.delete(userPhoneNumber);
    }
}
