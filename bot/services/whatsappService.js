import axios from "axios";
import { createPublicClient, http, formatEther } from 'viem';
import { morphHolesky } from '../config/chains.js';
import { fetchEthPrice } from '../utils/api.js';
import { getUserFromDatabase } from './databaseService.js';
import { config } from '../config/index.js';

async function sendApiRequest(data, logMessage) {
    try {
        await axios({
            url: config.graphApiUrl,
            method: "POST",
            headers: {
                Authorization: `Bearer ${config.whatsappToken}`,
                "Content-Type": "application/json"
            },
            data
        });
        if (logMessage) {
            console.log(logMessage);
        }
    } catch (error) {
        console.error(`❌ Error sending API request for ${logMessage}:`, error.response?.data || error.message);
    }
}

export async function sendMessage(to, body) {
    const data = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body, "preview_url": false }
    };
    await sendApiRequest(data, `✅ Simple message sent to: ${to}`);
}

export async function sendTransactionSuccessMessage(to, txHash, messageHeader) {
    await sendMessage(to, `${messageHeader}\n\n*Transaction Hash:*\n${txHash}`);
    const explorerUrl = `https://explorer-holesky.morphl2.io/tx/${txHash}`;
    const data = {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "cta_url",
            body: { text: "Click the button below to see your transaction on the explorer." },
            action: { name: "cta_url", parameters: { display_text: "View on Explorer", url: explorerUrl } }
        }
    };
    await sendApiRequest(data, `✅ Transaction success message sent to: ${to}`);
}

export async function sendNewUserWelcomeMessage(to) {
    const data = {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
            type: "button",
            header: { type: "text", text: "🚀 Welcome to Mort" },
            body: { text: "Hello! I'm Morty, your personal Web3 agent on WhatsApp.\n\nHere's what you can do:\n• 💸 Send & receive crypto\n• 🎮 Play on-chain games to earn\n• 🔐 Securely manage your wallet\n\nTap below to create your free, secure wallet in seconds." },
            footer: { text: "Secure • Fast • Easy" },
            action: { buttons: [{ type: "reply", reply: { id: "create_account", title: "Create Secure Wallet" } }] }
        }
    };
    await sendApiRequest(data, `✅ New user welcome message sent to: ${to}`);
}

export async function sendWelcomeBackMessage(to, user) {
    const data = {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
            type: "button",
            header: { type: "text", text: ` 👋 Welcome back, ${user.username}!` },
            body: { text: "What would you like to do next?" },
            footer: { text: "Powered by Morph" },
            action: { buttons: [{ type: "reply", reply: { id: "games_option", title: "🎮 Play Games" } }, { type: "reply", reply: { id: "wallet_option", title: "💰 Manage Wallet" } }] }
        }
    };
    await sendApiRequest(data, `✅ Welcome back message sent to: ${to}`);
}

export async function sendWalletMenu(to, user) {
    const data = {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
            type: "button",
            header: { type: "text", text: `💰 ${user.username}'s Wallet` },
            body: { text: `Your Wallet Address:\n${user.wallet.primaryAddress}\n\nWhat would you like to do?` },
            footer: { text: "Powered by Morph" },
            action: { buttons: [{ type: "reply", reply: { id: "send_crypto", title: "💸 Send" } }, { type: "reply", reply: { id: "receive_crypto", title: "📥 Receive" } }, { type: "reply", reply: { id: "view_balance", title: "📊 View Balance" } }] }
        }
    };
    await sendApiRequest(data, `✅ Wallet menu sent to: ${to}`);
}

export async function sendGamesMenu(to, user) {
    const data = {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
            type: "button",
            header: { type: "text", text: `🎮 ${user.username}'s Games` },
            body: { text: `Games Played: ${user.stats.gamesPlayed}\nChoose a game to play:` },
            footer: { text: "Powered by Morph" },
            action: { buttons: [{ type: "reply", reply: { id: "flip_it", title: "🎲 Flip It" } }, { type: "reply", reply: { id: "rock_paper_scissors", title: "✂️ Rock Paper Scissor" } }, { type: "reply", reply: { id: "ranmi_game", title: "🔮 Ranmi" } }] }
        }
    };
    await sendApiRequest(data, `✅ Games menu sent to: ${to}`);
}

export async function sendMainMenu(to, user) {
    const publicClient = createPublicClient({ chain: morphHolesky, transport: http(config.morphRpcUrl) });
    const balance = await publicClient.getBalance({ address: user.wallet.primaryAddress });
    const user_bal = Number(formatEther(balance)).toFixed(3);
    const ethPrice = await fetchEthPrice();
    const usdValue = ethPrice * parseFloat(user_bal);
    const data = {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
            type: "button",
            header: { type: "text", text: "Main Menu" },
            body: { text: `*Balance:* ${user_bal} ETH ($${usdValue.toFixed(2)})\n\nWhat would you like to do?` },
            footer: { text: "Powered by Morph" },
            action: { buttons: [
                { type: "reply", reply: { id: "games_option", title: "🎮 Play Games" } },
                { type: "reply", reply: { id: "wallet_option", title: "💰 Manage Wallet" } }
            ] }
        }
    };
    await sendApiRequest(data, `✅ Main menu sent to:  ${to}`);
}

