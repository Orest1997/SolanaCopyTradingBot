import WebSocket from "ws";
import * as Config from "./config";
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  ParsedAccountData,
  SolanaJSONRPCError,
} from "@solana/web3.js";
import TelegramBot from "node-telegram-bot-api";
import { Copytrade } from "./models/copytrade";
import { ObjectId } from "mongoose";
import { botInstance } from "./bot";
import { Wallet } from "./models/wallet";
import * as Solana from "./web3";
import CopyTradeController from "./controllers/CopyTradeController";
import { TradeHistory } from "./models/tradehistory";
import { AmountMonitor } from "./models/amountMonitor";
import { getTokenMetaData } from "./web3";
import { sign } from "crypto";

const webSocket = new WebSocket(Config.SOLANA_WSS_ENDPOINT);

const start = async () => {
  webSocket.onopen = async function (event) {
    const copytrades = await Copytrade.find({});
    console.log("start copytrades count = ", copytrades.length);
    for (let i = 0; i < copytrades.length; i++) {
      let message = JSON.stringify({
        jsonrpc: "2.0",
        id: copytrades[i]._id,
        method: "blockSubscribe",
        params: [
          {
            mentionsAccountOrProgram: copytrades[i].copyWallet,
          },
          {
            commitment: "confirmed",
            encoding: "jsonParsed",
            showRewards: true,
            transactionDetails: "signatures",
          },
        ],
      });
      console.log("sending msg to websocket");
      webSocket.send(message);
    }
  };

  webSocket.onmessage = async function (event) {
    try {
      const response = JSON.parse(event.data as string);
      console.log("websocket event data = ", response);
      console.log("websocket event type = ", event.type);
      if (response.result != null && response.id != null) {
        console.log("subscription id = ", response.result);
        console.log("message id, trade id = ", response.id);
        let copytrade = await Copytrade.findById(response.id);
        copytrade!.subscriptionId = Number(response.result);
        await copytrade?.save();
      }

      // Check if the message is a notification
      if (response.method === "blockNotification") {
        let blockData = response.params.result;
        let currentSlot = blockData.value.slot;
        const subscriptionId = response.params.subscription;
        console.log("onmessage, subscription id = ", subscriptionId);

        if (blockData.value.block) {
          // console.log('==> signatures length = ', blockData.value.block.signatures.length);
          for (
            let i = blockData.value.block.signatures.length - 1;
            i >= 0;
            i--
          ) {
            let signature = blockData.value.block.signatures[i];
            console.log(`==============> ${i} signature = `, signature);
            const swapInfo = await Solana.getTokenSwapInfo(Config.SOLANA_CONNECTION, signature);
            console.log("token swap info = ", swapInfo);
            if (
              swapInfo.isSwap == true &&
              (swapInfo.sendToken == Solana.WSOL_ADDRESS ||
                swapInfo.receiveToken == Solana.WSOL_ADDRESS)
            ) {
              handleSwap(subscriptionId, swapInfo, signature);
            }
          }
        }
      }
    } catch (error) {
      console.log("websocket onmessage error");
    }
  };
};

