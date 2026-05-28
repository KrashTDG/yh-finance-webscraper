// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Cache Layer'))
    .catch(err => console.error('MongoDB Connection Error:', err));

const stockSchema = new mongoose.Schema({
    ticker: { type: String, required: true, unique: true },
    price: String,
    change: String,
    changePercent: String,
    lastScraped: { type: Date, default: Date.now }
});

const StockCache = mongoose.model('StockCache', stockSchema);

async function scrapeYahooFinance(ticker) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
    
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error(`Ticker "${ticker}" not found or delisted.`);
    }

    const meta = data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    
    const changeAmount = (price - prevClose);
    const changePercent = ((changeAmount / prevClose) * 100).toFixed(2) + "%";

    return { 
        price: price.toFixed(2).toString(), 
        change: changeAmount.toFixed(2).toString(), 
        changePercent: changePercent 
    };
}

app.get('/api/stock/:ticker', async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 Minutes

    try {
        const cachedStock = await StockCache.findOne({ ticker });
        
        if (cachedStock && (Date.now() - cachedStock.lastScraped < CACHE_DURATION_MS)) {
            console.log(`Cache Hit for [${ticker}]`);
            return res.json({
                source: 'cache',
                ticker: cachedStock.ticker,
                price: cachedStock.price,
                change: cachedStock.change,
                changePercent: cachedStock.changePercent,
                updatedAt: cachedStock.lastScraped
            });
        }

        console.log(`Cache Miss. Scraping live data for [${ticker}]`);
        const scrapedData = await scrapeYahooFinance(ticker);

        const updatedStock = await StockCache.findOneAndUpdate(
            { ticker },
            { 
                ticker, 
                price: scrapedData.price, 
                change: scrapedData.change,
                changePercent: scrapedData.changePercent,
                lastScraped: Date.now() 
            },
            { new: true, upsert: true }
        );

        res.json({
            source: 'live',
            ticker: updatedStock.ticker,
            price: updatedStock.price,
            change: updatedStock.change,
            changePercent: updatedStock.changePercent,
            updatedAt: updatedStock.lastScraped
        });

    } catch (error) {
        console.error(`Error processing request for ${ticker}:`, error.message);
        res.status(404).json({ error: error.message || "Failed to fetch stock data." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));