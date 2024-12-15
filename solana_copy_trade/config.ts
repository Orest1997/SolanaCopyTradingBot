import { Connection } from "@solana/web3.js";

export const SOLANA_RPC_ENDPOINT = 'https://skilled-blissful-waterfall.solana-mainnet.quiknode.pro/d1bbbd179348df7e05a449d81fb7cdde96e589dc/';
export const SOLANA_WSS_ENDPOINT = 'wss://skilled-blissful-waterfall.solana-mainnet.quiknode.pro/d1bbbd179348df7e05a449d81fb7cdde96e589dc/';
export const MONGO_URI = 'mongodb://localhost:27017/SolanaTradeBot';
export const TELEGRAM_BOT_TOKEN = '6972192463:AAHT6XLY2oQMmx78hq64eMbkD6LpJvbKgZs';
export const JITO_TIP = 1000000;
export const TX_FEE = 1000000;
export const ACCOUNT_FEE = 2000000;
export const SOLANA_CONNECTION = new Connection(SOLANA_RPC_ENDPOINT, { wsEndpoint: SOLANA_WSS_ENDPOINT, commitment: "confirmed"});
