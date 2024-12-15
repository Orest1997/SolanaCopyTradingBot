import { Schema, model, Document } from 'mongoose';

export interface ICopytrade extends Document {
    chatId: number;
    wallets: Schema.Types.ObjectId[]; // trade wallet
    name: string; // trade name
    copyWallet: string; // copy wallet
    tradeMode: number; // 0: same mode, 1: proportional mode
    buyAmount: number;
    sellAmount: number;
    subscriptionId: number; // network subscription id
}

const CopyTradeSchema = new Schema<ICopytrade>({
    chatId: { type: Number },
    wallets: [{ type: Schema.Types.ObjectId, ref: 'Wallet' }],
    name: { type: String },
    copyWallet: { type: String },
    tradeMode: { type: Number },
    buyAmount: { type: Number},
    sellAmount: { type: Number},
    subscriptionId: { type: Number }
});

export const Copytrade = model<ICopytrade>('Copytrade', CopyTradeSchema);