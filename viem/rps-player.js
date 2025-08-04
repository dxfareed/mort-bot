import {
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    formatEther,
    decodeEventLog
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { morphHolesky } from "./chains.js";
import 'dotenv/config';
import rpsGameAbi from './rpsGameAbi.json' with { type: 'json' };

const morphHoleskyUrl = process.env.MORPH_RPC_URL;
const playerPrivateKey = process.env.RELAYER_PRIVATE_KEY;

const rpsGameAddress = "0xfE5338B161b3B02FC03CF854F91bdC7A353061C0";

const BET_AMOUNT = "0.0001";
// 0 = Rock, 1 = Paper, 2 = Scissor
const PLAYER_CHOICE = 0; 

const choiceMap = { 0: 'Rock', 1: 'Paper', 2: 'Scissor' };
const outcomeMap = { 0: 'You WON! 🎉', 1: 'You LOST. 😢', 2: 'It\'s a DRAW. 🤝' };

async function playRpsGame() {
    console.log("--- RPS Player Script ---");
    if (!morphHoleskyUrl || !playerPrivateKey) throw new Error("Missing config in .env file.");

    const account = privateKeyToAccount(`0x${playerPrivateKey.replace(/^0x/, '')}`);
    const publicClient = createPublicClient({ chain: morphHolesky, transport: http(morphHoleskyUrl) });
    const walletClient = createWalletClient({ account, chain: morphHolesky, transport: http(morphHoleskyUrl) });

    console.log(`
Player Address: ${account.address}`);
    console.log(`Network: ${morphHolesky.name}`);

    try {
        // --- PHASE 1: PRE-GAME STATE ---
        console.log("\n--- Pre-Game State ---");
        const initialBalance = await publicClient.getBalance({ address: account.address });
        console.log(`👤 Your Initial Balance: ${formatEther(initialBalance)} ETH`);
        console.log(`💰 Bet Amount:           ${BET_AMOUNT} ETH`);
        console.log(`🤔 Your Choice:          ${choiceMap[PLAYER_CHOICE]}`);

        // --- PHASE 2: INITIATE GAME ---
        console.log("\n[ACTION] Calling play()...");
        const txHash = await walletClient.writeContract({
            address: rpsGameAddress,
            abi: rpsGameAbi,
            functionName: 'play',
            args: [PLAYER_CHOICE],
            value: parseEther(BET_AMOUNT)
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') throw new Error("Transaction failed on-chain.");

        let gameId;
        for (const log of receipt.logs) {
            try {
                const decodedEvent = decodeEventLog({ abi: rpsGameAbi, ...log });
                if (decodedEvent.eventName === 'GamePlayed') {
                    gameId = decodedEvent.args.gameId;
                    break;
                }
            } catch {} // Ignore errors during decoding, as not all logs will be relevant
        }
        if (!gameId) throw new Error("Could not find 'GamePlayed' event.");

        console.log(`[SUCCESS] Game initiated! Your Game ID is: ${gameId}`);
        console.log("\n[WAITING] Waiting for the relayer to settle the game...");

        // --- PHASE 3: AWAIT RESULT ---
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                unwatch();
                reject(new Error("Timeout: Game not settled within 5 minutes."));
            }, 300000);

            const unwatch = publicClient.watchContractEvent({
                address: rpsGameAddress,
                abi: rpsGameAbi,
                eventName: 'GameResult',
                args: { gameId, player: account.address },
                onLogs: async (logs) => {
                    clearTimeout(timeout);
                    unwatch();
                    const event = logs[0].args;

                    console.log("\n--- ✅ FINAL RESULT RECEIVED ---");
                    console.log(`  - Game ID: ${event.gameId}`);
                    console.log(`  - You Chose:      ${choiceMap[event.playerChoice]}`);
                    console.log(`  - Computer Chose: ${choiceMap[event.computerChoice]}`);
                    console.log(`  - Result:         ${outcomeMap[event.outcome]}`);
                    console.log(`  - Payout:         ${formatEther(event.prizeAmount)} ETH`);
                    
                    console.log("\n--- Post-Game State ---");
                    const finalBalance = await publicClient.getBalance({ address: account.address });
                    console.log(`👤 Your Final Balance: ${formatEther(finalBalance)} ETH`);
                    
                    resolve();
                },
                onError: reject
            });
        });

    } catch (error) {
        console.error("\n--- ❌ SCRIPT ERROR ---");
        console.error(error);
        process.exit(1);
    }
}

playRpsGame();
