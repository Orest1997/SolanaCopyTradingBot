import TelegramBot, { TelegramEvents } from "node-telegram-bot-api";
import { Wallet } from "../models/wallet";
import { Copytrade, ICopytrade } from "../models/copytrade";
import CopyTradeService from "../copyTradeService";
import { switchMenu } from "../bot";
import * as solana from "../web3";
import { isNumber, logger, sleep } from "../common_utils/utils";
import { TradeHistory } from "../models/tradehistory";
import { shortenAddress } from "../common_utils/utils";

let walletSelections: any = {};
let copytradeData: any = {};
let copytradeChangeData: any = {};

const handleInitialCommand = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId) => {
    try {
        const copytrades = await Copytrade.find({ chatId });
        let buttons = [];
        for (let i = 0; i < copytrades.length; i++) {
            buttons.push(
                [
                    { text: `${(i + 1) + "-" + copytrades[i].name}`, callback_data: `copytrade_sel_${copytrades[i]._id}` },
                    { text: `✏️ Edit`, callback_data: `copytrade_edit_${copytrades[i]._id}` },
                    { text: '🗑️ Remove', callback_data: `copytrade_remove_${copytrades[i]._id}` },
                ]
            );
        }
        if (buttons.length > 0) {
            botInstance.sendMessage(chatId,
                '\n🍏 Your Copy Trade List. You can add new trade and remove.', {
                reply_markup: {
                    inline_keyboard: [
                        ...buttons,
                        [
                            { text: '➕ New Copy Trade', callback_data: 'copytrade_new_create' },
                        ],
                    ]
                }
            });
        } else {
            botInstance.sendMessage(chatId,
                'No Copy trade, Please create new copy trade', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '➕ New Copy Trade', callback_data: 'copytrade_new_create' },
                        ],
                    ]
                }
            });
        }
    } catch (error) {
        console.log('error');
    }
}

const handleCallbackQuery = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId, queryData: string, query: TelegramBot.CallbackQuery) => {
    if (queryData == 'copytrade_walletlist')
        handleInitialCommand(botInstance, chatId);
    else if (queryData.startsWith('copytrade_select_'))
        handleSelectWallet(botInstance, chatId, queryData.replace('copytrade_select_', ''), query);
    else if (queryData.startsWith('copytrade_sel_'))
        handleSelectTrade(botInstance, chatId, queryData.replace('copytrade_sel_', ''), query);
    else if (queryData.startsWith('copytrade_remove_'))
        handleRemoveTradeConfirm(botInstance, chatId, queryData.replace('copytrade_remove_', ''), query);
    else if (queryData == 'copytrade_new_create')
        handleCreateNewTrade(botInstance, chatId);
    else if (queryData.startsWith('copytrade_mode_'))
        handleSelectMode(botInstance, chatId, queryData.replace('copytrade_mode_', ''), query);
    else if (queryData.startsWith('copytrade_edit_'))
        handleEditMode(botInstance, chatId, queryData.replace('copytrade_edit_', ''), query);
    else if (queryData.startsWith('copytrade_change_mode_'))
        handleChangeMode(botInstance, chatId, queryData.replace('copytrade_change_mode_', ''), query);
    else if (queryData.startsWith('copytrade_change_save'))
        handleChangeSave(botInstance, chatId, query);
    else if (queryData.startsWith('copytrade_change_buyamount'))
        handleChangeBuyAmount(botInstance, chatId, query);
    else if (queryData.startsWith('copytrade_change_sellamount'))
        handleChangeSellAmount(botInstance, chatId, query);
    else
        botInstance.sendMessage(chatId, `Copytrade command: ${queryData}`);
}

const handleNewBuyAmount = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId, msg: TelegramBot.Message) => {
    const amount = msg.text;
    if (!isNumber(amount)) {
        botInstance.sendMessage(chatId, 'Invalid number');
        return;
    }
    if (copytradeChangeData[Number(chatId)]) {
        copytradeChangeData[Number(chatId)]['buyAmount'] = amount;
        const buttons = getChangeButtons(chatId);
        let message = 'You can change setting of copy trade. You have to set buy/sell amount in proportional mode. \n \n🟢 Select \t\t🟠 Deselect';
        botInstance.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: buttons!
            }
        })
    }
}

