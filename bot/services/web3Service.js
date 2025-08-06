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

const FUNDING_AMOUNT_ETH = '0.001';
const MORPH_RPC_URL = process.env.MORPH_RPC_URL;
const FAUCET_PRIVATE_KEY = process.env.PRIVATE_KEY;

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

export async function fundNewUserWithPrivateKey(recipientAddress, recipientPhoneNumber) {
    if (!FAUCET_PRIVATE_KEY) {
        console.error("❌ Faucet private key is not set. Cannot fund new user.");
        return;
    }
    try {
        console.log(`ℹ️ Funding new user: ${recipientAddress} with ${FUNDING_AMOUNT_ETH} ETH.`);
        const account = privateKeyToAccount(`0x${FAUCET_PRIVATE_KEY}`);
        const client = createWalletClient({ account, chain: morphHolesky, transport: http(MORPH_RPC_URL) });
        
        const txHash = await client.sendTransaction({
            to: recipientAddress,
            value: parseEther(FUNDING_AMOUNT_ETH),
        });

        console.log(`✅ Successfully sent ${FUNDING_AMOUNT_ETH} ETH to ${recipientAddress}. Tx hash: ${txHash}`);
        await sendMessage(recipientPhoneNumber, ` We've sent you *${FUNDING_AMOUNT_ETH} ETH* on the Morph Holesky testnet to get you started!`);
        
        const fundingRef = doc(collection(db, 'fundingTransactions'));
        await setDoc(fundingRef, {
            to: recipientAddress,
            from: account.address,
            amount: FUNDING_AMOUNT_ETH,
            txHash: txHash,
            timestamp: serverTimestamp(),
            recipientPhoneNumber: recipientPhoneNumber
        });
    } catch (error) {
        console.error(`❌ Error funding new user ${recipientAddress}:`, error);
    }
}
