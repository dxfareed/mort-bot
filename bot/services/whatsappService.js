import axios from "axios";
import dotenv from "dotenv";
import { createPublicClient, http, formatEther } from 'viem';
import { morphHolesky } from '../config/chains.js';
import { fetchEthPrice } from '../utils/api.js';
import { getUserFromDatabase } from './databaseService.js';

dotenv.config();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const MORPH_RPC_URL = process.env.MORPH_RPC_URL;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GRAPH_FACEBOOK_MESSAGE = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`

export async function sendMessage(to, body) {
    try {
        await axios({
            url: GRAPH_FACEBOOK_MESSAGE,
            method: "POST", headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            data: { messaging_product: "whatsapp", to, type: "text", text: { body, "preview_url": false } }
        });
    } catch (error) { console.error("❌ Error sending message:", error.response?.data || error.message); }
}

export async function sendTransactionSuccessMessage(to, txHash, messageHeader) {
    try {
        const explorerUrl = `https://explorer-holesky.morphl2.io/tx/${txHash}`;
        await sendMessage(to, `${messageHeader}\n\n*Transaction Hash:*\n${txHash}`);
        
        const data = {
            messaging_product: "whatsapp", to, type: "interactive",
            interactive: {
                type: "cta_url",
                body: { text: "Click the button below to see your transaction on the explorer." },
                action: { name: "cta_url", parameters: { display_text: "View on Explorer", url: explorerUrl } }
            }
        };

        await axios({
            url: GRAPH_FACEBOOK_MESSAGE,
            method: "POST", headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            data,
        });
    } catch (error) {
        console.error("❌ Error sending cta_url message:", error.response?.data || error.message);
        await sendMessage(to, `${messageHeader}\n\nView your transaction here:\nhttps://explorer-holesky.morphl2.io/tx/${txHash}`);
    }
}

export async function sendNewUserWelcomeMessage(to) {
    try {
        await axios({
            url: GRAPH_FACEBOOK_MESSAGE,
            method: "POST", headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            data: { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", header: { type: "text", text: " Welcome to Mort by Hot Coffee" }, body: { text: "Hello! I'm Morty, your Wallet Agent that enables you to:\n\n Send & receive crypto\n Play games and earn crypto\n Manage your digital wallet\n\nTo get started, you'll need to create your account. This will only take a minute!" }, footer: { text: "Secure • Fast • Easy" }, action: { buttons: [{ type: "reply", reply: { id: "create_account", title: " Create Account" } }] } } },
        });
        console.log("✅ New user welcome message sent to:", to);
    } catch (error) { console.error("❌ Error sending new user welcome message:", error.response?.data || error.message); }
}

export async function sendWelcomeBackMessage(to, user) {
    try {
        await axios({
            url: GRAPH_FACEBOOK_MESSAGE,
            method: "POST", headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            data: { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", header: { type: "text", text: ` Welcome back, ${user.username}!` }, body: { text: "Great to see you again! What would you like to do today?\n\n Play games and earn crypto\n Manage your wallet and transactions" }, footer: { text: "Choose an option to continue" }, action: { buttons: [{ type: "reply", reply: { id: "games_option", title: " Games" } }, { type: "reply", reply: { id: "wallet_option", title: " Wallet" } }] } } },
        });
        console.log("✅ Welcome back message sent to:", to);
    } catch (error) { console.error("❌ Error sending welcome back message:", error.response?.data || error.message); }
}

export async function sendWalletMenu(to, user) {
    try {
        await axios({
            url: GRAPH_FACEBOOK_MESSAGE,
            method: "POST", headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            data: { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", header: { type: "text", text: ` ${user.username}'s Wallet` }, body: { text: `Your Wallet Address:\n${user.wallet.primaryAddress}\n\nWhat would you like to do?` }, footer: { text: "Morph Holesky Network" }, action: { buttons: [{ type: "reply", reply: { id: "send_crypto", title: " Send Crypto" } }, { type: "reply", reply: { id: "receive_crypto", title: " Receive Crypto" } }, { type: "reply", reply: { id: "view_balance", title: " View Balance" } }] } } },
        });
        console.log("✅ Wallet menu sent to:", to);
    } catch (error) { console.error("❌ Error sending wallet menu:", error.response?.data || error.message); }
}

export async function sendGamesMenu(to, user) {
    try {
        await axios({
            url: GRAPH_FACEBOOK_MESSAGE,
            method: "POST", headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            data: { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", header: { type: "text", text: ` ${user.username}'s Games` }, body: { text: `Games Played: ${user.stats.gamesPlayed}\nChoose a game to play:` }, footer: { text: "Play • Earn • Have Fun" }, action: { buttons: [{ type: "reply", reply: { id: "flip_it", title: " Flip It" } }, { type: "reply", reply: { id: "rock_paper_scissors", title: "✂️ Rock Paper" } }, { type: "reply", reply: { id: "ranmi_game", title: " Ranmi" } }] } } },
        });
        console.log("✅ Games menu sent to:", to);
    } catch (error) { console.error("❌ Error sending games menu:", error.response?.data || error.message); }
}

export async function sendMainMenu(to, user) {
    try {
        const publicClient = createPublicClient({ chain: morphHolesky, transport: http(MORPH_RPC_URL) });
        const balance = await publicClient.getBalance({ address: user.wallet.primaryAddress });
        const user_bal = Number(formatEther(balance)).toFixed(3);
        const ethPrice = await fetchEthPrice();
        const usdValue = ethPrice * parseFloat(user_bal);
        await axios({
            url: GRAPH_FACEBOOK_MESSAGE,
            method: "POST", headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            data: { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", header: { type: "text", text: "What's Next?" }, body: { text: `Your current balance is\nETH: ${user_bal}\n${usdValue.toFixed(2)}\n\nChoose an option to continue.` }, footer: { text: "Mort by Hot Coffee" }, action: { buttons: [{ type: "reply", reply: { id: "games_option", title: " Games" } }, { type: "reply", reply: { id: "wallet_option", title: " Wallet" } }] } } },
        });
        console.log("✅ Main menu sent to:", to);
    } catch (error) { console.error("❌ Error sending main menu:", error.response?.data || error.message); }
}

export async function sendPostGameMenu(to) {
    try {
        const publicClient = createPublicClient({ chain: morphHolesky, transport: http(MORPH_RPC_URL) });
        const user = await getUserFromDatabase(to);
        if (!user) return;
        const balance = await publicClient.getBalance({ address: user.wallet.primaryAddress });
        const balanceFormatted = Number(formatEther(balance)).toFixed(3);
        const data = { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", header: { type: "text", text: "Round Complete!" }, body: { text: `Your current balance is  *${balanceFormatted} ETH*.\n\nWhat would you like to do next?` }, footer: { text: "Choose an option to continue" }, action: { buttons: [{ type: "reply", reply: { id: "games_option", title: " Play Again" } }, { type: "reply", reply: { id: "wallet_option", title: " Go to Wallet" } }] } } };
        await axios({
            url: GRAPH_FACEBOOK_MESSAGE,
            method: "POST", headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            data: data,
        });
        console.log("✅ Post-game menu sent to:", to);
    } catch (error) { console.error("❌ Error sending post-game menu:", error.response?.data || error.message); }
}