const handleSwap = async (subscriptionId: any, swapInfo: any, transactionHash: string) => {

  try {
    console.log(
      `=================> handleSwap, subscriptionId = ${subscriptionId}, swapInfo = ${swapInfo}, hash = ${transactionHash}`,
      swapInfo
    );
    const copytrade = await Copytrade.findOne({ subscriptionId });
    if (copytrade) {
      const copyTradeId = copytrade._id;
      const chatId = copytrade.chatId;

      const wallets = copytrade.wallets;
      const name = copytrade.name;
      const copyWallet = copytrade.copyWallet;
      const tradeMode = copytrade.tradeMode;
      const buyAmount = copytrade.buyAmount;

      let tokenAddress: string;
      let buyOrSell: string;
      let solAmount: number;
      let tokenAmount: number;
      let tradeTime: number = swapInfo.blockTime;

      if (swapInfo.receiveToken == Solana.WSOL_ADDRESS) {
        buyOrSell = "sell";
        solAmount = swapInfo.receiveAmount;
        tokenAmount = swapInfo.sendAmount;
        tokenAddress = swapInfo.sendToken;
      } else {
        buyOrSell = "buy";
        solAmount = swapInfo.sendAmount;
        tokenAmount = swapInfo.receiveAmount;
        tokenAddress = swapInfo.receiveToken;
      }
      // console.log('tokenMetaData 1= ');
      const tokenMetaData = await getTokenMetaData(Config.SOLANA_CONNECTION, tokenAddress);

      // console.log('tokenMetaData 2= ', tokenMetaData);
      const tokenName = tokenMetaData?.name;
      const tokenSymbol = tokenMetaData?.symbol;

      const solscanLink = `https://solscan.io/tx/${transactionHash}`;
      const message = `🍏 ${buyOrSell === 'buy' ? '<b>Buy</b>' : '<b>Sell</b>'} 🍏\n ${tokenName}(${tokenSymbol}), <code>${tokenAddress}</code>, \n💎 ${(tokenAmount / (10 ** tokenMetaData!.decimals))} ${tokenSymbol}/${(solAmount / LAMPORTS_PER_SOL)} SOL, \n\nTrx hash:\n<a href="${solscanLink}">${solscanLink}</a>`;

      botInstance.sendMessage(chatId, message, { parse_mode: 'HTML' });

      if (buyOrSell == "buy") {

        let amount = (tradeMode == 0) ? tokenAmount : buyAmount * 10 ** tokenMetaData!.decimals;

        for (let i = 0; i < wallets.length; i++) {
          let wallet = await Wallet.findById(wallets[i]);
          console.log(' wallet = ', wallet);
          if (wallet) {
            Solana.jupiter_swap(Config.SOLANA_CONNECTION, wallet.privateKey, wallet.publicKey, Solana.WSOL_ADDRESS, swapInfo.receiveToken, amount, "ExactOut", botInstance, chatId).then(async (value) => {
              console.log('value = ', value);
              if (value.confirmed) {
                const solscanLink = `https://solscan.io/tx/${value.txSignature}`;
                const message = `📜 <b>Copy Buy</b> 📜\n Wallet-<code>${wallet.publicKey}</code>, \n💎 ${(amount / (10 ** tokenMetaData!.decimals))} ${tokenSymbol} \n\n<b>Trx hash:</b>\n<a href="${solscanLink}">${solscanLink}</a>`;
                botInstance.sendMessage(chatId, message, { parse_mode: 'HTML' });
                const info = await Solana.getTokenSwapInfo(Config.SOLANA_CONNECTION, value.txSignature!);
                console.log(`=========> info = `, info);
                const tradeHistory = new TradeHistory({
                  tradeTime: tradeTime,
                  walletAddress: wallet.publicKey,
                  tokenAddress: tokenAddress,
                  tokenName: tokenName,
                  tokenSymbol: tokenSymbol,
                  buyOrSell: "buy",
                  solAmount: (info.sendAmount / LAMPORTS_PER_SOL),
                  tokenAmount: (amount / (10 ** tokenMetaData!.decimals)),
                  copyTradeId: copyTradeId,
                });
                await tradeHistory.save();
              } else {
                // botInstance.sendMessage(chatId, `Transaction Failed`);
              }
            });
          }
        }

        try {
          let amounts = await AmountMonitor.findOne({ tradeId: copytrade._id, tokenAddress: tokenAddress });
          if (!amounts) {
            new AmountMonitor({ tradeId: copytrade._id, tokenAddress: tokenAddress, copyWalletAmount: String(tokenAmount), followWalletAmount: String(amount) }).save();
          } else {
            amounts.copyWalletAmount = String(Number(amounts.copyWalletAmount) + Number(tokenAmount));
            amounts.followWalletAmount = String(Number(amounts.followWalletAmount) + Number(amount));
            await amounts.save();
          }
          console.log('Amount updated or created successfully:', amounts);
        } catch (error) {
          console.log('Error Amount updated or created', error);
        }

      } else { // sell

        let amounts = await AmountMonitor.findOne({ tradeId: copytrade._id, tokenAddress: tokenAddress });

        if (!amounts) {
          console.log('AmountMonitor has no record');
          return;
        }

        let amount = (tradeMode == 0) ? Math.min(tokenAmount, Number(amounts.followWalletAmount)) : Math.min(tokenAmount * (Number(amounts.followWalletAmount) / Number(amounts.copyWalletAmount)), Number(amounts.followWalletAmount));

        console.log('sell amount = ', amount);

        for (let i = 0; i < wallets.length; i++) {
          let wallet = await Wallet.findById(wallets[i]);
          if (wallet) {
            Solana.jupiter_swap(Config.SOLANA_CONNECTION, wallet.privateKey, wallet.publicKey, swapInfo.sendToken, Solana.WSOL_ADDRESS, amount, "ExactIn", botInstance, chatId).then(async (value) => {
              if (value.confirmed) {
                console.log('value = ', value);
                if (value.confirmed) {
                  const solscanLink = `https://solscan.io/tx/${value.txSignature}`;
                  const message = `📜 <b>Copy Sell</b> 📜 \n<b>Wallet</b> -<code>${wallet.publicKey}</code>, \n💎 ${(amount / (10 ** tokenMetaData!.decimals))} ${tokenSymbol}, \n\n<b>Trx hash:</b>\n<a href="${solscanLink}">${solscanLink}</a>`;
                  botInstance.sendMessage(chatId, message, { parse_mode: 'HTML' });
                  const info = await Solana.getTokenSwapInfo(Config.SOLANA_CONNECTION, value.txSignature!);
                  console.log(`==========> info = `, info);
                  const tradeHistory = new TradeHistory({
                    tradeTime: tradeTime,
                    walletAddress: wallet.publicKey,
                    tokenAddress: tokenAddress,
                    tokenName: tokenName,
                    tokenSymbol: tokenSymbol,
                    buyOrSell: "sell",
                    solAmount: (info.receiveAmount / LAMPORTS_PER_SOL),
                    tokenAmount: (amount / (10 ** tokenMetaData!.decimals)),
                    copyTradeId: copyTradeId,
                  });
                  await tradeHistory.save();
                } else {
                  // botInstance.sendMessage(chatId, `Sell Transaction failed`);
                }
              }
            });
          }
        }

        try {
          amounts = await AmountMonitor.findOne(
            { tradeId: copytrade._id, tokenAddress: tokenAddress });

          amounts!.copyWalletAmount = String(Number(amounts!.copyWalletAmount) - Number(tokenAmount));
          amounts!.followWalletAmount = String(Number(amounts!.followWalletAmount) - Number(amount));
          await amounts!.save();
          console.log('AmountTracker updated successfully, new amounts = ', amounts);
        } catch (error) {
          console.log('Error finding or updating document:', error);
        }
      }

      // console.log(`trade history : time = ${tradeTime}, walletAddress = ${copyWallet!}, tokenAddress = ${tokenAddress}, buyOrSell = ${buyOrSell}, solAmount = ${solAmount}, tokenAmount = ${tokenAmount} `);

      const tradeHistory = new TradeHistory({
        tradeTime: tradeTime,
        walletAddress: copyWallet!,
        tokenAddress: tokenAddress,
        tokenName: tokenName,
        tokenSymbol: tokenSymbol,
        buyOrSell: buyOrSell,
        solAmount: (solAmount / LAMPORTS_PER_SOL),
        tokenAmount: (tokenAmount / (10 ** tokenMetaData!.decimals)),
        copyTradeId: copyTradeId,
      });

      await tradeHistory.save();
    }
  } catch (error) {
    console.log("handleSwap error = ", error);
  }
};

