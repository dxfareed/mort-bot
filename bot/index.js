import express from "express";
import webhookHandler from "./handlers/webhookHandler.js";
import { startRelayerService } from "./services/relayerService.js";
import { config } from "./config/index.js";

const app = express();
app.use(express.json());

export const userStates = new Map();
export const registrationStates = new Map();

const PORT = config.port || 3000;

app.use("/webhook", webhookHandler);

app.listen(PORT, () => {
    console.log(`✅ Web3 ChatBot Server running on port ${PORT}`);
    startRelayerService();
});
