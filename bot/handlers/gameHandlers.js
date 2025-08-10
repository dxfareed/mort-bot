import { sendMessage, sendTransactionSuccessMessage, sendGamesMenu, sendGameAmountMenu, sendStartFlipGameMenu, sendStartRpsGameMenu, sendStartRanmiGameMenu } from "../services/whatsappService.js";
import { userStates } from "../index.js";
import { getUserFromDatabase } from "../services/databaseService.js";
import { createViemAccount } from '@privy-io/server-auth/viem';
import { createWalletClient, http, parseEther, decodeEventLog, createPublicClient } from 'viem';
import { morphHolesky } from '../config/chains.js';
import { privy } from '../config/firebase.js';
import { db } from "../config/firebase.js";
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import bcrypt from "bcrypt";
import { createRequire } from 'module';
import { config } from '../config/index.js';

const require = createRequire(import.meta.url);

const flipGameAbi = require('../abi/flipGameAbi.json');
const rpsGameAbi = require('../abi/rpsGameAbi.json');
const ranmiGameAbi = require('../abi/ranmiGameAbi.json');

export async function handleStartFlipGame(to, user) {
    await sendStartFlipGameMenu(to);
}

export async function handleFlipChoice(phone, user, choice) {
    userStates.set(phone, { type: 'awaiting_flip_amount', user, choice });
    const choiceText = choice === 0 ? "Heads" : "Tails";
    await sendGameAmountMenu(phone, choiceText, 'flip');
}

export async function handleFlipAmountSelection(phone, amount, state) {
    const { user, choice } = state;
    await sendMessage(phone, ` Confirm Flip\n\n Choice: ${choice === 0 ? 'Heads' : 'Tails'}\n Bet: ${amount} ETH\n\nEnter your PIN:`);
    userStates.set(phone, { type: 'awaiting_pin_for_flip', user, flip: { amount, choice } });
}

export async function handlePinForFlip(phone, pin, state) {
    const { user, flip } = state;
    try {
        if (!(await bcrypt.compare(pin, user.security.hashedPin))) {
            userStates.delete(phone);
            await sendMessage(phone, "❌ Incorrect PIN. Game cancelled.");
            setTimeout(() => sendGamesMenu(phone, user), 1500);
            return;
        }
        await sendMessage(phone, "✅ PIN verified. Placing your bet...");
        const result = await executeFlipTransaction(user, flip.choice, flip.amount);
        if (result.success) {
            await sendTransactionSuccessMessage(phone, result.hash, " Bet Placed!");
            await sendMessage(phone, "Please wait a moment while we determine the result on-chain... ⏳");
        } else {
            await sendMessage(phone, `❌ Bet failed. ${result.error || "Check balance and try again."}`);
        }
    } catch (e) {
        await sendMessage(phone, "❌ Bet failed due to a network or balance issue.");
    } finally {
        userStates.delete(phone);
    }
}

async function executeFlipTransaction(user, choice, amount) {
    try {
        const account = await createViemAccount({ walletId: user.wallet.walletId, address: user.wallet.primaryAddress, privy });
        const walletClient = createWalletClient({ account, chain: morphHolesky, transport: http(config.morphRpcUrl) });
        const publicClient = createPublicClient({ chain: morphHolesky, transport: http(config.morphRpcUrl) });
        const hash = await walletClient.writeContract({ address: config.flipGameAddress, abi: flipGameAbi, functionName: 'flip', args: [choice], value: parseEther(amount.toString()) });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== config.flipGameAddress.toLowerCase()) continue;
            try {
                const decodedEvent = decodeEventLog({ abi: flipGameAbi, data: log.data, topics: log.topics });
                if (decodedEvent.eventName === 'FlipInitiated') {
                    await setDoc(doc(db, 'flips', decodedEvent.args.gameId.toString()), { whatsappId: user.whatsappId, username: user.username, betAmount: amount, choice, status: 'pending', requestTimestamp: serverTimestamp(), txHash: hash });
                    return { success: true, hash };
                }
            } catch (e) { console.warn("Could not decode a log from the game contract:", e.message); }
        }
        return { success: false, error: 'Could not confirm request ID on-chain.' };
    } catch (e) {
        console.error("Flip TX Error:", e);
        throw e;
    }
}

export async function handleStartRpsGame(to, user) {
    await sendStartRpsGameMenu(to);
}

export async function handleRpsChoice(phone, user, choice) {
    userStates.set(phone, { type: 'awaiting_rps_amount', user, choice });
    const choiceMap = ['✊ Rock', '✋ Paper', '✌️ Scissor'];
    await sendGameAmountMenu(phone, choiceMap[choice], 'rps');
}

