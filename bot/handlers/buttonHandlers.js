import { sendGamesMenu, sendWalletMenu } from "../services/whatsappService.js";
import { handleSendCrypto, handleReceiveCrypto, handleViewBalance } from "./walletHandlers.js";
import { handleStartFlipGame, handleFlipChoice, handleStartRpsGame, handleRpsChoice, handleStartRanmiGame } from "./gameHandlers.js";

export async function handleButtonSelection(userPhoneNumber, buttonId, user) {
    switch (buttonId) {
        case "games_option": await sendGamesMenu(userPhoneNumber, user); break;
        case "wallet_option": await sendWalletMenu(userPhoneNumber, user); break;
        case "send_crypto": await handleSendCrypto(userPhoneNumber, user); break;
        case "receive_crypto": await handleReceiveCrypto(userPhoneNumber, user); break;
        case "view_balance": await handleViewBalance(userPhoneNumber, user); break;
        case "flip_it": await handleStartFlipGame(userPhoneNumber, user); break;
        case "flip_choice_heads": await handleFlipChoice(userPhoneNumber, user, 0); break;
        case "flip_choice_tails": await handleFlipChoice(userPhoneNumber, user, 1); break;
        case "rock_paper_scissors": await handleStartRpsGame(userPhoneNumber, user); break;
        case "rps_choice_rock": await handleRpsChoice(userPhoneNumber, user, 0); break;
        case "rps_choice_paper": await handleRpsChoice(userPhoneNumber, user, 1); break;
        case "rps_choice_scissor": await handleRpsChoice(userPhoneNumber, user, 2); break;
        case "ranmi_game": await handleStartRanmiGame(userPhoneNumber, user); break;
    }
}
