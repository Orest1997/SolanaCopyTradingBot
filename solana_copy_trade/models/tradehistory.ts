import { Schema, model, Document } from 'mongoose';

// Interface for Trade History document
interface ITradeHistory extends Document {
  tradeTime: number;
  walletAddress: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  buyOrSell: 'buy' | 'sell';
  solAmount: number;
  tokenAmount: number;
  copyTradeId: Schema.Types.ObjectId;
}

// Trade History schema
const TradeHistorySchema = new Schema<ITradeHistory>({
  tradeTime: { type: Number, required: true },
  walletAddress: { type: String, required: true },
  tokenAddress: { type: String, required: true },
  tokenName: { type: String, required: true},
  tokenSymbol: { type: String, required: true},
  buyOrSell: { type: String, enum: ['buy', 'sell'], required: true },
  solAmount: { type: Number, required: true },
  tokenAmount: { type: Number, required: true },
  copyTradeId: { type: Schema.Types.ObjectId, ref: 'Copytrade' },
});

// Trade History model
const TradeHistory = model<ITradeHistory>('TradeHistory', TradeHistorySchema);

export { TradeHistory, ITradeHistory };