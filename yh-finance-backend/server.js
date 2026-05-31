// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const rateLimit = require('express-rate-limit'); 

const app = express();
app.use(cors());
app.use(express.json());


const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 100, // Limit each IP address to 100 requests
    message: { error: "Too many requests from this IP. Please try again after 15 minutes." },
    standardHeaders: true, 
    legacyHeaders: false, 
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Cache Layer'))
    .catch(err => console.error('MongoDB Connection Error:', err));

const stockSchema = new mongoose.Schema({
    ticker: { type: String, required: true, unique: true },
    price: String,
    change: String,
    changePercent: String,
    news: { type: Array, default: [] },
    lastScraped: { type: Date, default: Date.now }
});

const StockCache = mongoose.model('StockCache', stockSchema);


const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const topStocksSchema = new mongoose.Schema({
    name: { type: String, default: 'top10', unique: true },
    data: Array,
    lastScraped: { type: Date, default: Date.now }
});
const TopStocksCache = mongoose.model('TopStocksCache', topStocksSchema);

const incidentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    source: { type: String, default: 'Backend-Server' }, 
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
    status: { type: String, enum: ['triggered', 'acknowledged', 'resolved'], default: 'triggered' },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date }
});
const Incident = mongoose.model('Incident', incidentSchema);

app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: "User already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: "User registered successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        res.json({ token, email: user.email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ error: "Access Denied. No token provided." });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Access Denied. Invalid token format." });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified; 
        next(); 
    } catch (err) {
        res.status(403).json({ error: "Invalid or expired token." });
    }
};

async function triggerIncident(title, description, severity = 'warning', source = 'Backend-Server') {
    try {
        const newIncident = new Incident({ title, description, severity, source });
        await newIncident.save();
        
        console.log(`\n🚨 [INCIDENT TRIGGERED] [${severity.toUpperCase()}]`);
        console.log(`Issue: ${title}`);
        console.log(`Check MongoDB ID: ${newIncident._id}\n`);

        const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL; 
        
        if (WEBHOOK_URL && severity === 'critical') {
            await axios.post(WEBHOOK_URL, {
                content: `🚨 **CRITICAL INCIDENT** 🚨\n**Service:** ${source}\n**Issue:** ${title}\n**Details:** ${description}`
            });
        }
    } catch (dbErr) {
        console.error("CRITICAL METADATA FAILURE: Alerting engine failed to log:", dbErr.message);
    }
}

