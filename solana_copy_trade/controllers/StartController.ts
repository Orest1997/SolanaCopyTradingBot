import TelegramBot from "node-telegram-bot-api";

import WalletController from "./WalletController";
import CopyTradeController from "./CopyTradeController";

const handleInitialCommand = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId) => {
  botInstance.sendMessage(chatId, `⚙️ Welcome To CopyTrading Bot. \n\n🍏 Solana's fastest bot to copy trade any coin, and official Telegram trading bot. \n _________________________________________ \n 💡 If you aren't already, we advise that you create or import wallets`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `💰 Trading Wallets 💰`, callback_data: `start_wallets` }
          ],
          [
            { text: `📈 Copy Trade 📈`, callback_data: `start_copytrade` }
          ],
          [
            { text: `❔ Help`, callback_data: `start_help` }
          ]
        ]
      }
    }
  );
}

const handleCallbackQuery = async (botInstance: TelegramBot, queryData: TelegramBot.CallbackQuery) => {
  if (!queryData.message) {
    console.log('no queryData.message');
    return;
  }
  const chatId = queryData.message.chat.id;
  const data = queryData.data;

  if (!data) {
    console.log('no queryData.data');
    return;
  }

  if (data.startsWith('start_wallets')) {
    WalletController.handleInitialCommand(botInstance, chatId);
  } else if (data.startsWith('start_copytrade')) {
    CopyTradeController.handleInitialCommand(botInstance, chatId);
  } else if (data.startsWith('start_help')) {
    sendHelpMessage(botInstance, chatId);
  } else if (data == 'none') {
    return;
  } else {
    botInstance.sendMessage(chatId, `🍏You selected:\n ${data}\n you are ${chatId}`);
  }
}

const sendHelpMessage = (botInstance: TelegramBot, chatId: TelegramBot.ChatId) => {
  botInstance.sendMessage(chatId, '🍏List of available commands:\n\n/wallets - Manage wallets\n/copytrade - Manage Copy tradings\n/help - Show help');
}

export default {
  handleInitialCommand,
  handleCallbackQuery,
  sendHelpMessage
}