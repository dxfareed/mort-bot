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
import flipGameAbi from './flipGameAbi.json' with { type: 'json' };

const morphHoleskyUrl = process.env.MORPH_RPC_URL;
const playerPrivateKey = process.env.RELAYER_PRIVATE_KEY;

const flipGameAddress = "0x8A768deEC38363C60477A7046FD4e3236b98a3b0";
const vrfRequesterAddress = "0x7EEFC42b510dF33097a8AC5EFE9533494ABcA78B";

const BET_AMOUNT = "0.0001";
const PLAYER_CHOICE = 1;

async function playGameWithViem() {
    console.log("--- Player Script: Full Game Report ---");
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
        console.log(`🤔 Your Choice:          ${PLAYER_CHOICE === 0 ? 'Heads' : 'Tails'}`);

        // --- PHASE 2: INITIATE FLIP ---
        console.log("\n[ACTION] Calling flip()...");
        const txHash = await walletClient.writeContract({
            address: flipGameAddress,
            abi: flipGameAbi,
            functionName: 'flip',
            args: [PLAYER_CHOICE],
            value: parseEther(BET_AMOUNT)
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') throw new Error("Transaction failed on-chain.");

        //console.log("\n--- Debugging Events ---");
        //console.log(`Found ${receipt.logs.length} logs in the transaction receipt.`);
        let gameId;
        for (const log of receipt.logs) {
            try {
                const decodedEvent = decodeEventLog({ abi: flipGameAbi, ...log });
                console.log(`- Decoded event: ${decodedEvent.eventName}`, decodedEvent.args);
                if (decodedEvent.eventName === 'FlipInitiated') {
                    gameId = decodedEvent.args.gameId;
                    // console.log(`   -> Found FlipInitiated! Game ID: ${gameId}`);
                    break;
                }
            } catch (e) {
                console.log("- Could not decode an event. Details:", {
                    address: log.address,
                    topics: log.topics,
                    data: log.data,
                });
            }
        }
        //console.log("--- End Debugging ---");

        if (!gameId) throw new Error("Could not find 'FlipInitiated' event.");

        console.log(`[SUCCESS] Game initiated! Your Game ID is: ${gameId}`);
        console.log("\n[WAITING] Waiting for the relayer to settle the game... (This can take a few minutes)");

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                unwatch();
                reject(new Error("Timeout: Game not settled within 5 minutes."));
            }, 300000);

            const unwatch = publicClient.watchContractEvent({
                address: flipGameAddress,
                abi: flipGameAbi,
                eventName: 'FlipSettled',
                args: { gameId, player: account.address },
                onLogs: async (logs) => {
                    clearTimeout(timeout);
                    unwatch();
                    const event = logs[0].args;

                    console.log("\n--- ✅ FINAL RESULT RECEIVED ---");
                    console.log(`  - Game ID: ${event.gameId}`);
                    console.log(`  - Result:  You ${event.won ? 'WON! 🎉' : 'lost. 😢'}`);
                    console.log(`  - Payout:  ${formatEther(event.payout)} ETH`);

                    console.log("\n--- Post-Game State ---");
                    const finalBalance = await publicClient.getBalance({ address: account.address });
                    const houseBalance = await publicClient.readContract({
                        address: flipGameAddress,
                        abi: flipGameAbi,
                        functionName: 'getHouseBalance'
                    });

                    console.log(`👤 Your Final Balance:   ${formatEther(finalBalance)} ETH`);
                    console.log(`🏠 House Balance:        ${formatEther(houseBalance)} ETH`);

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

playGameWithViem();
