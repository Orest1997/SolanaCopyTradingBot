import { Schema, model, Document } from 'mongoose';

export interface IAmountMonitor extends Document {
    tradeId: Schema.Types.ObjectId;
    tokenAddress: string;
    copyWalletAmount: string; 
    followWalletAmount: string;
}

const AmountMonitorSchema = new Schema<IAmountMonitor>({
    tradeId: { type: Schema.Types.ObjectId, ref: 'Copytrade' },
    tokenAddress: { type: String },
    copyWalletAmount: { type: String },
    followWalletAmount: { type: String},
});

export const AmountMonitor = model<IAmountMonitor>('AmountMonitor', AmountMonitorSchema);