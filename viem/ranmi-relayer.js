import { createPublicClient, createWalletClient, http, webSocket } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { morphHolesky } from "./chains.js";
import 'dotenv/config';
import ranmiGameAbi from './ranmiGameAbi.json' with { type: 'json' };
import vrfRanmiRequesterAbi from './vrfRanmiRequesterAbi.json' with { type: 'json' };

console.log("🚀 Starting VIEM Ranmi Cross-Chain Relayer...");

const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;

// Morph (Game) contract
const morphHttpUrl = process.env.MORPH_RPC_URL;
const ranmiGameAddress = "0x6Ad4548EE077821908cD9591168A2636F54498D2";

// Base Sepolia (VRF) contract
const baseSepoliaHttpUrl = process.env.ETHEREUM_RPC_URL;
const baseSepoliaWssUrl = process.env.ETHEREUM_WSS_URL;
const vrfRequesterAddress = "0xE33bEEd4c1C1f5c07d6F3e3c68Ed2a60e7D15EA7";

const relayerAccount = privateKeyToAccount(`0x${relayerPrivateKey.replace(/^0x/, '')}`);

// Clients
const morphPublicClient = createPublicClient({ chain: morphHolesky, transport: http(morphHttpUrl) });
const morphWalletClient = createWalletClient({ account: relayerAccount, chain: morphHolesky, transport: http(morphHttpUrl) });
const baseSepoliaPublicClient = createPublicClient({ chain: baseSepolia, transport: webSocket(baseSepoliaWssUrl) });
const baseSepoliaWalletClient = createWalletClient({ account: relayerAccount, chain: baseSepolia, transport: http(baseSepoliaHttpUrl) });

// --- Listener 1: Watch for new Ranmi games on Morph ---
function listenForGamesOnMorph() {
    console.log(`👂 Listening for 'GameStarted' events on Morph (Ranmi)...`);
    morphPublicClient.watchContractEvent({
        address: ranmiGameAddress,
        abi: ranmiGameAbi,
        eventName: 'GameStarted',
        pollingInterval: 5000,
        onLogs: async (logs) => {
            for (const log of logs) {
                const { id, player } = log.args;
                console.log(`
✅ [MORPH EVENT] Ranmi GameStarted`);
                console.log(`  - Game ID: ${id}`);
                console.log(`  - Player:  ${player}`);
                await requestRandomnessOnBase(id);
            }
        },
        onError: (error) => console.error("❌ Morph Listener Error:", error)
    });
}

// --- Action 1: Request 6 random words from VRF on Base Sepolia ---
async function requestRandomnessOnBase(gameId) {
    console.log(`  -> [BASE ACTION] Requesting Ranmi numbers for Game ID ${gameId}`);
    try {
        const txHash = await baseSepoliaWalletClient.writeContract({
            address: vrfRequesterAddress,
            abi: vrfRanmiRequesterAbi,
            functionName: 'requestRanmiNumbers',
            args: [gameId]
        });
        console.log(`  -> [BASE SUCCESS] VRF request sent. Tx: ${txHash}`);
    } catch (error) {
        console.error(`  -> [BASE ERROR]`, error.message);
    }
}

// --- Listener 2: Watch for the VRF result on Base Sepolia ---
function listenForResultsOnBase() {
    console.log(`👂 Listening for 'RandomnessFulfilled' events on Base Sepolia (Ranmi)...`);
    let unwatch;

    const startListener = () => {
        unwatch = baseSepoliaPublicClient.watchContractEvent({
            address: vrfRequesterAddress,
            abi: vrfRanmiRequesterAbi,
            eventName: 'RandomnessFulfilled',
            onLogs: async (logs) => {
                for (const log of logs) {
                    const { gameId, randomWords } = log.args;
                    console.log(`
🎲 [BASE EVENT] RandomnessFulfilled for Ranmi`);
                    console.log(`  - Game ID: ${gameId}`);
                    console.log(`  - Random Words: ${randomWords.join(', ')}`);

                    // Process random words to fit the game's requirements
                    const numbers = randomWords.slice(0, 5).map(word => Number(word % 10n)); // 5 single-digit numbers
                    const winningIndex = Number(randomWords[5] % 5n); // Winning index between 0 and 4

                    console.log(`  - Processed Numbers: [${numbers.join(', ')}]`);
                    console.log(`  - Processed Winning Index: ${winningIndex}`);

                    await deliverNumbersToMorph(gameId, numbers, winningIndex);
                }
            },
            onError: (error) => {
                console.error("❌ Base Listener Error. The WebSocket connection may have been dropped.", error);
                console.log("🔌 Attempting to reconnect in 5 seconds...");
                if (unwatch) unwatch();
                setTimeout(startListener, 5000);
            }
        });
    };

    startListener();
}

// --- Action 2: Deliver the processed numbers to the Ranmi game on Morph ---
async function deliverNumbersToMorph(gameId, numbers, winningIndex) {
    console.log(`  -> [MORPH ACTION] Delivering numbers for Ranmi Game ID ${gameId}`);
    try {
        const txHash = await morphWalletClient.writeContract({
            address: ranmiGameAddress,
            abi: ranmiGameAbi,
            functionName: 'deliverNumbers',
            args: [gameId, numbers, winningIndex]
        });
        console.log(`  -> [MORPH SUCCESS] Ranmi numbers delivered. Tx: ${txHash}`);
    } catch (error) {
        console.error(`  -> [MORPH ERROR]`, error.message);
    }
}

function main() {
    console.log(`Ranmi Relayer Address: ${relayerAccount.address}`);
    console.log("---------------------------------------");
    listenForGamesOnMorph();
    listenForResultsOnBase();
}

main();