const handleNewSellAmount = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId, msg: TelegramBot.Message) => {
    const amount = msg.text;
    if (!isNumber(amount)) {
        botInstance.sendMessage(chatId, 'Invalid number');
        return;
    }
    if (copytradeChangeData[Number(chatId)]) {
        copytradeChangeData[Number(chatId)]['sellAmount'] = amount;
        const buttons = getChangeButtons(chatId);
        let message = 'You can change setting of copy trade. You have to set buy/sell amount in proportional mode. \n \n🟢 Select \t\t🟠 Deselect';
        botInstance.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: buttons!
            }
        })
    }
}

const handleChangeBuyAmount = (botInstance: TelegramBot, chatId: TelegramBot.ChatId, query: TelegramBot.CallbackQuery) => {
    botInstance.sendMessage(chatId, `Enter new buy amount:`, { reply_markup: { force_reply: true } });
}

const handleChangeSellAmount = (botInstance: TelegramBot, chatId: TelegramBot.ChatId, query: TelegramBot.CallbackQuery) => {
    botInstance.sendMessage(chatId, `Enter new sell amount:`, { reply_markup: { force_reply: true } });
}

const handleChangeSave = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId, query: TelegramBot.CallbackQuery) => {
    console.log('handleChangeSave');
    console.log('copytradeChangeData = ', copytradeChangeData[Number(chatId)]);
    if (!copytradeChangeData[Number(chatId)]) {
        return;
    }
    if (copytradeChangeData[Number(chatId)]["tradeMode"] == 1 && (copytradeChangeData[Number(chatId)]["buyAmount"] == 0 || copytradeChangeData[Number(chatId)]["sellAmount"] == 0)) {
        botInstance.sendMessage(chatId, '💡 You have to set buy/sell amount in proportional mode');
        return;
    }

    const newSave = {
        chatId: chatId,
        wallets: copytradeChangeData[Number(chatId)]["wallets"],
        name: copytradeChangeData[Number(chatId)]["name"],
        copyWallet: copytradeChangeData[Number(chatId)]["copyWallet"],
        tradeMode: copytradeChangeData[Number(chatId)]["tradeMode"],
        buyAmount: copytradeChangeData[Number(chatId)]["buyAmount"],
        sellAmount: copytradeChangeData[Number(chatId)]["sellAmount"],
        subscriptionId: copytradeChangeData[Number(chatId)]["subscriptionId"],
    }

    console.log('new save = ', newSave);
    await Copytrade.findByIdAndUpdate(copytradeChangeData[Number(chatId)]._id, newSave);
    delete copytradeChangeData[Number(chatId)];
    botInstance.deleteMessage(chatId, query.message?.message_id!);
}

const getChangeButtons = (chatId: TelegramBot.ChatId) => {
    console.log('copytradeChangeData = ', copytradeChangeData);
    let buttons;
    if (copytradeChangeData[Number(chatId)]['tradeMode'] = 1) {
        buttons = [
            [
                { text: '🟠 📋 Identical', callback_data: 'copytrade_change_mode_identical' },
                { text: '🟢 ⚖️ Proportional', callback_data: 'copytrade_change_mode_proportional' },
            ],
            [
                { text: `Buy Amount - ${copytradeChangeData[Number(chatId)]["buyAmount"]}`, callback_data: 'copytrade_change_buyamount' },
                { text: `Sell Amount - ${copytradeChangeData[Number(chatId)]["sellAmount"]}`, callback_data: 'copytrade_change_sellamount' },
            ],
            [
                { text: 'Save', callback_data: 'copytrade_change_save' }
            ]
        ]
    } else if (copytradeChangeData[Number(chatId)]['tradeMode'] = 0) {
        buttons = [
            [
                { text: '🟢 📋 Identical', callback_data: 'copytrade_change_mode_identical' },
                { text: '🟠 ⚖️ Proportional', callback_data: 'copytrade_change_mode_proportional' },
            ],
            [
                { text: `Buy Amount - `, callback_data: 'no callback' },
                { text: `Sell Amount - `, callback_data: 'no callback' },
            ],
            [
                { text: 'Save', callback_data: 'copytrade_change_save' }
            ]
        ]
    }
    return buttons;
}

