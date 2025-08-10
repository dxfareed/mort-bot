import { sendMessage, sendTransactionSuccessMessage, sendMainMenu, sendCryptoMenu, sendPinPrompt } from "../services/whatsappService.js";
import { userStates } from "../index.js";
import { getUserByUsername } from "../services/databaseService.js";
import { createViemAccount } from '@privy-io/server-auth/viem';
import { createWalletClient, http, parseEther, formatEther, createPublicClient } from 'viem';
import { morphHolesky } from '../config/chains.js';
import { privy } from '../config/firebase.js';
import { fetchEthPrice } from "../utils/api.js";
import bcrypt from "bcrypt";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase.js";
import { config } from '../config/index.js';
import { fundUser } from "../services/web3Service.js";

export async function handleSendCrypto(userPhoneNumber, user) {
    userStates.set(userPhoneNumber, { type: 'awaiting_transaction', user: user });
    await sendCryptoMenu(userPhoneNumber);
}

export async function handleReceiveCrypto(userPhoneNumber, user) {
    await sendMessage(userPhoneNumber, user.wallet.primaryAddress);
    await sendMessage(userPhoneNumber, ` Send ETH to this address on the Morph Holesky network.`);
    setTimeout(() => sendMainMenu(userPhoneNumber, user), 2000);
}

export async function handleViewBalance(userPhoneNumber, user) {
    try {
        const price = await fetchEthPrice();
        await sendMessage(userPhoneNumber, " Checking your balance...");
        const publicClient = createPublicClient({ chain: morphHolesky, transport: http(config.morphRpcUrl) });
        const balance = await publicClient.getBalance({ address: user.wallet.primaryAddress });
        const user_bal = Number(formatEther(balance));
        
        await sendMessage(userPhoneNumber, ` Wallet Balance\nETH: ${user_bal.toFixed(5)}
$${(user_bal * price).toFixed(2)}`);

        if (user_bal < 0.00001) {
            await sendMessage(userPhoneNumber, "Your balance is low. We're sending you some more ETH to keep you playing!");
            await fundUser(user.wallet.primaryAddress, userPhoneNumber);
        }

        setTimeout(() => sendMainMenu(userPhoneNumber, user), 2000);
    } catch (error) {
        console.error("❌ Error fetching balance:", error);
        await sendMessage(userPhoneNumber, "❌ Sorry, I couldn't fetch your balance right now.");
    }
}

export async function handleTransactionInput(userPhoneNumber, userText, user) {
    const regex = /send\s+([\d.]+)\s+to\s+(0x[a-fA-F0-9]{40}|[a-zA-Z0-9_]{3,20})/i;
    const match = userText.match(regex);
    if (!match) {
        await sendMessage(userPhoneNumber, "❌ Invalid format. Please use:\n`send [amount] to [address]` or\n`send [amount] to [username]`");
        return;
    }
    const [_, amount, recipient] = match;
    let toAddress;
    let recipientIdentifier = recipient;
    if (/^0x[a-fA-F0-9]{40}$/i.test(recipient)) {
        toAddress = recipient;
        if (toAddress.toLowerCase() === user.wallet.primaryAddress.toLowerCase()) {
            await sendMessage(userPhoneNumber, "❌ You cannot send crypto to yourself.");
            return;
        }
    } else {
        const recipientUser = await getUserByUsername(recipient);
        if (!recipientUser) {
            await sendMessage(userPhoneNumber, `❌ User "${recipient}" not found. Please check the username and try again.`);
            return;
        }
        if (recipientUser.whatsappId === userPhoneNumber) {
            await sendMessage(userPhoneNumber, "❌ You cannot send crypto to yourself.");
            return;
        }
        toAddress = recipientUser.wallet.primaryAddress;
        recipientIdentifier = `${recipientUser.username} (${toAddress.substring(0, 6)}...${toAddress.substring(38)})`;
    }
    userStates.set(userPhoneNumber, { type: 'awaiting_pin_for_transaction', user: user, transaction: { amount, toAddress } });
    await sendPinPrompt(userPhoneNumber, amount, recipientIdentifier);
}

export async function handlePinForTransaction(userPhoneNumber, enteredPin, userState) {
    const { user, transaction } = userState;
    const isValidPin = await bcrypt.compare(enteredPin, user.security.hashedPin);
    if (!isValidPin) {
        await sendMessage(userPhoneNumber, "❌ Incorrect PIN. Transaction cancelled.");
        userStates.delete(userPhoneNumber);
        setTimeout(() => sendMainMenu(userPhoneNumber, user), 1500);
        return;
    }
    await sendMessage(userPhoneNumber, "✅ PIN verified. Processing transaction...");
    try {
        const account = await createViemAccount({ walletId: user.wallet.walletId, address: user.wallet.primaryAddress, privy });
        const client = createWalletClient({ account, chain: morphHolesky, transport: http(config.morphRpcUrl) });
        const txHash = await client.sendTransaction({ to: transaction.toAddress, value: parseEther(transaction.amount) });
        await sendTransactionSuccessMessage(userPhoneNumber, txHash, " Transaction Successful!");
        await updateDoc(doc(db, 'users', userPhoneNumber), { 'stats.transactionCount': (user.stats.transactionCount || 0) + 1 });
    } catch (txError) {
        console.error("TX Error:", txError.message);
        await sendMessage(userPhoneNumber, "❌ Transaction failed. Please check your balance and try again.");
    }
    userStates.delete(userPhoneNumber);
    setTimeout(() => sendMainMenu(userPhoneNumber, user), 2000);
}
