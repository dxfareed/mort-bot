import express from "express";
import dotenv from "dotenv";
import webhookHandler from "./handlers/webhookHandler.js";
import { startRelayerService } from "./services/relayerService.js";

dotenv.config();

const app = express();
app.use(express.json());

export const userStates = new Map();
export const registrationStates = new Map();

const PORT = process.env.PORT || 3000;

app.use("/webhook", webhookHandler);

app.listen(PORT, () => {
    console.log(`✅ Web3 ChatBot Server running on port ${PORT}`);
    startRelayerService();
});