export async function handleRpsAmountSelection(phone, amount, state) {
    const { user, choice } = state;
    const choiceMap = ['Rock', 'Paper', 'Scissor'];
    await sendMessage(phone, ` Confirm Game\n\n Choice: ${choiceMap[choice]}\n Bet: ${amount} ETH\n\nEnter your PIN:`);
    userStates.set(phone, { type: 'awaiting_pin_for_rps', user, rps: { amount, choice } });
}

export async function handlePinForRps(phone, pin, state) {
    const { user, rps } = state;
    try {
        if (!(await bcrypt.compare(pin, user.security.hashedPin))) {
            userStates.delete(phone);
            await sendMessage(phone, "❌ Incorrect PIN. Game cancelled.");
            setTimeout(() => sendGamesMenu(phone, user), 1500);
            return;
        }
        await sendMessage(phone, "✅ PIN verified. Placing your bet...");
        const result = await executeRpsTransaction(user, rps.choice, rps.amount);
        if (result.success) {
            await sendTransactionSuccessMessage(phone, result.hash, " Bet Placed!");
            await sendMessage(phone, "Please wait a moment while we determine the result on-chain... ⏳");
        } else {
            await sendMessage(phone, `❌ Bet failed. ${result.error || "Check balance and try again."}`);
        }
    } catch (e) {
        await sendMessage(phone, "❌ Bet failed due to a network or balance issue.");
    } finally {
        userStates.delete(phone);
    }
}

async function executeRpsTransaction(user, choice, amount) {
    try {
        const account = await createViemAccount({ walletId: user.wallet.walletId, address: user.wallet.primaryAddress, privy });
        const walletClient = createWalletClient({ account, chain: morphHolesky, transport: http(config.morphRpcUrl) });
        const publicClient = createPublicClient({ chain: morphHolesky, transport: http(config.morphRpcUrl) });
        const hash = await walletClient.writeContract({ address: config.rpsGameAddress, abi: rpsGameAbi, functionName: 'play', args: [choice], value: parseEther(amount.toString()) });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== config.rpsGameAddress.toLowerCase()) continue;
            try {
                const decodedEvent = decodeEventLog({ abi: rpsGameAbi, data: log.data, topics: log.topics });
                if (decodedEvent.eventName === 'GamePlayed') {
                    await setDoc(doc(db, 'rps_games', decodedEvent.args.gameId.toString()), {
                        whatsappId: user.whatsappId, username: user.username, betAmount: amount, choice, status: 'pending', requestTimestamp: serverTimestamp(), txHash: hash
                    });
                    return { success: true, hash };
                }
            } catch (e) { console.warn("Could not decode a log from the RPS contract:", e.message); }
        }
        return { success: false, error: 'Could not confirm RPS request ID on-chain.' };
    } catch (e) {
        console.error("RPS TX Error:", e);
        throw e;
    }
}

export async function handleStartRanmiGame(to, user) {
    await sendStartRanmiGameMenu(to);
    userStates.set(to, { type: 'awaiting_ranmi_amount', user });
}

export async function handleRanmiAmountSelection(phone, amount, state) {
    const { user } = state;
    await sendMessage(phone, ` *Confirm Bet*\n\n Bet: ${amount} ETH\n\nTo start the game and see your numbers, please enter your PIN:`);
    userStates.set(phone, { type: 'awaiting_pin_for_ranmi_play', user, betAmount: amount });
}

export async function handlePinForRanmiPlay(phone, pin, state) {
    const { user, betAmount } = state;
    try {
        if (!(await bcrypt.compare(pin, user.security.hashedPin))) {
            userStates.delete(phone);
            await sendMessage(phone, "❌ Incorrect PIN. Game cancelled.");
            setTimeout(() => sendGamesMenu(phone, user), 1500);
            return;
        }
        await sendMessage(phone, "✅ PIN verified. Drawing your lucky numbers now...");
        const result = await executeRanmiPlay(user, betAmount);
        if (result.success) {
            await sendMessage(phone, ` Game started! We'll send your 5 numbers in just a moment.`);
        } else {
            await sendMessage(phone, `❌ Game could not be started. ${result.error || "Please try again."}`);
        }
    } catch (e) {
        await sendMessage(phone, "❌ Game failed due to a network or balance issue.");
    } finally {
        userStates.delete(phone);
    }
}

