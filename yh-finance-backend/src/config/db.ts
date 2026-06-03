// src/config/db.ts
import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log('Connected to MongoDB Cache Layer');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};