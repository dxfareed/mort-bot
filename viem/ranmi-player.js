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
import ranmiGameAbi from './ranmiGameAbi.json' with { type: 'json' };

const morphHoleskyUrl = process.env.MORPH_RPC_URL;
const playerPrivateKey = process.env.RELAYER_PRIVATE_KEY;

const ranmiGameAddress = "0x6Ad4548EE077821908cD9591168A2636F54498D2";
const BET_AMOUNT = "0.0001";
const PLAYER_GUESS_INDEX = 0; // Always guess the first number (index 0)

const outcomeMap = { 0: 'You WON! 🎉', 1: 'You LOST. 😢' };

async function playRanmiGame() {
    console.log("--- Ranmi Player Script ---");
    if (!morphHoleskyUrl || !playerPrivateKey) throw new Error("Missing config in .env file.");

    const account = privateKeyToAccount(`0x${playerPrivateKey.replace(/^0x/, '')}`);
    const publicClient = createPublicClient({ chain: morphHolesky, transport: http(morphHoleskyUrl) });
    const walletClient = createWalletClient({ account, chain: morphHolesky, transport: http(morphHoleskyUrl) });

    console.log(`
Player Address: ${account.address}`);
    console.log(`Network: ${morphHolesky.name}`);

    try {
        // --- STEP 1: Start the game ---
        console.log("\n--- Pre-Game State ---");
        const initialBalance = await publicClient.getBalance({ address: account.address });
        console.log(`👤 Your Initial Balance: ${formatEther(initialBalance)} ETH`);
        console.log(`💰 Bet Amount:           ${BET_AMOUNT} ETH`);

        console.log("\n[ACTION] Calling play() to start the game...");
        const txHash = await walletClient.writeContract({
            address: ranmiGameAddress,
            abi: ranmiGameAbi,
            functionName: 'play',
            value: parseEther(BET_AMOUNT)
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') throw new Error("Play transaction failed.");

        let gameId;
        for (const log of receipt.logs) {
            try {
                const decodedEvent = decodeEventLog({ abi: ranmiGameAbi, ...log });
                if (decodedEvent.eventName === 'GameStarted') {
                    gameId = decodedEvent.args.id;
                    break;
                }
            } catch {}
        }
        if (!gameId) throw new Error("Could not find 'GameStarted' event.");

        console.log(`[SUCCESS] Game started! Your Game ID is: ${gameId}`);
        console.log("\n[WAITING] Waiting for the relayer to deliver numbers...");

        // --- STEP 2: Wait for the numbers from the relayer ---
        const numbers = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                unwatch();
                reject(new Error("Timeout: Relayer did not deliver numbers within 5 minutes."));
            }, 300000);

            const unwatch = publicClient.watchContractEvent({
                address: ranmiGameAddress,
                abi: ranmiGameAbi,
                eventName: 'GameReady',
                onLogs: (logs) => {
                    for (const log of logs) {
                        const event = log.args;
                        if (event.id === gameId) {
                            clearTimeout(timeout);
                            unwatch();
                            console.log("\n--- ✅ Numbers Received ---");
                            console.log(`  - Your Numbers: [${event.numbers.join(', ')}]`);
                            resolve(event.numbers);
                            break; 
                        }
                    }
                },
                onError: reject
            });
        });

        // --- STEP 3: Make a guess ---
        console.log(`
[ACTION] Making a guess...`);
        console.log(`  - You are guessing index: ${PLAYER_GUESS_INDEX} (Number: ${numbers[PLAYER_GUESS_INDEX]})`);
        
        const guessTxHash = await walletClient.writeContract({
            address: ranmiGameAddress,
            abi: ranmiGameAbi,
            functionName: 'makeGuess',
            args: [gameId, PLAYER_GUESS_INDEX]
        });

        const guessReceipt = await publicClient.waitForTransactionReceipt({ hash: guessTxHash });
        if (guessReceipt.status !== 'success') throw new Error("Guess transaction failed.");
        
        console.log("[SUCCESS] Guess submitted!");

        // --- STEP 4: Parse the final result from the transaction receipt ---
        let result;
        for (const log of guessReceipt.logs) {
            try {
                const decodedEvent = decodeEventLog({ abi: ranmiGameAbi, ...log });
                if (decodedEvent.eventName === 'GameResult') {
                    result = decodedEvent.args;
                    break;
                }
            } catch {}
        }

        if (!result) throw new Error("Could not find 'GameResult' event in the transaction receipt.");

        console.log("\n--- ✅ FINAL RESULT ---");
        console.log(`  - You Chose Index:    ${result.guessIndex}`);
        console.log(`  - Winning Index Was:  ${result.winningIndex}`);
        console.log(`  - Result:             ${outcomeMap[result.outcome]}`);
        console.log(`  - Prize:              ${formatEther(result.prize)} ETH`);

        console.log("\n--- Post-Game State ---");
        const finalBalance = await publicClient.getBalance({ address: account.address });
        console.log(`👤 Your Final Balance: ${formatEther(finalBalance)} ETH`);

    } catch (error) {
        console.error("\n--- ❌ SCRIPT ERROR ---");
        console.error(error);
        process.exit(1);
    }
}

playRanmiGame();