const handleChangeMode = (botInstance: TelegramBot, chatId: TelegramBot.ChatId, mode: string, query: TelegramBot.CallbackQuery) => {
    console.log('change mode = ', mode);
    const message_id = query.message?.message_id;
    console.log('copytradeChangeData = ', copytradeChangeData);
    if (!copytradeChangeData[Number(chatId)])
        return;
    if (mode == 'proportional') {
        let message = 'You can change setting of copy trade. You have to set buy/sell amount in proportional mode. \n \n🟢 Select \t\t🟠 Deselect';
        copytradeChangeData[Number(chatId)]['tradeMode'] = 1;
        let buttons = [
            [
                { text: '🟠 📋 Identical', callback_data: 'copytrade_change_mode_identical' },
                { text: '🟢 ⚖️ Proportional', callback_data: 'copytrade_change_mode_proportional' },
            ],
            [
                { text: `Buy Amount - ${copytradeChangeData[Number(chatId)]["buyAmount"]}`, callback_data: 'copytrade_change_buyamount' },
                { text: `Sell Amount - ${copytradeChangeData[Number(chatId)]["sellAmount"]}`, callback_data: 'copytrade_change_sellamount' },
            ],
            [
                { text: 'Save', callback_data: 'copytrade_change_save' }
            ]
        ]
        switchMenu(chatId, message_id, message, buttons);
    } else if (mode == 'identical') {
        let message = 'You can change setting of copy trade. You have to set buy/sell amount in proportional mode. \n \n🟢 Select \t\t🟠 Deselect';
        copytradeChangeData[Number(chatId)]['tradeMode'] = 0;
        let buttons = [
            [
                { text: '🟢 📋 Identical', callback_data: 'copytrade_change_mode_identical' },
                { text: '🟠 ⚖️ Proportional', callback_data: 'copytrade_change_mode_proportional' },
            ],
            [
                { text: `Buy Amount - `, callback_data: 'no_callback' },
                { text: `Sell Amount - `, callback_data: 'no_callback' },
            ],
            [
                { text: 'Save', callback_data: 'copytrade_change_save' }
            ]
        ]
        switchMenu(chatId, message_id, message, buttons);
    }
}

const handleEditMode = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId, copytradeId: string, query: TelegramBot.CallbackQuery) => {
    const copyTrade = await Copytrade.findById(copytradeId);
    if (!copyTrade)
        return;

    console.log('copytrade = ', copyTrade);
    copytradeChangeData[Number(chatId)] = {
        _id: copyTrade._id,
        chatId: chatId,
        wallets: copyTrade.wallets,
        name: copyTrade.name,
        copyWallet: copyTrade.copyWallet,
        tradeMode: copyTrade.tradeMode,
        buyAmount: copyTrade.buyAmount,
        sellAmount: copyTrade.sellAmount,
        subscriptionId: copyTrade.subscriptionId,
    };
    console.log('copytradedata = ', copytradeChangeData);

    let buttons;
    if (copyTrade.tradeMode == 0) {
        buttons = [
            [
                { text: '🟢 📋 Identical', callback_data: 'copytrade_change_mode_identical' },
                { text: '🟠 ⚖️ Proportional', callback_data: 'copytrade_change_mode_proportional' },
            ],
            [
                { text: 'Buy Amount - ', callback_data: 'no callback' },
                { text: 'Sell Amount - ', callback_data: 'no callback' },
            ],
            [
                { text: 'Save', callback_data: `copytrade_change_save` }
            ]
        ]
    } else {
        buttons = [
            [
                { text: '🟠 📋 Identical', callback_data: 'copytrade_change_mode_identical' },
                { text: '🟢 ⚖️ Proportional', callback_data: 'copytrade_change_mode_proportional' },
            ],
            [
                { text: `Buy Amount - ${copytradeChangeData[Number(chatId)]['buyAmount']}`, callback_data: 'copytrade_change_buyamount' },
                { text: `Sell Amount - ${copytradeChangeData[Number(chatId)]['sellAmount']}`, callback_data: 'copytrade_change_sellamount' },
            ],
            [
                { text: 'Save', callback_data: `copytrade_change_save` }
            ]
        ];
    }

    botInstance.sendMessage(chatId, 'You can change setting of copy trade. You have to set buy/sell amount in proportional mode. \n \n🟢 Select \t\t🟠 Deselect', {
        reply_markup: {
            inline_keyboard: [
                ...buttons
            ]
        }
    });

}