export const registerHandler = async (_id: any) => {
  try {
    let copytrade = await Copytrade.findOne({ _id });

    if (!copytrade) {
      console.log("registerHandler, no copytrade");
      return;
    }
    console.log("registerHandler, target = ", copytrade.copyWallet!);
    const message = JSON.stringify({
      jsonrpc: "2.0",
      id: _id,
      method: "blockSubscribe",
      params: [
        {
          mentionsAccountOrProgram: copytrade.copyWallet!,
        },
        {
          commitment: "confirmed",
          encoding: "jsonParsed",
          showRewards: true,
          transactionDetails: "signatures",
        },
      ],
    });

    console.log("webSocket send message");
    webSocket.send(message);
  } catch (error) {
    console.log(error);
  }
};

const removeHandler = async (_id: any) => {
  try {
    const copytrade = await Copytrade.findById(_id);
    const subscriptionId = copytrade!.subscriptionId;
    console.log("remove copytrade = ", copytrade!);
    const message = JSON.stringify({
      jsonrpc: "2.0",
      id: _id,
      method: "blockUnsubscribe",
      params: [subscriptionId],
    });
    webSocket.send(message);
  } catch (error) {
    console.log(`removeHandler _id = ${_id}, error = `, error);
  }
};

export default {
  start,
  registerHandler,
  removeHandler,
};