async function scrapeYahooFinance(ticker) {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
    const newsUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=5`; // Fetch top 5 articles
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    console.log(`\n[Scraper] Reaching out to Yahoo for ${ticker}...`);


    const [chartRes, newsRes] = await Promise.all([
        axios.get(chartUrl, { headers }),
        axios.get(newsUrl, { headers })
    ]);

    if (!chartRes.data.chart || !chartRes.data.chart.result || chartRes.data.chart.result.length === 0) {
        throw new Error(`Ticker "${ticker}" not found or delisted.`);
    }

    const meta = chartRes.data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    const changeAmount = (price - prevClose);
    const changePercent = ((changeAmount / prevClose) * 100).toFixed(2) + "%";

    const rawNews = newsRes.data.news || [];
    console.log(`[Scraper] 📰 Yahoo returned ${rawNews.length} news articles.`);

    const news = rawNews.map(article => ({
        title: article.title,
        link: article.link,
        publisher: article.publisher
    }));

    return { 
        price: price.toFixed(2).toString(), 
        change: changeAmount.toFixed(2).toString(), 
        changePercent: changePercent,
        news: news 
    };
};


app.get('/api/top-stocks', authenticateToken, apiLimiter, async (req, res) => {
    const CACHE_DURATION_MS = 15 * 60 * 1000; 

    try {
        const cache = await TopStocksCache.findOne({ name: 'top10' });
        
        if (cache && (Date.now() - cache.lastScraped < CACHE_DURATION_MS) && cache.data.length > 0) {
            return res.json(cache.data);
        }

        console.log("Cache Miss: Scraping Top 10 Stocks via V8 Chart API...");
        const symbols = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK-B', 'LLY', 'V'];
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
        
        const promises = symbols.map(async (ticker) => {
            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
                const { data } = await axios.get(url, { headers });
                
                const meta = data.chart.result[0].meta;
                const price = meta.regularMarketPrice;
                const prevClose = meta.chartPreviousClose;
                const changeAmount = (price - prevClose);
                const changePercent = ((changeAmount / prevClose) * 100).toFixed(2) + "%";

                return {
                    ticker: ticker,
                    price: price.toFixed(2),
                    change: changeAmount.toFixed(2),
                    changePercent: changePercent
                };
            } catch (err) {
                console.error(`Skipping ${ticker} for ticker tape:`, err.message);
                return null; 
            }
        });

        const rawTop10 = await Promise.all(promises);
        
        const top10 = rawTop10.filter(stock => stock !== null);

        if (top10.length === 0) throw new Error("All top stock requests failed.");

        await TopStocksCache.findOneAndUpdate(
            { name: 'top10' },
            { data: top10, lastScraped: Date.now() },
            { new: true, upsert: true }
        );

        res.json(top10);
    } catch (error) {
        console.error("Error fetching top stocks:", error.message);
        
        await triggerIncident(
            "Top 10 Stocks Scraper Failed",
            `Yahoo Finance returned an error: ${error.message}. The ticker tape cache failed to refresh.`,
            'critical',
            'Stock-Scraper-Service'
        );

        res.status(500).json({ error: "Failed to fetch top stocks" });
    }
});

app.get('/api/stock/:ticker', authenticateToken, apiLimiter, async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const CACHE_DURATION_MS = 15 * 60 * 1000; 

    try {
        const cachedStock = await StockCache.findOne({ ticker });
        
    if (cachedStock && cachedStock.news && cachedStock.news.length > 0 && (Date.now() - cachedStock.lastScraped < CACHE_DURATION_MS)) {       
            console.log(`Cache Hit for [${ticker}]`);
            return res.json({
                source: 'cache',
                ticker: cachedStock.ticker,
                price: cachedStock.price,
                change: cachedStock.change,
                changePercent: cachedStock.changePercent,
                news: cachedStock.news, 
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
                news: scrapedData.news, 
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
            news: updatedStock.news, // <-- NEW
            updatedAt: updatedStock.lastScraped
        });

    } catch (error) {
        console.error(`Error processing request for ${ticker}:`, error.message);
        res.status(404).json({ error: error.message || "Failed to fetch stock data." });
    }
});

app.post('/api/read-article', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const { url } = req.body;
        console.log(`Scraping article: ${url}`);
        
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        const $ = cheerio.load(data);
        const paragraphs = [];

        $('.caas-body p, .article-body p, article p, .entry-content p').each((i, element) => {
            const text = $(element).text().trim();
            if (text && text.length > 20) paragraphs.push(text);
        });

        if (paragraphs.length === 0) {
            return res.status(400).json({ error: "Could not extract text. This article might be an external link, a video, or paywalled." });
        }

        res.json({ paragraphs });
    } catch (error) {
        console.error("Article scrape failed:", error.message);
        res.status(500).json({ error: "Failed to load the article text." });
    }
});

app.get('/api/admin/incidents', authenticateToken, async (req, res) => {
    try {
        const incidents = await Incident.find().sort({ createdAt: -1 }).limit(50);
        res.json(incidents);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch system logs" });
    }
});

app.post('/api/admin/incidents/:id/resolve', authenticateToken, async (req, res) => {
    try {
        const updated = await Incident.findByIdAndUpdate(
            req.params.id,
            { status: 'resolved', resolvedAt: Date.now() },
            { new: true }
        );
        res.json({ message: "Incident successfully resolved", updated });
    } catch (err) {
        res.status(500).json({ error: "Could not update incident" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));