const handleRemoveTradeConfirm = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId, tradeId: string, query: TelegramBot.CallbackQuery) => {
    console.log('handleRemoveTradeConfirm, tradeId = ', tradeId);
    botInstance.sendMessage(chatId, "Input 'Yes' if you want to really remove this trade " + tradeId, { reply_markup: { force_reply: true } });
}

const handleRemoveTrade = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId, msg: TelegramBot.Message, tradeId: string) => {
    const confirm = msg.text;
    if (confirm == 'Yes') {
        CopyTradeService.removeHandler(tradeId);
        await Copytrade.findByIdAndDelete(tradeId);
        handleInitialCommand(botInstance, chatId);
    } else {
        botInstance.deleteMessage(chatId, msg.message_id);
    }
}

const handleSelectTrade = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId, tradeId: string, query: TelegramBot.CallbackQuery) => {
    try {
        const copytrade = await Copytrade.findById(tradeId);
        console.log('==========> selected copytrade = ', copytrade);
        const targetWallet = copytrade?.copyWallet;
        const subscriptionId = copytrade?.subscriptionId;
        const wallets = copytrade?.wallets;
        const histories = await TradeHistory.find({ walletAddress: targetWallet, copyTradeId: copytrade!._id });

        console.log('=========> histories = ', histories);
        let msg = `\n 🍏 Copy trade Information 🍏\n\n 🎯 Target Wallet: \n 💎 <code>${targetWallet}</code>\n\n`;

        msg = msg + '📜 Target History \n';
        if (histories.length > 0) {
            for (let i = 0; i < histories.length; i++) {
                let submsg = `${histories[i].tokenName}(${histories[i].tokenSymbol}) <code>${histories[i].tokenAddress}</code> \ntype: ${histories[i].buyOrSell}, ${histories[i].tokenAmount} ${histories[i].tokenSymbol}/${histories[i].solAmount} SOL\n\n`;
                msg = msg + submsg;
            }
        } else {
            msg = msg + '\t\t No Trades yet. \n\n'
        }

        const followKeys: string[] = [];
        msg = msg + '💰 Your wallets: \n';

        for (let i = 0; i < wallets!.length; i++) {
            const wallet = await Wallet.findById(wallets![i]);
            let submsg = '💎 ' + `<code>${wallet!.publicKey}</code>` + '\n';
            msg = msg + submsg;
            followKeys.push(wallet!.publicKey);
        }

        msg = msg + '\n📜 Your wallets History \n';

        const groupedResults = await TradeHistory.aggregate([
            {
                $match: {
                    walletAddress: { $in: followKeys },
                    copyTradeId: { $in: [copytrade!._id] }
                }
            },
            {
                $group: {
                    _id: "$tradeTime",
                    trades: {
                        $push: {
                            walletAddress: "$walletAddress",
                            tokenAddress: "$tokenAddress",
                            tokenName: "$tokenName",
                            tokenSymbol: "$tokenSymbol",
                            buyOrSell: "$buyOrSell",
                            solAmount: "$solAmount",
                            tokenAmount: "$tokenAmount",
                            copyTradeId: "$copyTradeId"
                        }
                    }
                }
            },
            {
                $sort: { _id: 1 } // Sort by tradeTime (ascending)
            }
        ]);

        console.log('===============> wallet history = ', groupedResults);

        if (groupedResults.length > 0) {
            groupedResults.forEach(group => {
                const tradeTime = group._id;
                const trades = group.trades;

                trades.map((trade: any) => {
                    msg = msg + `${trade.buyOrSell}: ${trade.tokenName}(${trade.tokenSymbol}), ${trade.tokenAmount} ${trade.tokenSymbol}/${trade.solAmount} SOL \n`
                });

                msg = msg + '\n';
            });
        } else {
            msg = msg + '\t\t No Trades yet. \n\n';
        }

        botInstance.sendMessage(chatId, msg, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Close', callback_data: 'close_message' }]
                ]
            }, parse_mode: 'HTML'
        });
    } catch (error) {
        logger.error(String(error));
    }
}

