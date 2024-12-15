import TelegramBot, { Message } from 'node-telegram-bot-api';
import StartController from "./controllers/StartController";
import CopyTradeController from "./controllers/CopyTradeController";
import WalletController from "./controllers/WalletController";

import * as config from './config';
import { publicKey } from '@project-serum/anchor/dist/cjs/utils';
import { mockStorage } from '@metaplex-foundation/js';

const botInstance = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });

const init = () => {
  botInstance.setMyCommands(
    [
      { command: 'start', description: 'Start copy trade bot' },
      { command: 'wallets', description: 'Manage trading wallets' },
      { command: 'copytrade', description: 'Manage copy tradings' },
      { command: 'help', description: 'Show help' },
    ],
  ).catch((error) => {
    console.error('Error setting custom commands:', error);
  });

  botInstance.onText(/\/start/, startCommand);
  botInstance.onText(/\/wallets/, walletsCommand);
  botInstance.onText(/\/copytrade/, copyTradeCommand);
  botInstance.onText(/\/help/, helpCommand);

  botInstance.on('message', (msg) => {
    try {
      const chatId = msg.chat.id;
      const messageText = msg.text;

      if (msg.reply_to_message && msg.reply_to_message.text) {
        const repliedMessage = msg.reply_to_message.text;
        //wallet
        if (repliedMessage.startsWith("Enter trade name")) {
          CopyTradeController.handleAddName(botInstance, msg);
        } else if (repliedMessage.startsWith("Enter Private Key")) {
          WalletController.handlePrivateKey(botInstance, chatId, msg);
          // else
        } else if (repliedMessage.startsWith("Enter target wallet:")) {
          CopyTradeController.handleTargetWallet(botInstance, chatId, msg);
          // else
        } else if (repliedMessage.startsWith("Enter buy amount")) {
          CopyTradeController.handleBuyAmount(botInstance, msg);
        } else if (repliedMessage.startsWith("Enter sell amount")) {
          CopyTradeController.handleBuyAmount(botInstance, msg);
        } else if (repliedMessage.startsWith("Enter new buy amount:")) {
          CopyTradeController.handleNewBuyAmount(botInstance, chatId, msg);
        }  else if (repliedMessage.startsWith("Enter new sell amount:")) {
          CopyTradeController.handleNewSellAmount(botInstance, chatId, msg);
        } else if (repliedMessage.startsWith("Input 'Yes' if you want to really remove this trade ")) {
          CopyTradeController.handleRemoveTrade(botInstance, chatId, msg, repliedMessage.replace("Input 'Yes' if you want to really remove this trade ", ""));
        } else if (repliedMessage.startsWith('Input Yes if you want to remove this wallet: ')) {
          WalletController.handleRemove(botInstance, chatId, msg, repliedMessage.replace('Input Yes if you want to remove this wallet: ', ''));
        } else
          botInstance.sendMessage(chatId, `You replied to: "${repliedMessage}" with: "${messageText}"`);
      }
    } catch (error) {
      console.log(error)
    }
  });

  function startCommand(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    console.log(`chatId = ${chatId}, user name = ${msg.chat.username}, first name = ${msg.chat.first_name}, last name = ${msg.chat.last_name}`);
    StartController.handleInitialCommand(botInstance, chatId);
  }

  function walletsCommand(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    WalletController.handleInitialCommand(botInstance, chatId);
  }

  function copyTradeCommand(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    CopyTradeController.handleInitialCommand(botInstance, chatId);
  }

  function helpCommand(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    StartController.sendHelpMessage(botInstance, chatId);
  }

  botInstance.on('callback_query', (query) => {
    console.log('callback_query data = ', query.data);

    try {
      const chatId = query.message!.chat.id;
      const data = query.data;
      if (data!.startsWith('start_')) {
        StartController.handleCallbackQuery(botInstance, query);
      } else if (data!.startsWith('wallet_')) {
        WalletController.handleCallbackQuery(botInstance, chatId, data!, query);
      } else if (data!.startsWith('copytrade_')) {
        CopyTradeController.handleCallbackQuery(botInstance, chatId, data!, query);
      } else if (data!.startsWith('close_message')) {
        botInstance.deleteMessage(chatId, query.message!.message_id);
      }
    } catch (error) {
      console.log(error)
    }
  });
}

async function switchMenu(chatId: TelegramBot.ChatId, messageId: number | undefined, title: string, json_buttons: any) {
  const keyboard = {
    inline_keyboard: json_buttons,
    resize_keyboard: true,
    one_time_keyboard: true,
    force_reply: true
  };

  try {
    await botInstance.editMessageText(title, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, disable_web_page_preview: true, parse_mode: 'HTML' })
  } catch (error) {
    console.log(error)
  }
}

export { 
  botInstance,
  init,
  switchMenu
 };


