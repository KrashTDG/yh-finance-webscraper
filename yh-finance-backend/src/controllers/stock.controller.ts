import { Response } from 'express';
import axios from 'axios';
import { AuthRequest } from '../middlewares/auth.middleware';
import { StockCache } from '../models/StockCache';
import { TopStocksCache } from '../models/TopStocksCache';
import { scrapeYahooFinance, scrapeArticleHTML } from '../services/scraper.service';
import { triggerIncident } from '../services/alert.service';

export const getTopStocks = async (req: AuthRequest, res: Response): Promise<void> => {
    const CACHE_DURATION_MS = 15 * 60 * 1000; 
    try {
        const cache = await TopStocksCache.findOne({ name: 'top10' });
        if (cache && (Date.now() - cache.lastScraped.getTime() < CACHE_DURATION_MS) && cache.data.length > 0) {
            res.json(cache.data);
            return;
        }

        const symbols = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK-B', 'LLY', 'V'];
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
        
        const promises = symbols.map(async (ticker) => {
            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
                const { data } = await axios.get(url, { headers });
                const meta = data.chart.result[0].meta;
                const price = meta.regularMarketPrice;
                const changeAmount = (price - meta.chartPreviousClose);
                const changePercent = ((changeAmount / meta.chartPreviousClose) * 100).toFixed(2) + "%";
                return { ticker, price: price.toFixed(2), change: changeAmount.toFixed(2), changePercent };
            } catch (err) { return null; }
        });

        const rawTop10 = await Promise.all(promises);
        const top10 = rawTop10.filter(stock => stock !== null);

        if (top10.length === 0) throw new Error("All top stock requests failed.");

        await TopStocksCache.findOneAndUpdate({ name: 'top10' }, { data: top10, lastScraped: Date.now() }, { new: true, upsert: true });
        res.json(top10);
    } catch (error: any) {
        await triggerIncident("Top 10 Stocks Scraper Failed", error.message, 'critical', 'Stock-Scraper-Service');
        res.status(500).json({ error: "Failed to fetch top stocks" });
    }
};

export const getStockData = async (req: AuthRequest, res: Response): Promise<void> => {
    const ticker = (req.params.ticker as string).toUpperCase();
    const CACHE_DURATION_MS = 15 * 60 * 1000; 
    try {
        const cachedStock = await StockCache.findOne({ ticker });
        if (cachedStock && cachedStock.news.length > 0 && (Date.now() - cachedStock.lastScraped.getTime() < CACHE_DURATION_MS)) {       
            res.json({ source: 'cache', ...cachedStock.toObject() }); return;
        }

        const scrapedData = await scrapeYahooFinance(ticker);
        const updatedStock = await StockCache.findOneAndUpdate(
            { ticker },
            { ticker, ...scrapedData, lastScraped: Date.now() },
            { new: true, upsert: true }
        );
        res.json({ source: 'live', ...updatedStock?.toObject() });
    } catch (error: any) {
        await triggerIncident(`Main Scraper Failed for [${ticker}]`, error.message, 'warning', 'Main-Search-API');
        res.status(404).json({ error: `Could not load data for ${ticker}.` });
    }
};

export const readArticle = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const paragraphs = await scrapeArticleHTML(req.body.url);
        res.json({ paragraphs });
    } catch (error: any) {
        res.status(500).json({ error: "Failed to load the article text." });
    }
};