const handleCreateNewTrade = async (botInstance: TelegramBot, chatId: TelegramBot.ChatId) => {
    const wallets = await Wallet.find({ chatId });
    if (wallets.length > 0) {
        botInstance.sendMessage(chatId, 'Enter target wallet:', { reply_markup: { force_reply: true } });
    } else {
        botInstance.sendMessage(chatId, 'You have no wallet');
    }
}

async function handleTargetWallet(botInstance: TelegramBot, chatId: TelegramBot.ChatId, msg: TelegramBot.Message) {
    try {
        const targetWallet = msg.text;
        if (solana.isValidAddress(targetWallet!) == false) {
            botInstance.sendMessage(chatId, 'Invalid Address');
            botInstance.sendMessage(chatId, 'Enter target wallet:', { reply_markup: { force_reply: true } });
            return;
        }

        copytradeData[Number(chatId)] = {
            chatId: Number(chatId),
            copyWallet: targetWallet,
            wallets: [],
            name: '',
            tradeMode: 0,
            buyAmount: 0,
            sellAmount: 0
        };
        const wallets = await Wallet.find({ chatId });
        console.log('wallets = ', wallets);
        let buttons = [];
        walletSelections[Number(chatId)] = {}
        for (let i = 0; i < wallets.length; i++) {
            let balance = await solana.getSolBalance(wallets[i].privateKey);
            console.log('balance = ', balance);
            buttons.push(
                [
                    { text: `🟠 ${shortenAddress(wallets[i].publicKey)}`, callback_data: `copytrade_select_${wallets[i].publicKey}` },
                    { text: `💎 ${balance} SOL`, callback_data: `copytrade_select_${wallets[i].publicKey}` }
                ]
            );
            walletSelections[Number(chatId)][wallets[i].publicKey] = false
        }
        console.log('walletSelections = ', walletSelections);
        botInstance.sendMessage(chatId,
            `🍏 Pick the wallets to start your copy trading journey. \n \n🟢 Select \t\t🟠 Deselect`, {
            reply_markup: {
                inline_keyboard: [
                    ...buttons,
                    [
                        { text: ' 📋 Identical', callback_data: 'copytrade_mode_identical' },
                        { text: ' ⚖️ Proportional', callback_data: 'copytrade_mode_proportional' },
                    ]
                ]
            }
        });
    } catch (error) {
        console.log('handleTargetWallet error');
        botInstance.sendMessage(chatId, 'Invalid Address');
    }

}

async function handleSelectMode(botInstance: TelegramBot, chatId: TelegramBot.ChatId, mode: string, query: TelegramBot.CallbackQuery) {
    console.log('handleSelectMode, mode = ', mode);
    if (mode == 'identical') {
        if (copytradeData[Number(chatId)]) {
            copytradeData[Number(chatId)]['tradeMode'] = 0;
            botInstance.sendMessage(chatId, 'Enter trade name', { reply_markup: { force_reply: true } });
            botInstance.deleteMessage(chatId, query.message?.message_id!);
        }
    } else if (mode == 'proportional') {
        if (copytradeData[Number(chatId)]) {
            copytradeData[Number(chatId)]['tradeMode'] = 1;
            botInstance.sendMessage(chatId, 'Enter buy amount:', { reply_markup: { force_reply: true } });
            botInstance.deleteMessage(chatId, query.message?.message_id!);
        }
    }
}

