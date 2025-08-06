import express from "express";
import { handleNewUserFlow } from "./userHandlers.js";
import { handleStatefulInput } from "./stateHandlers.js";
import { handleButtonSelection } from "./buttonHandlers.js";
import { sendNewUserWelcomeMessage, sendWelcomeBackMessage, sendGamesMenu, sendWalletMenu } from "../services/whatsappService.js";
import { getUserFromDatabase, updateUserLastSeen } from "../services/databaseService.js";
import { registrationStates } from "../index.js";

const router = express.Router();

const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_HOOK_TOKEN;

router.get("/", (req, res) => {
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];
    const token = req.query["hub.verify_token"];
    if (mode && token === WEBHOOK_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

router.post("/", async (req, res) => {
    try {
        const { entry } = req.body;
        if (!entry?.[0]?.changes?.[0]?.value?.messages) return res.sendStatus(200);
        const message = entry[0].changes[0].value.messages[0];
        const userPhoneNumber = message.from;
        const userText = message.text?.body;
        const buttonId = message.interactive?.button_reply?.id;
        const registrationState = registrationStates.get(userPhoneNumber);
        if (registrationState) {
            await handleNewUserFlow(userPhoneNumber, userText, registrationState);
            return res.sendStatus(200);
        }
        const userState = userStates.get(userPhoneNumber);
        if (userState) {
            await handleStatefulInput(userPhoneNumber, userText, buttonId, userState);
            return res.sendStatus(200);
        }
        const user = await getUserFromDatabase(userPhoneNumber);
        if (!user) {
            if (buttonId === 'create_account') {
                registrationStates.set(userPhoneNumber, { step: 'awaiting_username' });
                await sendMessage(userPhoneNumber, " Let's create your account!\n\nFirst, choose a unique username (3-20 characters, letters, numbers, and underscores only):");
            } else { await sendNewUserWelcomeMessage(userPhoneNumber); }
            return res.sendStatus(200);
        }
        await updateUserLastSeen(userPhoneNumber);
        if (buttonId) {
            await handleButtonSelection(userPhoneNumber, buttonId, user);
        } else if (userText) {
            const lowerCaseText = userText.toLowerCase();
            if (lowerCaseText === "/games" || lowerCaseText === "games") await sendGamesMenu(userPhoneNumber, user);
            else if (lowerCaseText === "/wallet" || lowerCaseText === "wallet") await sendWalletMenu(userPhoneNumber, user);
            else await sendWelcomeBackMessage(userPhoneNumber, user);
        }
        res.sendStatus(200);
    } catch (error) { console.error("❌ Error handling webhook:", error); res.sendStatus(500); }
});

export default router;
