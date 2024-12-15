
import { Keypair } from "@solana/web3.js";
import bs58 from 'bs58';
import Decimal from 'decimal.js';
import TelegramBot from "node-telegram-bot-api";

import { Wallet } from "../models/wallet";
import * as Solana from "../web3"
import * as config from "../config";
import StartController from "./StartController";
import { shortenAddress } from "../common_utils/utils";
import { switchMenu } from "../bot";

const getWalletBalanceButtons = async (chatId: TelegramBot.ChatId) => {
    let wallets = await Wallet.find({ chatId });
    if (wallets.length > 0) {
        let buttons: any = [];
        for (let i = 0; i < wallets.length; i++) {
            let balance = await Solana.getSolBalance(wallets[i].privateKey);
            let balanceMsg;
            if (balance > 0) {
                balanceMsg = `🟢 ${balance} SOL`;
            } else {
                balanceMsg = `🟠 ${balance} SOL`;
            }
            buttons.push(
                [
                    { text: `💰 ${shortenAddress(wallets[i].publicKey)}`, callback_data: `wallet_select_${wallets[i].publicKey}` },
                    { text: balanceMsg, callback_data: `wallet_select_${wallets[i].publicKey}` },
                    { text: '🗑️ Remove', callback_data: `wallet_remove_${wallets[i].publicKey}` },
                ]
            );
        }
        return buttons;
    } else {
        return null;
    }
}
const handleInitialCommand = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId) => {
    console.log('WalletController, handleInitialCommand');
    try {
        let buttons = await getWalletBalanceButtons(chatId);
        if (buttons) {

            botInstance.sendMessage(chatId, '🍏You have the following wallets. \n \n🟢 Sufficient balance. \t\t🟠 Insufficient balance.',
                {
                    reply_markup: {
                        inline_keyboard: [
                            ...buttons,
                            [
                                { text: '➕ Create Wallet', callback_data: 'wallet_create' },
                                { text: '⬇️ Import Wallet', callback_data: 'wallet_import' },

                            ],
                            [
                                { text: '🔙 Back to Start', callback_data: 'wallet_back' },
                                { text: '🔄 Update Balance', callback_data: 'wallet_update' },
                            ]

                        ]
                    }
                }
            );
        }
        else {

            botInstance.sendMessage(chatId, '🍏You currently have no wallet. Create a wallet to start using our services.', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '➕ Create Wallet', callback_data: 'wallet_create' },
                            { text: '⬇️ Import Wallet', callback_data: 'wallet_import' }
                        ]
                    ]
                }
            });
        }
    } catch (error) {
        console.log(error)
    }
}

const handleCallbackQuery = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId, queryData: string, query: any) => {
    if (queryData == 'wallet_create')
        handleCreateWallet(botInstance, chatId);
    else if (queryData == 'wallet_import')
        handleImportWallet(botInstance, chatId);
    else if (queryData == 'wallet_back')
        handleBack(botInstance, chatId);
    else if (queryData == 'wallet_update')
        handleUpdate(botInstance, chatId, query);
    else if (queryData.startsWith('wallet_remove_'))
        handleRemoveConfirm(botInstance, chatId, queryData.replace('wallet_remove_', ''));
    else if (queryData.startsWith('wallet_select_'))
        handleSelectWallet(botInstance, chatId, queryData.replace('wallet_select_', ''));
}

const handleSelectWallet = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId, publicKey: string) => {
    const wallet = await Wallet.findOne({ publicKey });
    if (wallet) {
        botInstance.sendMessage(chatId, `💰 PriviateKey\n<code>${wallet.privateKey}</code>(Tap to copy)`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Close', callback_data: 'close_message' }]
                ]
            },
            parse_mode: 'HTML'
        })
    }
}

const handleRemoveConfirm = (botInstance: TelegramBot, chatId: TelegramBot.ChatId, publicKey: string) => {
    botInstance.sendMessage(chatId, `Input Yes if you want to remove this wallet: ${publicKey}`, { reply_markup: { force_reply: true } });
}

export const handleRemove = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId, msg: TelegramBot.Message, publicKey: string) => {
    if (msg.text == "Yes") {
        const wallet = await Wallet.findOneAndDelete({ publicKey });
        if (wallet) {
            console.log(`Deleted item: ${wallet}`);
            handleInitialCommand(botInstance, chatId);
        } else {
            console.log(`No item found to delete`);
        }
    } else {
        botInstance.deleteMessage(chatId, msg.message_id);
    }
}

const handleUpdate = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId, query: TelegramBot.CallbackQuery) => {

    try {
        let messageId = query.message?.message_id;
        let title = "🍏You have the following wallets. \n \n🟢 Sufficient balance. \t\t🟠 Insufficient balance.";
        let buttons = await getWalletBalanceButtons(chatId);
        let inline_keyboard =
            [
                ...buttons,
                [
                    { text: '➕ Create Wallet', callback_data: 'wallet_create' },
                    { text: '⬇️ Import Wallet', callback_data: 'wallet_import' },

                ],
                [
                    { text: '🔙 Back to Start', callback_data: 'wallet_back' },
                    { text: '🔄 Update Balance', callback_data: 'wallet_update' },
                ]
            ]

        switchMenu(chatId, messageId, title, inline_keyboard);
    } catch (error) {
        console.log('updatebalance error');
    }
}

async function handleCreateWallet(botInstance: TelegramBot, chatId: TelegramBot.ChatId) {
    const { publicKey, privateKey } = Solana.createWallet();
    let newWallet = new Wallet({ chatId, publicKey, privateKey })
    await newWallet.save();
    handleInitialCommand(botInstance, chatId);
}

async function handleBack(botInstance: TelegramBot, chatId: TelegramBot.ChatId) {
    StartController.handleInitialCommand(botInstance, chatId);
}

async function handleImportWallet(botInstance: TelegramBot, chatId: TelegramBot.ChatId) {
    botInstance.sendMessage(chatId,
        `Enter Private Key`, {
        reply_markup: {
            force_reply: true
        }
    });
}

async function handlePrivateKey(botInstance: TelegramBot, chatId: TelegramBot.ChatId, msg: TelegramBot.Message) {
    try {
        const privateKey = msg.text;
        const publicKey = Solana.getPublicKey(privateKey!);
        const wallet = new Wallet({ chatId, publicKey, privateKey });
        await wallet.save();
        botInstance.deleteMessage(chatId, msg.message_id);
        handleInitialCommand(botInstance, chatId);
    } catch {
        botInstance.sendMessage(chatId, 'Invalid private key');
    }
}

export default {
    handleInitialCommand,
    handleCallbackQuery,
    handlePrivateKey,
    handleRemove
}