export async function sendPostGameMenu(to) {
    const publicClient = createPublicClient({ chain: morphHolesky, transport: http(config.morphRpcUrl) });
    const user = await getUserFromDatabase(to);
    if (!user) return;
    const balance = await publicClient.getBalance({ address: user.wallet.primaryAddress });
    const balanceFormatted = Number(formatEther(balance)).toFixed(3);
    const data = {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
            type: "button",
            header: { type: "text", text: "Round Complete!" },
            body: { text: `*Balance:* ${balanceFormatted} ETH.\n\nWhat would you like to do next?` },
            footer: { text: "Powered by Morph" },
            action: { buttons: [
                { type: "reply", reply: { id: "games_option", title: "🎮 Play Again" } },
                { type: "reply", reply: { id: "wallet_option", title: "💰 Go to Wallet" } }
            ] }
        }
    };
    await sendApiRequest(data, `✅ Post-game menu sent to: ${to}`);
}

export async function sendGameAmountMenu(to, choiceText, gamePrefix) {
    const data = {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
            type: "button",
            header: { type: "text", text: `You Chose ${choiceText}` },
            body: { text: "How much ETH would you like to bet? " },
            footer: { text: "Powered by Morph" },
            action: { buttons: [{ type: "reply", reply: { id: `${gamePrefix}_amount_0.001`, title: "0.001 ETH" } }, { type: "reply", reply: { id: `${gamePrefix}_amount_0.01`, title: "0.01 ETH" } }, { type: "reply", reply: { id: `${gamePrefix}_amount_0.1`, title: "0.1 ETH" } }] }
        }
    };
    await sendApiRequest(data, `✅ Game amount menu sent to: ${to}`);
}

export async function sendStartFlipGameMenu(to) {
    const data = {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
            type: "button",
            header: { type: "text", text: "🎲 Flip It" },
            body: { text: "A simple, provably fair coin flip. Choose heads or tails to begin." },
            footer: { text: "Powered by Morph" },
            action: { buttons: [{ type: "reply", reply: { id: "flip_choice_heads", title: "🗿 Heads" } }, { type: "reply", reply: { id: "flip_choice_tails", title: "🪙 Tails" } }] }
        }
    };
    await sendApiRequest(data, `✅ Flip game start menu sent to: ${to}`);
}

export async function sendStartRpsGameMenu(to) {
    const data = {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
            type: "button",
            header: { type: "text", text: "✂️ Rock Paper Scissor" },
            body: { text: "Make your choice to begin!" },
            footer: { text: "Powered by Morph" },
            action: { buttons: [{ type: "reply", reply: { id: "rps_choice_rock", title: "✊ Rock" } }, { type: "reply", reply: { id: "rps_choice_paper", title: "✋ Paper" } }, { type: "reply", reply: { id: "rps_choice_scissor", title: "✌️ Scissor" } }] }
        }
    };
    await sendApiRequest(data, `✅ RPS game start menu sent to: ${to}`);
}

export async function sendStartRanmiGameMenu(to) {
    const data = {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
            type: "button",
            header: { type: "text", text: "🔮 Welcome to Ranmi!" },
            body: { text: "We'll generate 5 numbers for you. If you can guess the winning number, you win big!\n\nFirst, choose your bet amount." },
            footer: { text: "Powered by Morph" },
            action: {
                buttons: [
                    { type: "reply", reply: { id: "ranmi_amount_0.001", title: "0.001 ETH" } },
                    { type: "reply", reply: { id: "ranmi_amount_0.01", title: "0.01 ETH" } },
                    { type: "reply", reply: { id: "ranmi_amount_0.1", title: "0.1 ETH" } }
                ]
            }
        }
    };
    await sendApiRequest(data, `✅ Ranmi game start menu sent to: ${to}`);
}

export async function sendCryptoMenu(to) {
    const data = {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
            type: "button",
            body: { text: "💸 *Send Crypto*\nPlease enter the transaction details in one of these formats:\n\n`send [amount] to [address]`\n`send [amount] to [username]`" },
            footer: { text: "Powered by Morph" },
            action: { buttons: [{ type: "reply", reply: { id: "cancel_operation", title: "❌ Cancel" } }] }
        }
    };
    await sendApiRequest(data, `✅ Send crypto menu sent to: ${to}`);
}

export async function sendPinPrompt(to, amount, recipientIdentifier) {
    const bodyText = `🔐 *Confirm Transaction*\n\n*Amount:* ${amount} ETH\n*To:* ${recipientIdentifier}\n\nPlease enter your PIN to confirm.`;
    const data = {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
            type: "button",
            body: { text: bodyText },
            footer: { text: "Powered by Morph" },
            action: { buttons: [{ type: "reply", reply: { id: "cancel_operation", title: "❌ Cancel" } }] }
        }
    };
    await sendApiRequest(data, `✅ PIN prompt sent to: ${to}`);
}