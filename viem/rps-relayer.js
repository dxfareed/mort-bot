import { createPublicClient, createWalletClient, http, webSocket } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { morphHolesky } from "./chains.js";
import 'dotenv/config';
import rpsGameAbi from './rpsGameAbi.json' with { type: 'json' };
import vrfRequesterAbi from './vrfRequesterAbi.json' with { type: 'json' };

console.log("🚀 Starting VIEM RPS Cross-Chain Relayer...");

const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;

// Morph (Game) contract
const morphHttpUrl = process.env.MORPH_RPC_URL;
const rpsGameAddress = "0xfE5338B161b3B02FC03CF854F91bdC7A353061C0";

// Base Sepolia (VRF) contract
const baseSepoliaHttpUrl = process.env.ETHEREUM_RPC_URL;
const baseSepoliaWssUrl = process.env.ETHEREUM_WSS_URL;
const vrfRequesterAddress = "0x7EEFC42b510dF33097a8AC5EFE9533494ABcA78B";

const relayerAccount = privateKeyToAccount(`0x${relayerPrivateKey.replace(/^0x/, '')}`);

// Morph client for interacting with the RPS game
const morphPublicClient = createPublicClient({ chain: morphHolesky, transport: http(morphHttpUrl) });
const morphWalletClient = createWalletClient({ account: relayerAccount, chain: morphHolesky, transport: http(morphHttpUrl) });

// Base client for interacting with the VRF
const baseSepoliaPublicClient = createPublicClient({ chain: baseSepolia, transport: webSocket(baseSepoliaWssUrl) });
const baseSepoliaWalletClient = createWalletClient({ account: relayerAccount, chain: baseSepolia, transport: http(baseSepoliaHttpUrl) });

// LISTENER 1: Watch for new RPS games on Morph
function listenForGamesOnMorph() {
    console.log(`👂 Listening for 'GamePlayed' events on Morph (RPS)...`);
    morphPublicClient.watchContractEvent({
        address: rpsGameAddress,
        abi: rpsGameAbi,
        eventName: 'GamePlayed',
        pollingInterval: 5000,
        onLogs: async (logs) => {
            for (const log of logs) {
                const { gameId, player } = log.args;
                console.log(`\n✅ [MORPH EVENT] RPS GamePlayed`);
                console.log(`  - Game ID: ${gameId}`);
                console.log(`  - Player:  ${player}`);
                await requestRandomnessOnBase(gameId);
            }
        },
        onError: (error) => console.error("❌ Morph Listener Error:", error)
    });
}

// ACTION 1: Request randomness on Base Sepolia for the game
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

// LISTENER 2: Watch for the VRF result on Base Sepolia
function listenForResultsOnBase() {
    console.log(`👂 Listening for 'RandomnessFulfilled' events on Base Sepolia (RPS)...`);
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
        onError: (error) => {
            console.error("❌ Base Listener Error:", error.name);
            if (error.name === 'SocketClosedError') {
                console.log("🔌 WebSocket closed. Attempting to reconnect in 5 seconds...");
                setTimeout(listenForResultsOnBase, 5000);
            }
        }
    });
}

// ACTION 2: Settle the RPS game on Morph
async function settleGameOnMorph(gameId, randomNumber) {
    console.log(`  -> [MORPH ACTION] Settling RPS Game ID ${gameId}`);
    try {
        const txHash = await morphWalletClient.writeContract({
            address: rpsGameAddress,
            abi: rpsGameAbi,
            functionName: 'settleGame',
            args: [gameId, randomNumber]
        });
        console.log(`  -> [MORPH SUCCESS] RPS Game settled. Tx: ${txHash}`);
    } catch (error) {
        console.error(`  -> [MORPH ERROR]`, error.message);
    }
}

function main() {
    console.log(`RPS Relayer Address: ${relayerAccount.address}`);
    console.log("---------------------------------------");
    listenForGamesOnMorph();
    listenForResultsOnBase();
}

main();