async function executeRanmiPlay(user, amount) {
    try {
        const account = await createViemAccount({ walletId: user.wallet.walletId, address: user.wallet.primaryAddress, privy });
        const walletClient = createWalletClient({ account, chain: morphHolesky, transport: http(config.morphRpcUrl) });
        const publicClient = createPublicClient({ chain: morphHolesky, transport: http(config.morphRpcUrl) });
        const hash = await walletClient.writeContract({ address: config.ranmiGameAddress, abi: ranmiGameAbi, functionName: 'play', value: parseEther(amount.toString()) });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== config.ranmiGameAddress.toLowerCase()) continue;
            try {
                const decodedEvent = decodeEventLog({ abi: ranmiGameAbi, data: log.data, topics: log.topics });
                if (decodedEvent.eventName === 'GameStarted') {
                    await setDoc(doc(db, 'ranmi_games', decodedEvent.args.id.toString()), {
                        whatsappId: user.whatsappId, username: user.username, betAmount: amount, status: 'pending', requestTimestamp: serverTimestamp(), txHash: hash
                    });
                    return { success: true };
                }
            } catch (e) { console.warn("Could not decode Ranmi log:", e.message); }
        }
        return { success: false, error: 'Could not confirm game start ID on-chain.' };
    } catch (e) {
        console.error("Ranmi Play TX Error:", e);
        throw e;
    }
}

export async function sendRanmiGuessMenu(to, id, numbers) {
    const numbersText = numbers.map(n => `*${n.toString()}*`).join('   ');
    const message = `Here are your numbers! \n\n${numbersText}\n\nWhich one do you think is the lucky one? Just *type the number* you want to guess.`;

    await sendMessage(to, message);
    userStates.set(to, { type: 'awaiting_ranmi_guess', id: id.toString(), drawnNumbers: numbers });
}

export async function handleRanmiGuessInput(phone, text, state) {
    const user = await getUserFromDatabase(phone);
    if (!user) {
        userStates.delete(phone);
        return;
    }

    const { id, drawnNumbers } = state;
    const guessedNumber = text.trim();

    const drawnNumbersAsStrings = drawnNumbers.map(n => n.toString());

    if (!drawnNumbersAsStrings.includes(guessedNumber)) {
        await sendMessage(phone, `❌ That's not one of your numbers. Please pick one of these:\n\n${drawnNumbersAsStrings.join(', ')}`);
        return;
    }

    const guessIndex = drawnNumbersAsStrings.indexOf(guessedNumber);

    await sendMessage(phone, ` *Confirm Guess*\n\n You picked the number: *${guessedNumber}*\n\nEnter your PIN to lock in your guess.`);
    userStates.set(phone, { type: 'awaiting_pin_for_ranmi_guess', user, id, guessIndex });
}

export async function handlePinForRanmiGuess(phone, pin, state) {
    const { user, id, guessIndex } = state;
    try {
        if (!(await bcrypt.compare(pin, user.security.hashedPin))) {
            userStates.delete(phone);
            await sendMessage(phone, "❌ Incorrect PIN. Your guess was not submitted.");

            const gameDoc = await getDoc(doc(db, 'ranmi_games', id));
            if (gameDoc.exists()) {
                const gameData = gameDoc.data();
                setTimeout(() => sendRanmiGuessMenu(phone, id, gameData.drawnNumbers), 1500);
            }
            return;
        }
        await sendMessage(phone, "✅ PIN verified. Submitting your final guess...");
        const result = await executeRanmiGuess(user, id, guessIndex);
        if (result.success) {
            await sendMessage(phone, `✅ Your guess has been submitted! We'll notify you of the result shortly.`);
        } else {
            await sendMessage(phone, `❌ Could not submit your guess. ${result.error || "Please try again."}`);
        }
    } catch (e) {
        await sendMessage(phone, "❌ Guess submission failed due to a network or balance issue.");
    } finally {
        userStates.delete(phone);
    }
}

async function executeRanmiGuess(user, id, guessIndex) {
    try {
        const account = await createViemAccount({ walletId: user.wallet.walletId, address: user.wallet.primaryAddress, privy });
        const walletClient = createWalletClient({ account, chain: morphHolesky, transport: http(config.morphRpcUrl) });
        const hash = await walletClient.writeContract({ address: config.ranmiGameAddress, abi: ranmiGameAbi, functionName: 'makeGuess', args: [BigInt(id), Number(guessIndex)] });

        await updateDoc(doc(db, 'ranmi_games', id.toString()), { guessTxHash: hash, status: 'guessed', guessIndex });
        return { success: true };
    } catch (e) {
        console.error("Ranmi Guess TX Error:", e);
        throw e;
    }
}