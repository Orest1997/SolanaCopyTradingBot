import { Schema, model, Document } from 'mongoose';

export interface IWallet extends Document {
    chatId: number;
    publicKey: string;
    privateKey: string;
}

const WalletSchema: Schema = new Schema({
    chatId: { type: Number, required: true },
    publicKey: { type: String, required: true, unique: true },
    privateKey: { type: String, required: true, unique: true }
});

export const Wallet = model<IWallet>('Wallet', WalletSchema);
