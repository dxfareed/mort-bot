import { createViemAccount } from '@privy-io/server-auth/viem';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { morphHolesky } from '../config/chains.js';
import { privy } from '../config/firebase.js';
import { sendMessage } from './whatsappService.js';
import { doc, setDoc, serverTimestamp, collection } from "firebase/firestore";
import { db } from "../config/firebase.js";
import dotenv from "dotenv";

dotenv.config();

const FUNDING_AMOUNT_ETH = '0.003';
const MORPH_RPC_URL = process.env.MORPH_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

export async function createWalletForUser(username) {
    try {
        console.log(" Creating wallet for user:", username);
        const { id, address, chainType } = await privy.walletApi.create({ chainType: 'ethereum' });
        console.log("✅ Wallet created successfully:", "ID:", id, "Address:", address);
        return { walletId: id, address: address, chainType: chainType };
    } catch (error) {
        console.error("❌ Error creating wallet:", error);
        throw error;
    }
}

export async function fundUser(recipientAddress, recipientPhoneNumber, amount = FUNDING_AMOUNT_ETH) {
    if (!PRIVATE_KEY || PRIVATE_KEY === "your_faucet_private_key_here") {
        console.error("❌ Faucet private key is not set or is a placeholder. Cannot fund user.");
        return;
    }
    try {
        console.log(`ℹ️ Funding user: ${recipientAddress} with ${amount} ETH.`);
        const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);
        const client = createWalletClient({ account, chain: morphHolesky, transport: http(MORPH_RPC_URL) });
        
        const txHash = await client.sendTransaction({
            to: recipientAddress,
            value: parseEther(amount),
        });

        console.log(`✅ Successfully sent ${amount} ETH to ${recipientAddress}. Tx hash: ${txHash}`);
        await sendMessage(recipientPhoneNumber, `We've sent you *${amount} ETH* on the Morph Holesky testnet!`);
        
        const fundingRef = doc(collection(db, 'fundingTransactions'));
        await setDoc(fundingRef, {
            to: recipientAddress,
            from: account.address,
            amount: amount,
            txHash: txHash,
            timestamp: serverTimestamp(),
            recipientPhoneNumber: recipientPhoneNumber
        });
    } catch (error) {
        console.error(`❌ Error funding user ${recipientAddress}:`, error);
        await sendMessage(recipientPhoneNumber, "Sorry, there was an error trying to fund your account from the faucet.");
    }
}
