import { createPublicClient, createWalletClient, http, webSocket, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { morphHolesky } from '../config/chains.js';
import { baseSepolia } from 'viem/chains';
import { db } from '../config/firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { sendMessage, sendPostGameMenu } from './whatsappService.js';
import { sendRanmiGuessMenu } from '../handlers/gameHandlers.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ABIs
const flipGameAbi = require('../abi/flipGameAbi.json');
const rpsGameAbi = require('../abi/rpsGameAbi.json');
const ranmiGameAbi = require('../abi/ranmiGameAbi.json');
const vrfRequesterAbi = require('../abi/vrfRequesterAbi.json');
const vrfRanmiRequesterAbi = require('../abi/vrfRanmiRequesterAbi.json');

// Environment Variables
const { 
    FLIP_GAME_CONTRACT_ADDRESS, RPS_GAME_CONTRACT_ADDRESS, RANMI_GAME_CONTRACT_ADDRESS,
    VRF_REQUESTER_FLIP_RPS_ADDRESS, VRF_REQUESTER_RANMI_ADDRESS,
    MORPH_RPC_URL, BASE_RPC_URL, BASE_RPC_WSS_URL, PRIVATE_KEY
} = process.env;

// Relayer Account
const relayerAccount = privateKeyToAccount(`0x${PRIVATE_KEY}`);

// Viem Clients
const morphPublicClient = createPublicClient({ chain: morphHolesky, transport: http(MORPH_RPC_URL) });
const morphWalletClient = createWalletClient({ account: relayerAccount, chain: morphHolesky, transport: http(MORPH_RPC_URL) });
const basePublicClient = createPublicClient({ chain: baseSepolia, transport: webSocket(BASE_RPC_WSS_URL) });
const baseWalletClient = createWalletClient({ account: relayerAccount, chain: baseSepolia, transport: http(BASE_RPC_URL) });

// --- Settlement Logic ---

async function settleFlipGame(gameId, randomNumber) {
    console.log(`  -> [MORPH ACTION] Settling Flip Game ID ${gameId}`);
    try {
        const txHash = await morphWalletClient.writeContract({
            address: FLIP_GAME_CONTRACT_ADDRESS,
            abi: flipGameAbi,
            functionName: 'settleFlip',
            args: [gameId, randomNumber]
        });
        console.log(`  -> [MORPH SUCCESS] Flip Game settled. Tx: ${txHash}`);
    } catch (error) {
        console.error(`  -> [MORPH ERROR] Settling Flip Game ID ${gameId}:`, error.message);
    }
}

async function settleRpsGame(gameId, randomNumber) {
    console.log(`  -> [MORPH ACTION] Settling RPS Game ID ${gameId}`);
    try {
        const txHash = await morphWalletClient.writeContract({
            address: RPS_GAME_CONTRACT_ADDRESS,
            abi: rpsGameAbi,
            functionName: 'settleGame',
            args: [gameId, randomNumber]
        });
        console.log(`  -> [MORPH SUCCESS] RPS Game settled. Tx: ${txHash}`);
    } catch (error) {
        console.error(`  -> [MORPH ERROR] Settling RPS Game ID ${gameId}:`, error.message);
    }
}

async function deliverRanmiNumbers(gameId, randomWords) {
    console.log(`  -> [MORPH ACTION] Delivering Ranmi numbers for Game ID ${gameId}`);
    try {
        const numbers = randomWords.slice(0, 5).map(word => word % 10n);
        const winningIndex = randomWords[5] % 5n;

        const txHash = await morphWalletClient.writeContract({
            address: RANMI_GAME_CONTRACT_ADDRESS,
            abi: ranmiGameAbi,
            functionName: 'deliverNumbers',
            args: [gameId, numbers, winningIndex]
        });
        console.log(`  -> [MORPH SUCCESS] Ranmi numbers delivered. Tx: ${txHash}`);
    } catch (error) {
        console.error(`  -> [MORPH ERROR] Delivering Ranmi numbers for Game ID ${gameId}:`, error.message);
    }
}

// --- Relayer Logic ---

async function requestRandomness(gameId, vrfContractAddress) {
    console.log(`  -> [BASE ACTION] Requesting randomness for Game ID ${gameId}`);
    try {
        const txHash = await baseWalletClient.writeContract({
            address: vrfContractAddress,
            abi: vrfRequesterAbi,
            functionName: 'requestRandomness',
            args: [gameId]
        });
        console.log(`  -> [BASE SUCCESS] VRF request sent. Tx: ${txHash}`);
    } catch (error) {
        console.error(`  -> [BASE ERROR] for Game ID ${gameId}:`, error.message);
    }
}

async function requestRanmiNumbers(gameId) {
    console.log(`  -> [BASE ACTION] Requesting Ranmi numbers for Game ID ${gameId}`);
    try {
        const txHash = await baseWalletClient.writeContract({
            address: VRF_REQUESTER_RANMI_ADDRESS,
            abi: vrfRanmiRequesterAbi,
            functionName: 'requestRanmiNumbers',
            args: [gameId]
        });
        console.log(`  -> [BASE SUCCESS] Ranmi numbers request sent. Tx: ${txHash}`);
    } catch (error) {
        console.error(`  -> [BASE ERROR] for Ranmi Game ID ${gameId}:`, error.message);
    }
}

// --- Blockchain Listeners ---

export function startRelayerService() {
    console.log("🚀 Starting Unified Relayer Service...");

    // Listener for Flip Game on Morph
    morphPublicClient.watchContractEvent({
        address: FLIP_GAME_CONTRACT_ADDRESS, abi: flipGameAbi, eventName: 'FlipInitiated',
        onLogs: logs => logs.forEach(log => {
            console.log(`
✅ [MORPH EVENT] FlipInitiated`);
            console.log(`  - Game ID: ${log.args.gameId}`);
            requestRandomness(log.args.gameId, VRF_REQUESTER_FLIP_RPS_ADDRESS);
        }),
        onError: error => console.error("❌ Flip Listener Error:", error)
    });

    // Listener for RPS Game on Morph
    morphPublicClient.watchContractEvent({
        address: RPS_GAME_CONTRACT_ADDRESS, abi: rpsGameAbi, eventName: 'GamePlayed',
        onLogs: logs => logs.forEach(log => {
            console.log(`
✅ [MORPH EVENT] RPS GamePlayed`);
            console.log(`  - Game ID: ${log.args.requestId}`);
            requestRandomness(log.args.requestId, VRF_REQUESTER_FLIP_RPS_ADDRESS);
        }),
        onError: error => console.error("❌ RPS Listener Error:", error)
    });

    // Listener for Ranmi Game on Morph
    morphPublicClient.watchContractEvent({
        address: RANMI_GAME_CONTRACT_ADDRESS, abi: ranmiGameAbi, eventName: 'GameStarted',
        onLogs: logs => logs.forEach(log => {
            console.log(`
✅ [MORPH EVENT] Ranmi GameStarted`);
            console.log(`  - Game ID: ${log.args.id}`);
            requestRanmiNumbers(log.args.id);
        }),
        onError: error => console.error("❌ Ranmi Listener Error:", error)
    });

    // Listener for Flip Game Settlement on Morph
    morphPublicClient.watchContractEvent({
        address: FLIP_GAME_CONTRACT_ADDRESS, abi: flipGameAbi, eventName: 'FlipSettled',
        onLogs: logs => logs.forEach(async log => {
            const { gameId, won, payout } = log.args;
            console.log(`
✅ [MORPH EVENT] FlipSettled`);
            console.log(`  - Game ID: ${gameId}, Won: ${won}, Payout: ${formatEther(payout)} ETH`);

            const flipDocRef = doc(db, 'flips', gameId.toString());
            const flipDocSnap = await getDoc(flipDocRef);

            if (flipDocSnap.exists() && flipDocSnap.data().status === 'pending') {
                const flipData = flipDocSnap.data();
                const payoutFormatted = formatEther(payout);
                const userChoice = flipData.choice;
                const userChoiceStr = userChoice === 0 ? 'Heads' : 'Tails';
                const actualResult = won ? userChoice : (1 - userChoice);
                const resultStr = actualResult === 0 ? '🗿 Heads' : '🪙 Tails';
                
                const messageBody = won 
                    ? `The coin landed on *${resultStr}*!\n\nYou chose *${userChoiceStr}* and WON! 🎉\n\nYou've received ${payoutFormatted} ETH.`
                    : `The coin landed on *${resultStr}*.\n\nYou chose *${userChoiceStr}* and lost.\nBetter luck next time!`;

                await sendMessage(flipData.whatsappId, messageBody);
                await updateDoc(flipDocRef, { 
                    status: 'resolved', 
                    result: won ? 'lost' : 'won', 
                    payoutAmount: payoutFormatted, 
                    resolvedTimestamp: serverTimestamp() 
                });
                
                // We can add user stats update here later if needed
                
                setTimeout(() => sendPostGameMenu(flipData.whatsappId), 2000);
            }
        }),
        onError: error => console.error("❌ Flip Settlement Listener Error:", error)
    });

    // Listener for Randomness on Base Sepolia (for Flip and RPS)
    basePublicClient.watchContractEvent({
        address: VRF_REQUESTER_FLIP_RPS_ADDRESS, abi: vrfRequesterAbi, eventName: 'RandomnessFulfilled',
        onLogs: logs => logs.forEach(async log => {
            const { gameId, randomWords } = log.args;
            console.log(`
🎲 [BASE EVENT] RandomnessFulfilled for Flip/RPS`);
            console.log(`  - Game ID: ${gameId}`);
            
            const flipDoc = await getDoc(doc(db, 'flips', gameId.toString()));
            if (flipDoc.exists()) {
                await settleFlipGame(gameId, randomWords[0]);
                return;
            }

            const rpsDoc = await getDoc(doc(db, 'rps_games', gameId.toString()));
            if (rpsDoc.exists()) {
                await settleRpsGame(gameId, randomWords[0]);
                return;
            }
        }),
        onError: error => console.error("❌ VRF Listener Error:", error)
    });
    
    // Listener for Randomness on Base Sepolia (for Ranmi)
    basePublicClient.watchContractEvent({
        address: VRF_REQUESTER_RANMI_ADDRESS, abi: vrfRanmiRequesterAbi, eventName: 'RandomnessFulfilled',
        onLogs: logs => logs.forEach(async log => {
            const { gameId, randomWords } = log.args;
            console.log(`
🎲 [BASE EVENT] Ranmi Numbers Fulfilled`);
            console.log(`  - Game ID: ${gameId}`);
            
            const ranmiDoc = await getDoc(doc(db, 'ranmi_games', gameId.toString()));
            if (ranmiDoc.exists()) {
                await deliverRanmiNumbers(gameId, randomWords);
            }
        }),
        onError: error => console.error("❌ Ranmi VRF Listener Error:", error)
    });
}