async function handleSelectWallet(botInstance: TelegramBot, chatId: TelegramBot.ChatId, queryData: string, query: TelegramBot.CallbackQuery) {
    const messageId = query.message?.message_id;
    const publicKey = queryData;
    if (walletSelections[Number(chatId)]) {
        const selection = walletSelections[Number(chatId)][publicKey]
        walletSelections[Number(chatId)][publicKey] = !selection;
        console.log('new walletSelections = ', walletSelections);
        const wallets = await Wallet.find({ chatId });
        let buttons = [];
        for (let i = 0; i < wallets.length; i++) {
            let balance = await solana.getSolBalance(wallets[i].privateKey);
            if (walletSelections[Number(chatId)][wallets[i].publicKey] == true)
                buttons.push(
                    [
                        { text: `🟢 ${shortenAddress(wallets[i].publicKey)}`, callback_data: `copytrade_select_${wallets[i].publicKey}` },
                        { text: `💎 ${balance} SOL`, callback_data: `copytrade_select_${wallets[i].publicKey}` }
                    ]
                );
            else
                buttons.push(
                    [
                        { text: `🟠 ${shortenAddress(wallets[i].publicKey)}`, callback_data: `copytrade_select_${wallets[i].publicKey}` },
                        { text: `💎 ${balance} SOL`, callback_data: `copytrade_select_${wallets[i].publicKey}` }
                    ]
                );
        }
        buttons.push(
            [
                { text: ' 📋 Identical', callback_data: 'copytrade_mode_identical' },
                { text: ' ⚖️ Proportional', callback_data: 'copytrade_mode_proportional' },
            ]
        )
        await switchMenu(chatId, messageId, `🍏 Pick the wallets to start your copy trading journey. \n \n🟢 Select \t\t🟠 Deselect`, buttons)
    } else {
        const message_id = query.message?.message_id;
        botInstance.deleteMessage(chatId, message_id!);
    }
}

const handleAddName = async (botInstance: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const messageText = msg.text;

    if (copytradeData[chatId])
        copytradeData[chatId]['name'] = messageText;

    console.log('walletSelections = ', walletSelections[chatId])
    if (!walletSelections[chatId])
        return;
    const wallets = await Wallet.find({ chatId });
    for (let i = 0; i < wallets.length; i++) {
        if (walletSelections[chatId][wallets[i].publicKey] == true) {
            copytradeData[chatId]['wallets'].push(wallets[i]._id);
        }
    }

    const currentTimeInMillis = Date.now();
    const currentTimeInSeconds = Math.floor(currentTimeInMillis / 1000);
    console.log('New Copy Trade = ', copytradeData[Number(chatId)]);
    let data = new Copytrade(copytradeData[Number(chatId)]);
    await data.save();
    await CopyTradeService.registerHandler(data._id);
    delete copytradeData[Number(chatId)];
    delete walletSelections[chatId];
    // botInstance.deleteMessage(chatId, messageId);
    handleInitialCommand(botInstance, chatId);
}

const handleBuyAmount = async (botInstance: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const buyAmount = msg.text;
    if (!buyAmount || !isNumber(buyAmount)) {
        botInstance.sendMessage(chatId, "Invalid Number");
        sleep(500);
        botInstance.sendMessage(chatId, 'Enter buy amount:', { reply_markup: { force_reply: true } });
        return;
    }
    if (copytradeData[Number(chatId)]) {
        copytradeData[Number(chatId)]['tradeMode'] = 1;
        copytradeData[Number(chatId)]['buyAmount'] = Number(buyAmount);
        botInstance.sendMessage(chatId, 'Enter trade name', { reply_markup: { force_reply: true } });
        return;
    }
}

export default {
    handleInitialCommand,
    handleCallbackQuery,
    handleAddName,
    handleTargetWallet,
    handleBuyAmount,
    handleRemoveTrade,
    handleNewBuyAmount,
    handleNewSellAmount,
}

