import mongoose, { Document, Schema } from 'mongoose';

export interface ITopStocks extends Document {
    name: string;
    data: any[];
    lastScraped: Date;
}

const topStocksSchema = new Schema<ITopStocks>({
    name: { type: String, default: 'top10', unique: true },
    data: Array,
    lastScraped: { type: Date, default: Date.now }
});

export const TopStocksCache = mongoose.model<ITopStocks>('TopStocksCache', topStocksSchema);