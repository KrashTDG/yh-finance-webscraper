import mongoose, { Document, Schema } from 'mongoose';

export interface INews { title: string; link: string; publisher: string; }

export interface IStock extends Document {
    ticker: string;
    price: string;
    change: string;
    changePercent: string;
    news: INews[];
    lastScraped: Date;
}

const stockSchema = new Schema<IStock>({
    ticker: { type: String, required: true, unique: true },
    price: String,
    change: String,
    changePercent: String,
    news: { type: [], default: [] },
    lastScraped: { type: Date, default: Date.now }
});

export const StockCache = mongoose.model<IStock>('StockCache', stockSchema);