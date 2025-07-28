import { createPublicClient, createWalletClient, http, webSocket } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { morphHolesky } from "./chains.js";
import 'dotenv/config';
import flipGameAbi from './flipGameAbi.json' with { type: 'json' };
import vrfRequesterAbi from './vrfRequesterAbi.json' with { type: 'json' };

console.log("🚀 Starting VIEM Cross-Chain Relayer...");

const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;

const morphHttpUrl = process.env.MORPH_RPC_URL;
const flipGameAddress = "0xD34b14F2ee84904066e69b04777bb533a2AfD7b7";

const baseSepoliaHttpUrl = process.env.ETHEREUM_RPC_URL;
const baseSepoliaWssUrl = process.env.ETHEREUM_WSS_URL;
const vrfRequesterAddress = "0x8143650847AC9dDd8a560F41b5f5Cd39bd991536";

const relayerAccount = privateKeyToAccount(`0x${relayerPrivateKey.replace(/^0x/, '')}`);

const morphPublicClient = createPublicClient({ chain: morphHolesky, transport: http(morphHttpUrl) });
const morphWalletClient = createWalletClient({ account: relayerAccount, chain: morphHolesky, transport: http(morphHttpUrl) });

const baseSepoliaPublicClient = createPublicClient({ chain: baseSepolia, transport: webSocket(baseSepoliaWssUrl) });
const baseSepoliaWalletClient = createWalletClient({ account: relayerAccount, chain: baseSepolia, transport: http(baseSepoliaHttpUrl) });

// LISTENER 1: Watch for new bets on Morph via HTTP Polling.
function listenForBetsOnMorph() {
    console.log(`👂 Listening for 'FlipInitiated' events on Morph (via HTTP Polling)...`);
    morphPublicClient.watchContractEvent({
        address: flipGameAddress,
        abi: flipGameAbi,
        eventName: 'FlipInitiated',
        pollingInterval: 5000, // Check for new events every 5 seconds.
        onLogs: async (logs) => {
            for (const log of logs) {
                const { gameId, player } = log.args;
                console.log(`\n✅ [MORPH EVENT] FlipInitiated`);
                console.log(`  - Game ID: ${gameId}`);
                console.log(`  - Player:  ${player}`);
                await requestRandomnessOnBase(gameId);
            }
        },
        onError: (error) => console.error("❌ Morph Listener Error:", error)
    });
}

// ACTION 1: Request randomness on Base Sepolia.
 
async function requestRandomnessOnBase(gameId) {
    console.log(`  -> [BASE ACTION] Requesting randomness for Game ID ${gameId}`);
    try {
        const txHash = await baseSepoliaWalletClient.writeContract({
            address: vrfRequesterAddress,
            abi: vrfRequesterAbi,
            functionName: 'requestRandomness',
            args: [gameId]
        });
        console.log(`  -> [BASE SUCCESS] VRF request sent. Tx: ${txHash}`);
    } catch (error) {
        console.error(`  -> [BASE ERROR]`, error.message);
    }
}


 // LISTENER 2: Watch for VRF results on Base Sepolia via WebSocket.
 
function listenForResultsOnBase() {
    console.log(`👂 Listening for 'RandomnessFulfilled' events on Base Sepolia (via WebSocket)...`);
    baseSepoliaPublicClient.watchContractEvent({
        address: vrfRequesterAddress,
        abi: vrfRequesterAbi,
        eventName: 'RandomnessFulfilled',
        onLogs: async (logs) => {
            for (const log of logs) {
                const { gameId, randomWords } = log.args;
                const randomNumber = randomWords[0];
                console.log(`\n🎲 [BASE EVENT] RandomnessFulfilled`);
                console.log(`  - Game ID: ${gameId}`);
                console.log(`  - Random Word: ${randomNumber}`);
                await settleGameOnMorph(gameId, randomNumber);
            }
        },
        onError: (error) => console.error("❌ Base Listener Error:", error)
    });
}


//  ACTION 2: Settle the game on Morph.

async function settleGameOnMorph(gameId, randomNumber) {
    console.log(`  -> [MORPH ACTION] Settling Game ID ${gameId}`);
    try {
        const txHash = await morphWalletClient.writeContract({
            address: flipGameAddress,
            abi: flipGameAbi,
            functionName: 'settleFlip',
            args: [gameId, randomNumber]
        });
        console.log(`  -> [MORPH SUCCESS] Game settled. Tx: ${txHash}`);
    } catch (error) {
        console.error(`  -> [MORPH ERROR]`, error.message);
    }
}

function main() {
    console.log(`Relayer Address: ${relayerAccount.address}`);
    console.log("---------------------------------------");
    listenForBetsOnMorph();
    listenForResultsOnBase();
}

main();