import { createPublicClient, createWalletClient, http, webSocket, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { morphHolesky } from '../config/chains.js';
import { baseSepolia } from 'viem/chains';
import { db } from '../config/firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { sendMessage, sendPostGameMenu } from './whatsappService.js';
import { sendRanmiGuessMenu } from '../handlers/gameHandlers.js';
import { createRequire } from 'module';
import { config } from '../config/index.js';

const require = createRequire(import.meta.url);

// ABIs
const flipGameAbi = require('../abi/flipGameAbi.json');
const rpsGameAbi = require('../abi/rpsGameAbi.json');
const ranmiGameAbi = require('../abi/ranmiGameAbi.json');
const vrfRequesterAbi = require('../abi/vrfRequesterAbi.json');
const vrfRanmiRequesterAbi = require('../abi/vrfRanmiRequesterAbi.json');

// Relayer Account
const relayerAccount = privateKeyToAccount(`0x${config.privateKey}`);

// Viem Clients
const morphPublicClient = createPublicClient({ chain: morphHolesky, transport: http(config.morphRpcUrl) });
const morphWalletClient = createWalletClient({ account: relayerAccount, chain: morphHolesky, transport: http(config.morphRpcUrl) });
const basePublicClient = createPublicClient({ chain: baseSepolia, transport: webSocket(config.baseWssUrl) });
const baseWalletClient = createWalletClient({ account: relayerAccount, chain: baseSepolia, transport: http(config.baseRpcUrl) });

// --- Settlement Logic ---

async function settleFlipGame(gameId, randomNumber) {
    console.log(`  -> [MORPH ACTION] Settling Flip Game ID ${gameId}`);
    try {
        const txHash = await morphWalletClient.writeContract({
            address: config.flipGameAddress,
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
            address: config.rpsGameAddress,
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
        const uniqueNumbers = new Set();
        let i = 0;
        // Use the random words to generate up to 5 unique numbers
        while (uniqueNumbers.size < 5 && i < randomWords.length) {
            const num = randomWords[i] % 100n;
            uniqueNumbers.add(num);
            i++;
        }

        // Fallback for the rare case where we don't get 5 unique numbers
        let lastNum = randomWords[randomWords.length - 1] % 100n;
        while (uniqueNumbers.size < 5) {
            lastNum = (lastNum + 1n) % 100n;
            uniqueNumbers.add(lastNum);
        }

        const numbers = Array.from(uniqueNumbers);
        const winningIndex = randomWords[5] % 5n;

        const txHash = await morphWalletClient.writeContract({
            address: config.ranmiGameAddress,
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
            address: config.vrfRanmiAddress,
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
        address: config.flipGameAddress, abi: flipGameAbi, eventName: 'FlipInitiated',
        onLogs: logs => logs.forEach(log => {
            console.log(`
✅ [MORPH EVENT] FlipInitiated`);
            console.log(`  - Game ID: ${log.args.gameId}`);
            requestRandomness(log.args.gameId, config.vrfFlipRpsAddress);
        }),
        onError: error => console.error("❌ Flip Listener Error:", error)
    });

    // Listener for RPS Game on Morph
    morphPublicClient.watchContractEvent({
        address: config.rpsGameAddress, abi: rpsGameAbi, eventName: 'GamePlayed',
        onLogs: logs => logs.forEach(log => {
            console.log(`
✅ [MORPH EVENT] RPS GamePlayed`);
            console.log(`  - Game ID: ${log.args.gameId}`);
            requestRandomness(log.args.gameId, config.vrfFlipRpsAddress);
        }),
        onError: error => console.error("❌ RPS Listener Error:", error)
    });

    // Listener for Ranmi Game on Morph
    morphPublicClient.watchContractEvent({
        address: config.ranmiGameAddress, abi: ranmiGameAbi, eventName: 'GameStarted',
        onLogs: logs => logs.forEach(log => {
            console.log(`
✅ [MORPH EVENT] Ranmi GameStarted`);
            console.log(`  - Game ID: ${log.args.id}`);
            requestRanmiNumbers(log.args.id);
        }),
        onError: error => console.error("❌ Ranmi Listener Error:", error)
    });

    // Listener for Ranmi Game Ready on Morph
    morphPublicClient.watchContractEvent({
        address: config.ranmiGameAddress, abi: ranmiGameAbi, eventName: 'GameReady',
        onLogs: logs => logs.forEach(async log => {
            const { id, numbers } = log.args;
            console.log(`
✅ [MORPH EVENT] Ranmi GameReady`);
            console.log(`  - Game ID: ${id}, Numbers: [${numbers.join(', ')}]`);

            const gameDocRef = doc(db, 'ranmi_games', id.toString());
            const gameDocSnap = await getDoc(gameDocRef);

            if (gameDocSnap.exists()) {
                const gameData = gameDocSnap.data();
                // Convert BigInts to Numbers for Firestore compatibility and save them
                const numbersForDb = numbers.map(n => Number(n));
                await updateDoc(gameDocRef, { drawnNumbers: numbersForDb, status: 'ready' });
                
                await sendRanmiGuessMenu(gameData.whatsappId, id, numbers);
            }
        }),
        onError: error => console.error("❌ Ranmi GameReady Listener Error:", error)
    });

    // Listener for Ranmi Game Settlement on Morph
    morphPublicClient.watchContractEvent({
        address: config.ranmiGameAddress, abi: ranmiGameAbi, eventName: 'GameResult',
        onLogs: logs => logs.forEach(async log => {
            const { id, outcome, guessIndex, winningIndex, prize } = log.args;
            console.log(`
✅ [MORPH EVENT] Ranmi GameResult`);
            console.log(`  - Game ID: ${id}, Outcome: ${outcome}`);

            const gameDocRef = doc(db, 'ranmi_games', id.toString());
            const gameDocSnap = await getDoc(gameDocRef);

            if (gameDocSnap.exists() && gameDocSnap.data().status === 'guessed') {
                const gameData = gameDocSnap.data();
                const prizeFormatted = formatEther(prize);
                const outcomeMap = ['You Win! 🎉', 'You Lose 😔'];
                const guessedNumber = gameData.drawnNumbers[guessIndex];
                const winningNumber = gameData.drawnNumbers[winningIndex];

                const messageBody = `*${outcomeMap[outcome]}*

You guessed *${guessedNumber}*.
The winning number was *${winningNumber}*.

${outcome === 0 ? `You won ${prizeFormatted} ETH!` : 'Better luck next time!'}`;
                
                await sendMessage(gameData.whatsappId, messageBody);
                await updateDoc(gameDocRef, { 
                    status: 'resolved', 
                    result: outcome === 0 ? 'Loss' : 'Win', 
                    prizeAmount: prizeFormatted, 
                    winningIndex,
                    resolvedTimestamp: serverTimestamp()
                });

                setTimeout(() => sendPostGameMenu(gameData.whatsappId), 2000);
            }
        }),
        onError: error => console.error("❌ Ranmi Settlement Listener Error:", error)
    });

    // Listener for Flip Game Settlement on Morph
    morphPublicClient.watchContractEvent({
        address: config.flipGameAddress, abi: flipGameAbi, eventName: 'FlipSettled',
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
                    result: won ? 'won' : 'lost', 
                    payoutAmount: payoutFormatted, 
                    resolvedTimestamp: serverTimestamp() 
                });
                
                // We can add user stats update here later if needed
                
                setTimeout(() => sendPostGameMenu(flipData.whatsappId), 2000);
            }
        }),
        onError: error => console.error("❌ Flip Settlement Listener Error:", error)
    });

    // Listener for RPS Game Settlement on Morph
    morphPublicClient.watchContractEvent({
        address: config.rpsGameAddress, abi: rpsGameAbi, eventName: 'GameResult',
        onLogs: logs => logs.forEach(async log => {
            const { gameId, outcome, playerChoice, computerChoice, prizeAmount } = log.args;
            console.log(`
✅ [MORPH EVENT] RPS GameResult`);
            console.log(`  - Game ID: ${gameId}, Outcome: ${outcome}`);

            const rpsDocRef = doc(db, 'rps_games', gameId.toString());
            const rpsDocSnap = await getDoc(rpsDocRef);

            if (rpsDocSnap.exists() && rpsDocSnap.data().status === 'pending') {
                const rpsData = rpsDocSnap.data();
                const prizeFormatted = formatEther(prizeAmount);
                const choiceMap = ['✊ Rock', '✋ Paper', '✌️ Scissor'];
                let messageBody;
                if (outcome === 0) { // WIN
                    messageBody = `*You Win! 🎉*\n\nYou chose ${choiceMap[playerChoice]}\nComputer chose ${choiceMap[computerChoice]}\n\nYou won ${prizeFormatted} ETH!`;
                } else if (outcome === 2) { // DRAW
                    messageBody = `*It's a Draw! 🤝*\n\nYou chose ${choiceMap[playerChoice]}\nComputer chose ${choiceMap[computerChoice]}\n\nYour bet of ${formatEther(rpsData.betAmount)} ETH was returned.`;
                } else { // LOSS
                    messageBody = `*You Lose 😔*\n\nYou chose ${choiceMap[playerChoice]}\nComputer chose ${choiceMap[computerChoice]}\n\nBetter luck next time!`;
                }
                
                await sendMessage(rpsData.whatsappId, messageBody);
                await updateDoc(rpsDocRef, { 
                    status: 'resolved', 
                    result: ['Win', 'Loss', 'Draw'][outcome], 
                    prizeAmount: prizeFormatted, 
                    resolvedTimestamp: serverTimestamp() 
                });

                setTimeout(() => sendPostGameMenu(rpsData.whatsappId), 2000);
            }
        }),
        onError: error => console.error("❌ RPS Settlement Listener Error:", error)
    });

    // Listener for Randomness on Base Sepolia (for Flip and RPS)
    basePublicClient.watchContractEvent({
        address: config.vrfFlipRpsAddress, abi: vrfRequesterAbi, eventName: 'RandomnessFulfilled',
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
        address: config.vrfRanmiAddress, abi: vrfRanmiRequesterAbi, eventName: 'RandomnessFulfilled',
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