import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = [
    'WHATSAPP_TOKEN',
    'PHONE_NUMBER_ID',
    'WHATSAPP_HOOK_TOKEN',
    'FLIP_GAME_CONTRACT_ADDRESS',
    'RPS_GAME_CONTRACT_ADDRESS',
    'RANMI_GAME_CONTRACT_ADDRESS',
    'VRF_REQUESTER_FLIP_RPS_ADDRESS',
    'VRF_REQUESTER_RANMI_ADDRESS',
    'MORPH_RPC_URL',
    'BASE_RPC_URL',
    'BASE_RPC_WSS_URL',
    'PRIVATE_KEY',
    'PORT'
];

for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}. Please check your .env file.`);
    }
}

export const config = {
    whatsappToken: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.PHONE_NUMBER_ID,
    webhookVerifyToken: process.env.WHATSAPP_HOOK_TOKEN,
    flipGameAddress: process.env.FLIP_GAME_CONTRACT_ADDRESS,
    rpsGameAddress: process.env.RPS_GAME_CONTRACT_ADDRESS,
    ranmiGameAddress: process.env.RANMI_GAME_CONTRACT_ADDRESS,
    vrfFlipRpsAddress: process.env.VRF_REQUESTER_FLIP_RPS_ADDRESS,
    vrfRanmiAddress: process.env.VRF_REQUESTER_RANMI_ADDRESS,
    morphRpcUrl: process.env.MORPH_RPC_URL,
    baseRpcUrl: process.env.BASE_RPC_URL,
    baseWssUrl: process.env.BASE_RPC_WSS_URL,
    privateKey: process.env.PRIVATE_KEY,
    port: process.env.PORT,
    graphApiUrl: `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`
};
