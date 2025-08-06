import { sendMessage } from "../services/whatsappService.js";
import { userStates } from "../index.js";
import { getUserFromDatabase } from "../services/databaseService.js";
import { sendMainMenu } from "../services/whatsappService.js";
import { handleTransactionInput, handlePinForTransaction } from "./walletHandlers.js";
import { handleFlipAmountSelection, handlePinForFlip, handleRpsAmountSelection, handlePinForRps, handleRanmiAmountSelection, handlePinForRanmiPlay, handleRanmiGuessInput, handlePinForRanmiGuess } from "./gameHandlers.js";

export async function handleStatefulInput(userPhoneNumber, userText, buttonId, userState) {
    if (buttonId === 'cancel_operation') {
        userStates.delete(userPhoneNumber);
        await sendMessage(userPhoneNumber, "Action cancelled.");
        const user = await getUserFromDatabase(userPhoneNumber);
        if (user) setTimeout(() => sendMainMenu(userPhoneNumber, user), 1000);
        return;
    }
    const getAmountFromButton = (id) => id ? id.split('_')[id.split('_').length - 1] : null;

    if (userState.type === 'awaiting_transaction' && userText) await handleTransactionInput(userPhoneNumber, userText, userState.user);
    else if (userState.type === 'awaiting_pin_for_transaction' && userText) await handlePinForTransaction(userPhoneNumber, userText, userState);
    else if (userState.type === 'awaiting_flip_amount' && buttonId?.startsWith('flip_amount_')) await handleFlipAmountSelection(userPhoneNumber, getAmountFromButton(buttonId), userState);
    else if (userState.type === 'awaiting_pin_for_flip' && userText) await handlePinForFlip(userPhoneNumber, userText, userState);
    else if (userState.type === 'awaiting_rps_amount' && buttonId?.startsWith('rps_amount_')) await handleRpsAmountSelection(userPhoneNumber, getAmountFromButton(buttonId), userState);
    else if (userState.type === 'awaiting_pin_for_rps' && userText) await handlePinForRps(userPhoneNumber, userText, userState);
    else if (userState.type === 'awaiting_ranmi_amount' && buttonId?.startsWith('ranmi_amount_')) await handleRanmiAmountSelection(userPhoneNumber, getAmountFromButton(buttonId), userState);
    else if (userState.type === 'awaiting_pin_for_ranmi_play' && userText) await handlePinForRanmiPlay(userPhoneNumber, userText, userState);
    else if (userState.type === 'awaiting_ranmi_guess' && userText) await handleRanmiGuessInput(userPhoneNumber, userText, userState);
    else if (userState.type === 'awaiting_pin_for_ranmi_guess' && userText) await handlePinForRanmiGuess(userPhoneNumber, userText, userState);
    else await sendMessage(userPhoneNumber, "Please complete the current action first.");
}
